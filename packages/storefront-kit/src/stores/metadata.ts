import type { Metadata } from "next";
import {
  comingSoonStoreNameOf,
  isStoreComingSoonError,
} from "./store-coming-soon";
import { isStoreSuspendedError } from "./store-suspension";

/** Shared copy: the coming soon metadata description and the coming soon page. */
export const COMING_SOON_STORE_DESCRIPTION =
  "Cửa hàng đang chuẩn bị và sẽ sớm mở cửa.";

/**
 * The metadata Next.js shows for a store's suspended pages. Never includes
 * `platform_suspension_reason` -- it's internal, written by an admin for
 * other admins.
 */
export const SUSPENDED_STORE_METADATA: Metadata = {
  title: "Store suspended",
  description:
    "This store is temporarily unavailable. If you are the store owner, contact support.",
  robots: "noindex, nofollow",
};

/**
 * The metadata for a store the merchant has not opened yet. `name` comes from
 * the coming soon error's details and may be missing.
 */
export function comingSoonStoreMetadata(name: string | null): Metadata {
  return {
    title: name ? `${name} sắp ra mắt` : "Sắp ra mắt",
    description: COMING_SOON_STORE_DESCRIPTION,
    robots: "noindex, nofollow",
  };
}

/**
 * Wraps a leaf page's `generateMetadata` body so a STORE_SUSPENDED lookup
 * doesn't crash the whole route. A STORE_COMING_SOON lookup gets
 * `comingSoonStoreMetadata` the same way.
 *
 * Next.js resolves every matched segment's `generateMetadata` unconditionally
 * to build <head> -- this happens independently of whatever the parent
 * `StoreLayout` eventually renders (it can skip rendering `children` for a
 * suspended store, but that doesn't stop Next from having already awaited
 * this segment's own `generateMetadata`). So each page that calls
 * `getCachedStore` in its own `generateMetadata` needs this, not just the
 * layout's.
 */
export async function withSuspendedStoreMetadataFallback(
  fn: () => Promise<Metadata>
): Promise<Metadata> {
  try {
    return await fn();
  } catch (error) {
    if (isStoreSuspendedError(error)) return SUSPENDED_STORE_METADATA;
    if (isStoreComingSoonError(error)) {
      return comingSoonStoreMetadata(comingSoonStoreNameOf(error));
    }
    throw error;
  }
}
