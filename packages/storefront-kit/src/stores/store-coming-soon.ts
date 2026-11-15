import { ApiClientError } from "@ecomweb/sdk";

/**
 * True when `error` is the backend's signal that the merchant has not opened
 * this store yet (`STORE_COMING_SOON`, 403, details `{ name }`). Unlike
 * `STORE_SUSPENDED`, this is a merchant-controlled state, and the API lifts
 * it for a request carrying a valid `X-Store-Preview` token.
 *
 * Both `getCachedStore` and `getStoreByHost` surface it as an
 * `ApiClientError`, so this is the one place that decides "was that coming
 * soon" for both entry points.
 */
export function isStoreComingSoonError(error: unknown): boolean {
  return error instanceof ApiClientError && error.code === "STORE_COMING_SOON";
}

/**
 * The store name the API puts in a coming soon error's `details`, or null
 * when the error is not coming soon or carries no usable name.
 */
export function comingSoonStoreNameOf(error: unknown): string | null {
  if (!isStoreComingSoonError(error)) return null;
  const details = (error as ApiClientError).details;
  const name =
    typeof details === "object" && details !== null
      ? (details as { name?: unknown }).name
      : undefined;
  return typeof name === "string" && name.length > 0 ? name : null;
}

/**
 * Where the axios interceptor (lib/api/client.ts) sends the browser when a
 * client-side call discovers mid-session that the store is coming soon.
 */
export const STORE_COMING_SOON_REDIRECT_PATH = "/coming-soon";

/**
 * True when a raw HTTP error body (`{ code, message, details, timestamp }`)
 * is a STORE_COMING_SOON response. The raw-body twin of
 * `isStoreComingSoonError`, for the axios interceptor, which sees the error
 * before the SDK constructs an `ApiClientError`. Internal to the kit.
 */
export function isStoreComingSoonResponseBody(data: unknown): boolean {
  return (
    typeof data === "object" &&
    data !== null &&
    (data as { code?: unknown }).code === "STORE_COMING_SOON"
  );
}
