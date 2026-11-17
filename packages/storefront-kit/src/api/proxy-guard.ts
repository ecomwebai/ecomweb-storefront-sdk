import { NextResponse, type NextRequest } from "next/server";
import { publicConfig } from "../config/public";
import { publicNextUrl } from "../request/public-url";
import { SERVED_STORE_HEADER } from "../request/served-store";

/**
 * The store this request serves: the configured store in single mode, the
 * middleware's stamp in multi mode (null when it stamped none, and on paths
 * the middleware does not process).
 */
export function servedStoreRef(request: {
  headers: { get(name: string): string | null };
  nextUrl: { pathname: string };
}): string | null {
  const config = publicConfig();
  if (config.mode === "single") return config.storeRef ?? null;
  // The middleware matcher excludes paths starting with `api` (e.g.
  // /api/auth/*), so such a request never had a client copy stripped: its
  // stamp is whatever the client sent.
  if (/^\/api/.test(request.nextUrl.pathname)) return null;
  return request.headers.get(SERVED_STORE_HEADER) || null;
}

/**
 * True when the browser says the request came from this storefront's own
 * origin. `Sec-Fetch-Site`, when present, decides alone (only `same-origin`
 * passes); without it, `Origin` must equal the shopper-facing origin.
 *
 * A request with neither header passes only as a GET or HEAD. Safari before
 * 16.4 sends no `Sec-Fetch-*`, and browsers send no `Origin` on a same-origin
 * GET, so refusing those would lock older iPhones out of every private read.
 * A cross-site page cannot read the response (no CORS), proxied GETs change
 * nothing, and a script can forge both headers anyway: this check is CSRF
 * protection, not bot protection. Any other method with neither header is
 * refused.
 */
export function isSameOriginRequest(
  request: Pick<NextRequest, "headers" | "nextUrl" | "method">
): boolean {
  const site = request.headers.get("sec-fetch-site");
  if (site !== null) return site === "same-origin";
  const origin = request.headers.get("origin");
  if (!origin) return request.method === "GET" || request.method === "HEAD";
  return origin === publicNextUrl(request).origin;
}

/**
 * The one answer for every refusal by the backend proxy and the auth routes,
 * whichever check failed, so a caller cannot tell which one it tripped.
 */
export function proxyNotFound(): NextResponse {
  return NextResponse.json(
    { code: "NOT_FOUND", message: "Not found" },
    { status: 404 }
  );
}
