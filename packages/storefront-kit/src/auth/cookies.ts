import type { NextResponse } from "next/server";
import type { AuthTokens } from "@ecomweb/sdk";

/** Whether cookies are written `Secure` (everywhere but local dev over http). */
export function secureCookies(): boolean {
  return process.env.NODE_ENV === "production";
}

/**
 * `name` with the `__Host-` prefix whenever the cookie can carry it: `Secure`
 * and `Path=/` (the browser rejects a `__Host-` cookie that is not both).
 *
 * Store subdomains are siblings under the platform domain, so a merchant
 * script on one store can set a cookie with `Domain=<platform domain>` that
 * every other store receives: a planted session or OAuth nonce (cookie
 * tossing). Browsers also reject a `__Host-` cookie that names a Domain, so
 * one read under this name was set by this host and no other.
 *
 * Readers must look up the same name the writer used and never fall back to
 * the bare one, which any sibling store can set. Path-scoped cookies (the
 * shared `/store/<ref>` host) cannot take the prefix and keep the bare name.
 */
export function hostOnlyCookieName(
  name: string,
  path: string,
  secure = secureCookies()
): string {
  return secure && path === "/" ? `__Host-${name}` : name;
}

/**
 * Cookie names are store-scoped because the platform serves many stores from
 * one origin (`/store/<storeRef>`). A shared name lets store B read store A's
 * session on the same domain. `path` is the cookie's (see authCookiePath).
 */
export function accessCookieName(storeRef: string, path: string): string {
  return hostOnlyCookieName(`ecomweb_sf_${storeRef}_at`, path);
}

export function refreshCookieName(storeRef: string, path: string): string {
  return hostOnlyCookieName(`ecomweb_sf_${storeRef}_rt`, path);
}

/**
 * Request header the middleware (`proxy.ts`) stamps on every request it sees,
 * recording whether the **Host** identified the store — i.e. whether this is a
 * custom domain / subdomain deployment (one store per origin) or the shared
 * path-based host (`<origin>/store/<ref>/…`).
 *
 * It exists because the cookie `path` has to match the URL space the *browser*
 * is in, and the auth route handler cannot tell the two apart on its own: the
 * client calls `/store/<ref>/api/auth/*` in both cases (`lib/auth/context.tsx`).
 * The middleware is the only place that resolves Host → store.
 *
 * Always overwritten by the middleware, so a browser-supplied value cannot
 * survive on any path the middleware matches. On the paths it does not match
 * (root `/api/*`, which is reachable only on a custom domain) the value is
 * absent and the fallback is the unscoped path — the pre-existing behaviour.
 */
export const HOST_MAPPED_HEADER = "x-ecomweb-host-mapped";

/** Minimal shape shared by `cookies()` and `request.cookies`. */
interface CookieReader {
  get(name: string): { value: string } | undefined;
}

/** Minimal shape shared by `NextRequest` and a plain `Request`. */
interface HeaderReader {
  headers: { get(name: string): string | null };
}

/** The session pair stored at `path` (see authCookiePath), if both are set. */
export function readAuthCookies(
  jar: CookieReader,
  storeRef: string,
  path: string
): AuthTokens | null {
  const access_token = jar.get(accessCookieName(storeRef, path))?.value;
  const refresh_token = jar.get(refreshCookieName(storeRef, path))?.value;

  if (!access_token || !refresh_token) return null;

  return { access_token, refresh_token };
}

/**
 * The unscoped path every auth cookie used to be written with, and still is
 * on a custom domain. Also the path the migration has to clear: sessions
 * created before this change live here.
 */
const LEGACY_PATH = "/";

/**
 * The `path` for this store's auth cookies.
 *
 * On the shared path-based host every store lives under `/store/<ref>/…`, so
 * scoping the cookie there keeps store B's server code from ever receiving
 * store A's token. On a custom domain the shopper's URLs are rooted at `/`
 * and the cookie must stay unscoped, or the browser would withhold it from
 * every page and the shopper would look signed out.
 */
export function authCookiePath(storeRef: string, hostMapped: boolean): string {
  return hostMapped ? LEGACY_PATH : `/store/${encodeURIComponent(storeRef)}`;
}

/**
 * Whether the Host identified the store for this request, per the middleware.
 *
 * Absent header → treated as host-mapped, i.e. exactly what this code did
 * before the scoping existed. Never guess "shared host" without evidence:
 * guessing wrong in that direction scopes the cookie to a path the shopper's
 * pages are not under, and hides their session from them.
 */
export function isHostMappedRequest(request: HeaderReader): boolean {
  return request.headers.get(HOST_MAPPED_HEADER) !== "0";
}

/** `authCookiePath` for an incoming request, using the middleware's stamp. */
export function authCookiePathFor(
  request: HeaderReader,
  storeRef: string
): string {
  return authCookiePath(storeRef, isHostMappedRequest(request));
}

/**
 * The store's own root as the *browser* sees it: `""` on a custom domain or
 * subdomain (the store is the origin), `/store/<ref>` on the shared
 * path-based host. Derived from the same signal as the cookie path so the two
 * can never disagree — and not from the request path, which is
 * `/store/<ref>/api/…` on both deployments.
 */
export function storeBasePathFor(
  request: HeaderReader,
  storeRef: string
): string {
  return isHostMappedRequest(request)
    ? ""
    : `/store/${encodeURIComponent(storeRef)}`;
}

function baseOptions() {
  return { httpOnly: true, secure: secureCookies(), sameSite: "lax" as const };
}

/**
 * Binds an OAuth round trip to the browser that started it.
 *
 * `google/complete` has to accept GET — Google's redirect chain lands there —
 * and `sameSite: "lax"` sends cookies on a cross-site top-level navigation, so
 * without this a link on any site could feed a victim's browser a one-time
 * code the attacker minted from their OWN Google account and plant the
 * attacker's session in it. The signed `state` cannot help: the backend
 * consumes it before the storefront is ever reached.
 *
 * `lax` (not `strict`) is required here for the same reason it is on the
 * session cookies: the browser arrives from Google's origin.
 */
export function oauthNonceCookieName(storeRef: string, path: string): string {
  return hostOnlyCookieName(`ecomweb_sf_${storeRef}_oauth`, path);
}

/** Long enough for a human to finish Google's consent screen, no longer. */
const OAUTH_NONCE_MAX_AGE_SECONDS = 600;

export function writeOAuthNonceCookie(
  response: NextResponse,
  storeRef: string,
  nonce: string,
  path: string
): void {
  response.cookies.set(oauthNonceCookieName(storeRef, path), nonce, {
    ...baseOptions(),
    path,
    maxAge: OAUTH_NONCE_MAX_AGE_SECONDS,
  });
}

export function clearOAuthNonceCookie(
  response: NextResponse,
  storeRef: string,
  path: string
): void {
  response.cookies.set(oauthNonceCookieName(storeRef, path), "", {
    ...baseOptions(),
    path,
    maxAge: 0,
  });
}

/**
 * Which mailed-link flow an email-proof binding belongs to. The API hands the
 * binding to the client that asked (register, change-email) and never mails
 * it; the click must present it with the mailed token, which proves the click
 * came from the same browser. A browser that lost the cookie (another device,
 * expired) still works: verify-email then verifies the address but drops the
 * password set at registration, and newer APIs refuse the email-change
 * confirm.
 */
export type EmailBindingPurpose = "verify-email" | "change-email";

const EMAIL_BINDING_COOKIE_SUFFIX: Record<EmailBindingPurpose, string> = {
  "verify-email": "vb",
  "change-email": "cb",
};

/** The API's token lifetimes (AUTH_TTL.EMAIL_VERIFICATION / EMAIL_CHANGE). */
const EMAIL_BINDING_MAX_AGE_SECONDS: Record<EmailBindingPurpose, number> = {
  "verify-email": 86400,
  "change-email": 3600,
};

export function emailBindingCookieName(
  purpose: EmailBindingPurpose,
  storeRef: string,
  path: string
): string {
  return hostOnlyCookieName(
    `ecomweb_sf_${storeRef}_${EMAIL_BINDING_COOKIE_SUFFIX[purpose]}`,
    path
  );
}

export function writeEmailBindingCookie(
  response: NextResponse,
  purpose: EmailBindingPurpose,
  storeRef: string,
  binding: string,
  path: string
): void {
  response.cookies.set(
    emailBindingCookieName(purpose, storeRef, path),
    binding,
    {
      ...baseOptions(),
      path,
      maxAge: EMAIL_BINDING_MAX_AGE_SECONDS[purpose],
    }
  );
}

export function clearEmailBindingCookie(
  response: NextResponse,
  purpose: EmailBindingPurpose,
  storeRef: string,
  path: string
): void {
  response.cookies.set(emailBindingCookieName(purpose, storeRef, path), "", {
    ...baseOptions(),
    path,
    maxAge: 0,
  });
}

export function writeAuthCookies(
  response: NextResponse,
  storeRef: string,
  tokens: AuthTokens,
  path: string
): void {
  response.cookies.set(accessCookieName(storeRef, path), tokens.access_token, {
    ...baseOptions(),
    path,
  });
  response.cookies.set(
    refreshCookieName(storeRef, path),
    tokens.refresh_token,
    {
      ...baseOptions(),
      path,
    }
  );
}

/**
 * Clearing has to name the identical path the cookie was written with — a
 * `Set-Cookie` with a different path creates a second, empty cookie and leaves
 * the real one in place. So logout clears BOTH paths, always.
 *
 * Not belt and braces: a cookie can genuinely exist at the other path. Every
 * session that predates the scoping lives at `Path=/`, and a request whose
 * Host lookup failed transiently writes the scoped path on a deployment that
 * otherwise uses the unscoped one. Either survivor would be handed straight
 * back by `readAuthCookies` — a live session the shopper believes they ended.
 */
export function clearAuthCookies(
  response: NextResponse,
  storeRef: string,
  path: string
): void {
  response.cookies.set(accessCookieName(storeRef, path), "", {
    ...baseOptions(),
    path,
    maxAge: 0,
  });
  response.cookies.set(refreshCookieName(storeRef, path), "", {
    ...baseOptions(),
    path,
    maxAge: 0,
  });

  // The same session wherever else it can be stored: at the other path, and
  // in production under the bare names at `/` every session used before the
  // `__Host-` names (still sent to the scoped path, so still readable there).
  const otherPath =
    path === LEGACY_PATH ? authCookiePath(storeRef, false) : LEGACY_PATH;
  const stale: Array<[name: string, path: string]> = [
    [accessCookieName(storeRef, otherPath), otherPath],
    [refreshCookieName(storeRef, otherPath), otherPath],
  ];
  if (secureCookies()) {
    stale.push(
      [`ecomweb_sf_${storeRef}_at`, LEGACY_PATH],
      [`ecomweb_sf_${storeRef}_rt`, LEGACY_PATH]
    );
  }

  // `response.cookies` is keyed by name alone and rewrites the whole
  // Set-Cookie list on every `set()`, so a second cookie of the same name
  // cannot go through it and must be appended afterwards, never before.
  const secure = secureCookies() ? "; Secure" : "";
  for (const [name, stalePath] of stale) {
    response.headers.append(
      "set-cookie",
      `${name}=; Path=${stalePath}; Max-Age=0; HttpOnly; SameSite=Lax${secure}`
    );
  }
}
