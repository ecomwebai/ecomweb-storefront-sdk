import { NextResponse, type NextRequest } from "next/server";
import { hostOnlyCookieName, secureCookies } from "../auth/cookies";
import { publicNextUrl } from "../request/public-url";

export const THEME_PREVIEW_COOKIE = "ecomweb_theme_preview";
export const THEME_PREVIEW_PARAM = "preview_theme";
const MAX_TOKEN_LENGTH = 2048;
const MAX_AGE_SECONDS = 24 * 60 * 60;

/**
 * A dashboard preview link (`?preview_theme=<token>`) becomes an httpOnly
 * cookie scoped to the store, then a redirect to the clean URL, so the token
 * never stays in the address bar or in shared links. `preview_theme=exit`
 * clears it. The API validates the token on every render (themes spec §6.1).
 * In production the cookie also works inside the dashboard's theme editor,
 * which frames the store from another site: SameSite=None, partitioned by
 * the top-level site (CHIPS), so it never follows the store anywhere else.
 */
/** The preview cookie's name at `cookiePath` (see hostOnlyCookieName). */
export function themePreviewCookieName(cookiePath: string): string {
  return hostOnlyCookieName(THEME_PREVIEW_COOKIE, cookiePath);
}

export function applyThemePreview(
  req: NextRequest,
  cookiePath: string
): NextResponse | null {
  const value = req.nextUrl.searchParams.get(THEME_PREVIEW_PARAM);
  if (value === null) return null;
  const url = publicNextUrl(req);
  url.searchParams.delete(THEME_PREVIEW_PARAM);
  const res = NextResponse.redirect(url, 307);
  const valid =
    value !== "exit" && value.length > 0 && value.length <= MAX_TOKEN_LENGTH;
  const production = secureCookies();
  res.cookies.set(themePreviewCookieName(cookiePath), valid ? value : "", {
    httpOnly: true,
    // Locally the dashboard and the store share a site (localhost), and
    // SameSite=None needs https.
    ...(production
      ? { secure: true, sameSite: "none" as const, partitioned: true }
      : { secure: false, sameSite: "lax" as const }),
    path: cookiePath,
    maxAge: valid ? MAX_AGE_SECONDS : 0,
  });
  return res;
}

export function hasThemePreview(req: NextRequest, cookiePath: string): boolean {
  return !!req.cookies.get(themePreviewCookieName(cookiePath))?.value;
}
