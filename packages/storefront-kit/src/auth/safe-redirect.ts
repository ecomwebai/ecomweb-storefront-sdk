/**
 * The one post-auth redirect guard.
 *
 * Both places a shopper can name where to go after signing in — the `?next=`
 * on `/login` and `/register` (`components/auth/auth-form.tsx`) and the `next=`
 * that survives the Google round trip (`lib/auth/route-handlers.ts`) — resolve
 * the candidate here. A second copy is exactly how the two drifted apart in the
 * first place, so there is deliberately only one.
 *
 * The rule is "resolve, then compare origins", not "reject a list of prefixes":
 *
 *   - `//evil.com` and `/\evil.com` both resolve to `https://evil.com/`, the
 *     second because the WHATWG parser normalises `\` to `/` for special
 *     schemes exactly as browsers do. A `startsWith("//")` check catches the
 *     first and misses the second.
 *   - `http:/evil.com` resolves to `http://evil.com/` — a scheme-carrying value
 *     that starts with neither `//` nor `http://`.
 *   - `javascript:alert(1)` parses with an opaque origin (`"null"`), which is
 *     never equal to the page origin.
 *
 * Comparing the resolved origin covers all of them without enumerating any.
 */

/** Where a rejected or missing candidate goes. Relative, so it stays inside
 *  whichever store path or custom domain the caller is already on. */
export const DEFAULT_REDIRECT = "/";

/**
 * A same-origin, relative path safe to hand to `router.push()` or
 * `NextResponse.redirect(new URL(path, request.url))`.
 *
 * @param candidate the shopper-supplied value (`?next=`), or null/undefined
 * @param base an absolute URL of the current page — `window.location.origin`
 *   in the browser, `request.url` on the server
 */
export function safeRedirectPath(
  candidate: string | null | undefined,
  base: string
): string {
  if (!candidate) return DEFAULT_REDIRECT;

  let resolved: URL;
  let origin: string;

  try {
    resolved = new URL(candidate, base);
    origin = new URL(base).origin;
  } catch {
    return DEFAULT_REDIRECT;
  }

  // An opaque origin (data:, javascript:, blob:) serialises to "null" and can
  // never match; a different host or scheme is off-origin by definition.
  if (resolved.origin !== origin) return DEFAULT_REDIRECT;

  const path = `${resolved.pathname}${resolved.search}${resolved.hash}`;

  // `URL` always produces a rooted pathname for a hierarchical URL, but a
  // non-special scheme sharing the origin would not — belt and braces.
  return path.startsWith("/") ? path : DEFAULT_REDIRECT;
}
