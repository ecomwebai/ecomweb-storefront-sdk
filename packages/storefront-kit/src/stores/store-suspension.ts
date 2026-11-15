import { ApiClientError } from "@ecomweb/sdk";

/**
 * True when `error` is the backend's signal that a PLATFORM admin suspended
 * this store (`STORE_SUSPENDED`, 403) — distinct from the store simply not
 * existing or not being active (`STORE_UNAVAILABLE`, 404), which the SDK's
 * `unwrapOrNull` already collapses to a plain `null` return, no throw.
 *
 * Both `getCachedStore` (path-based `/store/<ref>` resolution) and
 * `getStoreByHost` (custom-domain / subdomain resolution) call
 * `sdk.stores.getById` / `getByDomain`, which throw an `ApiClientError` for
 * any non-2xx, non-404 response — so this is the single place that decides
 * "was that a suspension" for both entry points.
 */
export function isStoreSuspendedError(error: unknown): boolean {
  return error instanceof ApiClientError && error.code === "STORE_SUSPENDED";
}

/**
 * Where the axios interceptor (lib/api/client.ts) sends the browser when a
 * client-side call discovers mid-session that the store was suspended.
 */
export const STORE_SUSPENDED_REDIRECT_PATH = "/store-suspended";

/**
 * True when a raw HTTP error body — shaped the way `ecomweb`'s
 * `BusinessException` serialises it, `{ code, message, details, timestamp }`
 * — is a STORE_SUSPENDED response.
 *
 * `isStoreSuspendedError` above classifies an already-thrown
 * `ApiClientError` from the SDK's own `stores.getById`/`getByDomain` calls.
 * This is the raw-response-body twin used by the axios interceptor, which
 * sees the error before the SDK has had a chance to construct one — and
 * which runs for *every* store-scoped call (cart, orders, products, ...),
 * not just store resolution. A suspension surfacing from an in-browser
 * interaction after the initial page load (add-to-cart, checkout, a review
 * submission) isn't covered by the one-time check in
 * `app/store/[storeRef]/layout.tsx`; this is what catches that.
 */
export function isStoreSuspendedResponseBody(data: unknown): boolean {
  return (
    typeof data === "object" &&
    data !== null &&
    (data as { code?: unknown }).code === "STORE_SUSPENDED"
  );
}
