import { storePreviewTokenFrom } from "../stores/store-preview-cookie";

/**
 * The browser's store preview token, which the layout hands over through
 * `StorefrontKitProvider` (see `storePreviewToken` there). Module-level: one
 * browser tab is one store. It stays set after the store opens until the
 * next layout render passes null (a reload); accepted: an open store needs
 * no token, so the API's answers do not change, only the kit's preview
 * cues lag in a tab left open across the opening.
 */
let browserToken: string | null = null;

/**
 * Sets the token the browser's kit clients send as `X-Store-Preview`. Does
 * nothing on the server: a server module is shared by every request, so a
 * value set there would reach other shoppers.
 */
export function setBrowserStorePreviewToken(token: string | null): void {
  if (typeof window === "undefined") return;
  browserToken = token;
}

/**
 * True in the browser while a store preview token is set: the shopper is a
 * previewer, and the API refuses every write. The cart and checkout check
 * this to refuse a write without sending it.
 */
export function isBrowserStorePreview(): boolean {
  return typeof window !== "undefined" && browserToken !== null;
}

/**
 * Fetches a fresh preview token, set by `StorefrontKitProvider` only on a
 * theme preview host, whose token lasts 1 h (the app re-renders the layout,
 * which hands the new token over). A link preview's 24 h cookie has none.
 */
let renewer: (() => void) | null = null;
let lastRenewalAt: number | null = null;

/** The shortest gap between two renewals a 403 asks for. */
const RENEWAL_THROTTLE_MS = 60_000;

/** Sets or clears the renewer; a new one may renew at once. */
export function setStorePreviewRenewer(renew: (() => void) | null): void {
  renewer = renew;
  lastRenewalAt = null;
}

/**
 * Asks for a fresh preview token after a read was refused with
 * `STORE_COMING_SOON`. False when there is no renewer: the preview is over.
 * Otherwise true, and the renewer runs at most once per minute, so a page
 * whose reads all fail together renews once.
 */
export function requestStorePreviewRenewal(): boolean {
  if (!renewer) return false;
  const now = Date.now();
  if (lastRenewalAt === null || now - lastRenewalAt >= RENEWAL_THROTTLE_MS) {
    lastRenewalAt = now;
    renewer();
  }
  return true;
}

/**
 * The token this call should send as `X-Store-Preview`, or null. In the
 * browser, the one the layout handed over. On the server, the request's own
 * (`storePreviewTokenFrom`: a preview host's stamped token, else the store
 * preview cookie, else the theme preview cookie). Outside a request scope
 * (build time), `next/headers` throws and this is null.
 *
 * In the middleware it does not throw: Next 16 runs the middleware inside a
 * request store, so `next/headers` is the middleware's own incoming
 * request, before any sanitising, and this returns whatever token the
 * client sent, a forged `STORE_PREVIEW_TOKEN_HEADER` included. So every SDK
 * call the middleware makes must pass `SKIP_STORE_PREVIEW` or an explicit
 * `X-Store-Preview` header (as getStoreByHost, lookupRedirect and
 * getStoreSubdomain do).
 */
export async function currentStorePreviewToken(): Promise<string | null> {
  if (typeof window !== "undefined") return browserToken;
  try {
    // Imported lazily: this module is in the browser bundle too (as in
    // api/server-client.ts).
    const { cookies, headers } = await import("next/headers");
    return storePreviewTokenFrom(await cookies(), { headers: await headers() });
  } catch {
    return null;
  }
}
