import type { UrlRedirect } from "@ecomweb/sdk";
import { sdk } from "../sdk";
import { SKIP_STORE_PREVIEW } from "../stores/store-preview-cookie";

/**
 * Lookup URL redirect for a given store and path
 * Used by middleware to check if a path should be redirected
 */
export async function lookupRedirect(
  storeId: string,
  path: string
): Promise<UrlRedirect | null> {
  try {
    // The middleware's own call: `next/headers` there is its raw incoming
    // request, so the ambient preview token must not ride along.
    return await sdk.redirects.lookup(storeId, path, SKIP_STORE_PREVIEW);
  } catch (error) {
    console.error("Error looking up redirect:", error);
    return null;
  }
}
