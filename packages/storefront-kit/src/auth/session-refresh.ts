import type { NextRequest } from "next/server";
import {
  accessCookieName,
  authCookiePath,
  refreshCookieName,
  HOST_MAPPED_HEADER,
} from "./cookies";
import { forwardedForHeader } from "./client-ip";
import { publicConfig } from "../config/public";
import { serverConfig } from "../config/server";
import { THEME_PREVIEW_HOST_HEADER } from "../theme/preview-host";
import { STORE_PREVIEW_TOKEN_HEADER } from "../stores/store-preview-cookie";

/**
 * Session upkeep shared by both middleware modes (createStorefrontMiddleware):
 * refresh a near-expiry access token, and pass the downstream render the
 * rotated tokens plus the host-mapped stamp.
 */

const REFRESH_WINDOW_SECONDS = 120;
const REFRESH_FETCH_TIMEOUT_MS = 2500;

export interface RotatedTokens {
  access_token: string;
  refresh_token: string;
}

/**
 * Reads `exp` without verifying the signature — the API verifies. This only
 * decides whether to refresh early, so a forged token gains nothing: it still
 * fails at the API.
 */
export function expiresWithin(token: string, seconds: number): boolean {
  try {
    const payload = JSON.parse(
      Buffer.from(token.split(".")[1], "base64").toString("utf8")
    );
    if (typeof payload.exp !== "number") return false;
    return payload.exp - Math.floor(Date.now() / 1000) < seconds;
  } catch {
    return false;
  }
}

/**
 * Proactively refresh a near-expiry access token so requests don't hit a 401
 * on it. Returns the rotated pair, or null if there was nothing to do or the
 * attempt failed — a failed refresh is non-fatal and the request proceeds on
 * the old token, letting the 401 paths handle it.
 *
 * This runs for **every** request the matcher admits, not just host-mapped
 * ones: the server-rendered pages read the session straight off the cookie
 * (`lib/auth/session.ts`) and have no other way to renew it. Part A's backend
 * proxy refreshes on a 401, but that only covers browser-initiated calls.
 * `cookiePath` is the session cookies' path (authCookiePath).
 */
export async function refreshIfNearExpiry(
  req: NextRequest,
  storeRef: string,
  cookiePath: string
): Promise<RotatedTokens | null> {
  const access = req.cookies.get(accessCookieName(storeRef, cookiePath))?.value;
  const refresh = req.cookies.get(
    refreshCookieName(storeRef, cookiePath)
  )?.value;

  if (!access || !refresh) return null;
  if (!expiresWithin(access, REFRESH_WINDOW_SECONDS)) return null;

  try {
    const res = await fetch(
      `${publicConfig().apiUrl}/public/stores/${encodeURIComponent(storeRef)}/auth/refresh`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-storefront-api-key": serverConfig().platformApiKey,
          // The backend throttles per `storeId:clientIp`; without this (the
          // shopper IP plus the forwarder secret that makes the backend
          // believe it) every shopper's refresh lands in one store-wide bucket.
          ...forwardedForHeader(req.headers),
        },
        body: JSON.stringify({ refresh_token: refresh }),
        // This is a latency budget added to a page load the user did not
        // ask for, not an API call worth waiting out — bound it so a slow
        // (not down) API can't turn a fast page load into a stall. An
        // abort rejects `fetch`, which the surrounding catch below
        // treats the same as any other network failure: non-fatal,
        // the request proceeds on the old token.
        signal: AbortSignal.timeout(REFRESH_FETCH_TIMEOUT_MS),
      }
    );

    if (!res.ok) return null;

    const data = await res.json();
    if (data?.access_token && data?.refresh_token) {
      return {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
      };
    }
  } catch {
    // Non-fatal: proceed on the old token, the normal 401 path handles it.
  }

  return null;
}

/**
 * The request headers every downstream render and route handler sees.
 *
 * Two jobs:
 *
 * 1. `HOST_MAPPED_HEADER` records whether the **Host** named the store. This
 *    middleware is the only place that resolves Host → store, and the auth
 *    route handler needs the answer to choose the cookie `path` and to know
 *    where the store's own root is — it cannot tell the deployments apart from
 *    the request path, which is `/store/<ref>/api/…` on both. Always set, so a
 *    browser-supplied value can never survive.
 * 2. When a token was rotated, the new pair replaces the old one in the cookie
 *    header, so the render *this* request triggers already sees the new
 *    session. Without it a shopper returning after their access token expired
 *    would be bounced to `/login` on the very request that renewed it.
 */
export function downstreamRequestHeaders(
  req: NextRequest,
  hostMapped: boolean,
  storeRef: string | null,
  rotated: RotatedTokens | null
): Headers {
  const headers = new Headers(req.headers);
  headers.set(HOST_MAPPED_HEADER, hostMapped ? "1" : "0");
  // Only the middleware names a preview host's theme (theme/preview-host).
  headers.delete(THEME_PREVIEW_HOST_HEADER);
  // Only the middleware hands on a preview host's store preview token; a
  // copy the client sent never survives (stores/store-preview-cookie).
  headers.delete(STORE_PREVIEW_TOKEN_HEADER);

  if (rotated && storeRef) {
    const jar = new Map(req.cookies.getAll().map(c => [c.name, c.value]));
    const path = authCookiePath(storeRef, hostMapped);
    jar.set(accessCookieName(storeRef, path), rotated.access_token);
    jar.set(refreshCookieName(storeRef, path), rotated.refresh_token);
    headers.set(
      "cookie",
      [...jar].map(([name, value]) => `${name}=${value}`).join("; ")
    );
  }

  return headers;
}
