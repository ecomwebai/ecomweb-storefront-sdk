import "server-only";

import { NextResponse, type NextRequest } from "next/server";

import {
  authCookiePathFor,
  readAuthCookies,
  writeAuthCookies,
} from "../auth/cookies";
import {
  clientIpFrom,
  FORWARDER_SECRET_HEADER,
  forwardingHeaders,
} from "../auth/client-ip";
import { backendBaseUrl, createAuthApi, storefrontApiKey } from "../auth/sdk";
import { multiTenantStorePath } from "../store-scope";
import {
  STORE_PREVIEW_HEADER,
  STORE_PREVIEW_TOKEN_HEADER,
  storePreviewTokenFrom,
} from "../stores/store-preview-cookie";

/**
 * Same-origin server proxy for the storefront's authenticated backend calls.
 *
 * Session tokens live in httpOnly, store-scoped cookies (`lib/auth/cookies.ts`)
 * that browser JS cannot read, and the backend runs on a different origin, so a
 * direct browser->backend call carries neither cookie nor bearer token. The
 * browser therefore calls `/store/<storeRef>/api/backend/<path>` — same origin,
 * so the cookie is sent — and this handler, running on the server, attaches the
 * bearer token and the storefront API key before forwarding.
 *
 * This is the same shape as `lib/auth/route-handlers.ts`, which is why this
 * module is the third (and last) place allowed to touch auth cookies. It still
 * goes through `lib/auth/cookies.ts` rather than naming cookies itself.
 */

/**
 * Never forwarded upstream:
 * - hop-by-hop headers (RFC 9110 s7.6.1) are per-connection by definition;
 * - `host`/`content-length`/`accept-encoding` are owned by `fetch`;
 * - `origin` describes the browser->proxy hop, not the proxy->backend one;
 * - `authorization` and `cookie` because the httpOnly cookie is the ONLY
 *   trusted source of identity here — a browser-supplied `Authorization`
 *   header must never reach the backend through this route;
 * - `x-storefront-api-key` because the server attaches its own;
 * - `x-forwarded-for` and `x-real-ip` because neither is a Fetch-forbidden
 *   header name, so browser JS can set them — and the backend derives the
 *   client IP from exactly those, for the auth throttle key and for API-key IP
 *   allowlisting. They are dropped here and re-set below from the value the
 *   platform edge gave *this* server. Block first, then set: the reverse order
 *   would hand the choice back to the caller;
 * - `x-ecomweb-forwarder-secret` because it is what makes the backend trust
 *   `x-forwarded-for`. Only this server attaches it, from a server-only env
 *   var; a browser-supplied one must never pass through, least of all when
 *   the var is unset here and nothing would overwrite it;
 * - `x-store-preview` and the middleware's internal store preview token
 *   header, because the token sent upstream comes only from this request's
 *   cookie or the middleware's stamp (`storePreviewTokenFor` below).
 */
const BLOCKED_REQUEST_HEADERS = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "host",
  "content-length",
  "accept-encoding",
  "origin",
  "authorization",
  "cookie",
  "x-storefront-api-key",
  "x-forwarded-for",
  "x-real-ip",
  "cf-connecting-ip",
  FORWARDER_SECRET_HEADER,
  STORE_PREVIEW_HEADER,
  STORE_PREVIEW_TOKEN_HEADER,
]);

const METHODS_WITH_BODY = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function jsonError(status: number, message: string, code: string) {
  return NextResponse.json({ code, message }, { status });
}

/**
 * Rebuilds the upstream URL from the catch-all segments. Next has already
 * percent-decoded them, so `..` arrives literally and is rejected here; the
 * origin/prefix check afterwards is the backstop that keeps this route from
 * becoming an open forward proxy.
 */
function resolveTarget(segments: string[], search: string): URL | null {
  if (segments.length === 0) return null;

  for (const segment of segments) {
    if (
      segment === "" ||
      segment === "." ||
      segment === ".." ||
      segment.includes("/") ||
      segment.includes("\\")
    ) {
      return null;
    }
  }

  const base = new URL(backendBaseUrl());
  const prefix = base.pathname.replace(/\/$/, "");
  const target = new URL(
    `${prefix}/${segments.map(encodeURIComponent).join("/")}`,
    base
  );

  if (target.origin !== base.origin) return null;
  if (!target.pathname.startsWith(`${prefix}/`)) return null;

  target.search = search;
  return target;
}

/**
 * The store preview token to send upstream as `X-Store-Preview`, or null:
 * a preview host's token the middleware stamped, else the store preview
 * cookie, else the theme preview cookie (`storePreviewTokenFrom`).
 *
 * The stamp is trusted only under `/store/<ref>/`: the middleware's matcher
 * covers that path, and every response there that reaches this route drops
 * a client's copy of the header first. Root `/api/*` (the single-store
 * proxy) is outside the matcher, so the header there is whatever the client
 * sent, and only the cookies count.
 */
export function storePreviewTokenFor(
  request: NextRequest,
  storeRef: string
): string | null {
  const stamped = request.nextUrl.pathname.startsWith(
    `${multiTenantStorePath(storeRef)}/`
  );
  return storePreviewTokenFrom(
    request.cookies,
    stamped
      ? request
      : {
          headers: {
            get: name =>
              name.toLowerCase() === STORE_PREVIEW_TOKEN_HEADER
                ? null
                : request.headers.get(name),
          },
        }
  );
}

function forwardedHeaders(
  request: NextRequest,
  storeRef: string,
  accessToken?: string
) {
  const headers = new Headers();

  request.headers.forEach((value, key) => {
    if (!BLOCKED_REQUEST_HEADERS.has(key.toLowerCase())) {
      headers.set(key, value);
    }
  });

  headers.set("x-storefront-api-key", storefrontApiKey());

  // Set only after the blocklist has stripped whatever the browser sent.
  for (const [key, value] of Object.entries(
    forwardingHeaders(clientIpFrom(request.headers))
  )) {
    headers.set(key, value);
  }

  // Set only after the blocklist has dropped whatever the browser sent.
  const previewToken = storePreviewTokenFor(request, storeRef);
  if (previewToken) headers.set(STORE_PREVIEW_HEADER, previewToken);

  if (accessToken) headers.set("authorization", `Bearer ${accessToken}`);

  return headers;
}

interface UpstreamResult {
  status: number;
  body: string;
  contentType: string | null;
}

async function callUpstream(
  request: NextRequest,
  storeRef: string,
  target: URL,
  body: string | undefined,
  accessToken?: string
): Promise<UpstreamResult> {
  const response = await fetch(target, {
    method: request.method,
    headers: forwardedHeaders(request, storeRef, accessToken),
    body,
    cache: "no-store",
    redirect: "manual",
  });

  return {
    status: response.status,
    body: await response.text(),
    contentType: response.headers.get("content-type"),
  };
}

/**
 * Passes the backend's status and body through untouched — callers read
 * `{ code, message }` off the body, so rewriting it would break their error
 * handling.
 */
function respond(result: UpstreamResult): NextResponse {
  return new NextResponse(result.body || null, {
    status: result.status,
    headers: result.contentType
      ? { "content-type": result.contentType }
      : undefined,
  });
}

export async function handleBackendProxy(
  request: NextRequest,
  storeRef: string,
  segments: string[]
): Promise<NextResponse> {
  const target = resolveTarget(segments, request.nextUrl.search);

  if (!target) {
    return jsonError(400, "Invalid proxy path", "PROXY_INVALID_PATH");
  }

  // Buffered once so the 401 retry below can replay it.
  const body = METHODS_WITH_BODY.has(request.method)
    ? await request.text()
    : undefined;

  const tokens = readAuthCookies(
    request.cookies,
    storeRef,
    authCookiePathFor(request, storeRef)
  );

  let result: UpstreamResult;

  try {
    result = await callUpstream(
      request,
      storeRef,
      target,
      body || undefined,
      tokens?.access_token
    );
  } catch {
    return jsonError(502, "Upstream request failed", "PROXY_UPSTREAM_ERROR");
  }

  // Anonymous callers and non-401 answers are done: public endpoints must keep
  // working through this proxy.
  if (result.status !== 401 || !tokens) return respond(result);

  // Exactly one refresh + retry. Never a loop.
  const refreshed = await createAuthApi(
    storeRef,
    clientIpFrom(request.headers)
  ).refresh(tokens.refresh_token);

  // A failed refresh does NOT clear the cookies, because "failed" and "the
  // session is dead" are not the same thing here. `SessionService.rotate()`
  // revokes the presented refresh token before issuing its replacement, so a
  // token can be rejected simply for having lost a race: `proxy.ts` refreshes
  // near-expiry tokens on every matched request, this route refreshes again on
  // a 401, and a page load fires several of both at once. Each of those reads
  // the refresh token from its own request snapshot, so whichever rotation
  // lands second presents an already-revoked token through no fault of the
  // shopper. Clearing here would log them out mid-page.
  //
  // Leaving stale cookies in place is safe: the `(protected)` layout resolves
  // the session server-side on the next navigation and redirects to /login if
  // it really is gone, and signing in overwrites them.
  if (
    !refreshed.success ||
    !refreshed.data?.access_token ||
    !refreshed.data.refresh_token
  ) {
    return respond(result);
  }

  let retry: UpstreamResult;

  try {
    retry = await callUpstream(
      request,
      storeRef,
      target,
      body || undefined,
      refreshed.data.access_token
    );
  } catch {
    return jsonError(502, "Upstream request failed", "PROXY_UPSTREAM_ERROR");
  }

  const response = respond(retry);

  writeAuthCookies(
    response,
    storeRef,
    {
      access_token: refreshed.data.access_token,
      refresh_token: refreshed.data.refresh_token,
    },
    authCookiePathFor(request, storeRef)
  );

  return response;
}
