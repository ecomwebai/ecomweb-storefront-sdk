import { sdk } from "../sdk";
import { SKIP_STORE_PREVIEW } from "./store-preview-cookie";
import { TtlCache } from "./ttl-cache";

const TTL_MS = 60_000;
const MAX_REFS = 10_000;

const byRef = new TtlCache<string | null>(MAX_REFS);

/** Tests only: forget every cached lookup. */
export function clearStoreSubdomainCache(): void {
  byRef.clear();
}

/**
 * The platform subdomain label of the store `storeRef`, or null when there
 * is no such store or it has none. Throws when the API cannot be reached, so
 * the caller can tell "no store" from "don't know" (only the former is
 * cached).
 */
export async function getStoreSubdomain(
  storeRef: string
): Promise<string | null> {
  const cached = byRef.get(storeRef);
  if (cached !== undefined) return cached;

  // Cached for every visitor, and called from the middleware, where
  // `next/headers` is the raw incoming request: never with the ambient
  // preview token (as for a plain getStoreByHost).
  const store = await sdk.stores.getById(
    storeRef,
    {
      includeConfig: true,
      includeSettings: false,
      includeEmbeddedScripts: false,
    },
    SKIP_STORE_PREVIEW
  );
  const subdomain = store?.config?.subdomain || null;
  byRef.set(storeRef, subdomain, TTL_MS);
  return subdomain;
}
