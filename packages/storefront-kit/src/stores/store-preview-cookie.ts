import { NextResponse, type NextRequest } from "next/server";
import {
  hostOnlyCookieName,
  isHostMappedRequest,
  secureCookies,
} from "../auth/cookies";
import { publicNextUrl } from "../request/public-url";
import {
  THEME_PREVIEW_COOKIE,
  themePreviewCookieName,
} from "../theme/preview-cookie";

// No `next/headers` here: the browser bundle reaches this module (through
// the API client), so readers take the jar and the request as arguments.

/** Holds a coming soon store's preview token (the dashboard's preview link). */
export const STORE_PREVIEW_COOKIE = "ecw_store_preview";
/** The preview link's route under the store's root. */
export const STORE_PREVIEW_PATH = "/preview";
/** The preview link's query param carrying the token. */
export const STORE_PREVIEW_PARAM = "token";
/** The API's request header (`X-Store-Preview`) that opens a coming soon store. */
export const STORE_PREVIEW_HEADER = "x-store-preview";
/**
 * Internal request header carrying a theme preview host's (`p-<slug>`) store
 * preview token from the host lookup to the render, in place of the cookie.
 * Only the middleware sets it, and it deletes any value the client sent on
 * every request it lets through, as it does for `THEME_PREVIEW_HOST_HEADER`,
 * so a reader can trust it on any path the matcher covers. Root `/api/*` is
 * outside the matcher; the backend proxy ignores it there.
 */
export const STORE_PREVIEW_TOKEN_HEADER = "x-ecomweb-store-preview-token";

const MAX_TOKEN_LENGTH = 2048;
const MAX_AGE_SECONDS = 24 * 60 * 60;

/** The store preview cookie's name at `cookiePath` (see hostOnlyCookieName). */
export function storePreviewCookieName(cookiePath: string): string {
  return hostOnlyCookieName(STORE_PREVIEW_COOKIE, cookiePath);
}

/**
 * The dashboard's preview link (`<store root>/preview?token=<t>`) becomes an
 * httpOnly cookie scoped to the store, then a 307 to the store's home, so the
 * token never stays in the address bar or in shared links. A missing, empty
 * or oversized token clears the cookie instead. The API validates the token
 * on every request. SameSite=Lax: the link is a top-level navigation and the
 * store is never framed during a store preview.
 */
export function applyStorePreview(
  req: NextRequest,
  cookiePath: string,
  storeRoot: string
): NextResponse {
  const token = req.nextUrl.searchParams.get(STORE_PREVIEW_PARAM) ?? "";
  const url = publicNextUrl(req);
  url.pathname = storeRoot;
  url.search = "";
  const res = NextResponse.redirect(url, 307);
  const valid = token.length > 0 && token.length <= MAX_TOKEN_LENGTH;
  res.cookies.set(storePreviewCookieName(cookiePath), valid ? token : "", {
    httpOnly: true,
    secure: secureCookies(),
    sameSite: "lax",
    path: cookiePath,
    maxAge: valid ? MAX_AGE_SECONDS : 0,
  });
  return res;
}

/** Minimal shape shared by `cookies()` and `request.cookies`. */
interface CookieReader {
  get(name: string): { value: string } | undefined;
}

/** Minimal shape shared by `headers()`-backed requests and `NextRequest`. */
interface HeaderReader {
  headers: { get(name: string): string | null };
}

/**
 * True unless the token's own payload says it has expired. Preview tokens are
 * `<base64url(json)>.<signature>` with `exp` (ms) in the payload; the
 * signature can only be checked by the API, so this only drops tokens that
 * are certainly dead. A token it cannot read counts as live: the API decides.
 */
export function previewTokenUnexpired(
  token: string,
  now: number = Date.now()
): boolean {
  try {
    const payload = token.split(".")[0] ?? "";
    const json = JSON.parse(
      atob(payload.replace(/-/g, "+").replace(/_/g, "/"))
    ) as { exp?: unknown };
    return typeof json.exp !== "number" || json.exp >= now;
  } catch {
    return true;
  }
}

/**
 * The first candidate that is present and not expired. When every candidate
 * is expired, the first present one: sending a dead token and getting the
 * API's refusal beats sending none.
 */
export function firstLivePreviewToken(
  ...candidates: Array<string | null | undefined>
): string | null {
  const present = candidates.filter((c): c is string => !!c);
  return present.find(t => previewTokenUnexpired(t)) ?? present[0] ?? null;
}

/**
 * The token to send as `X-Store-Preview` for this request, or null. In order:
 * the preview host's token the middleware stamped (`STORE_PREVIEW_TOKEN_HEADER`),
 * the store preview cookie, then the theme preview cookie (`?preview_theme=`
 * on the store's own host), which the API accepts too. Cookies are read under
 * the name their writer used: `/` on a host-mapped request (the `__Host-` name
 * in production, never the bare one a sibling store could plant), else the
 * bare path-scoped name. An empty value counts as none at every step, and so
 * does an expired one: a stale store cookie no longer hides a valid theme
 * cookie behind it.
 *
 * Trusts `STORE_PREVIEW_TOKEN_HEADER`, so call it only on a request that went
 * through the middleware (server components, route handlers), never on the
 * middleware's own incoming request.
 */
export function storePreviewTokenFrom(
  jar: CookieReader,
  request: HeaderReader
): string | null {
  const stamped = request.headers.get(STORE_PREVIEW_TOKEN_HEADER);
  const hostMapped = isHostMappedRequest(request);
  const storeCookie = hostMapped
    ? storePreviewCookieName("/")
    : STORE_PREVIEW_COOKIE;
  const themeCookie = hostMapped
    ? themePreviewCookieName("/")
    : THEME_PREVIEW_COOKIE;
  return firstLivePreviewToken(
    stamped,
    jar.get(storeCookie)?.value,
    jar.get(themeCookie)?.value
  );
}

/**
 * Request option that forbids the kit's API client from attaching the
 * request's ambient preview token (`storePreviewTokenFrom`) as
 * `X-Store-Preview`. Spread it into the SDK call's options (the SDK's
 * `RequestOptions` takes extra keys and the kit's ApiClient hands them to
 * axios unchanged). A plain `getStoreByHost(host)` sets it, because its
 * result is cached per host for every visitor and must be the public answer.
 * An explicit `X-Store-Preview` header in the same options still goes out.
 */
export const SKIP_STORE_PREVIEW = Object.freeze({
  skipStorePreview: true,
} as const);

/** True when request options (or an axios config) carry SKIP_STORE_PREVIEW. */
export function skipsStorePreview(options: object | undefined): boolean {
  return (
    (options as { skipStorePreview?: unknown } | undefined)
      ?.skipStorePreview === true
  );
}
