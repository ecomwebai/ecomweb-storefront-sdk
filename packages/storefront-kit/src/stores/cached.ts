import type { StoreConfigurationInfo } from "@ecomweb/sdk";
import { sdk } from "../sdk";
import { cache } from "react";

const getCachedStoreInternal = cache(
  async (storeRef: string): Promise<StoreConfigurationInfo | null> => {
    return sdk.stores.getById(storeRef, {
      includeConfig: true,
      includeSettings: true,
      includeEmbeddedScripts: true,
    });
  }
);

/**
 * Loads a store's configuration, settings and embedded scripts. Server-side;
 * calls with the same ref during one request share a single fetch.
 *
 * @param storeRef - The store's ref.
 * @param options - Accepted for compatibility and ignored; the full configuration is always fetched.
 * @returns The store, or `null` when it does not exist.
 */
export const getCachedStore = cache(
  async (
    storeRef: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- public signature (in etc/index.api.md); accepted for compatibility, the full config is always fetched
    options?: {
      includeConfig?: boolean;
      includeSettings?: boolean;
      includeBlogSettings?: boolean;
    }
  ): Promise<StoreConfigurationInfo | null> => {
    return getCachedStoreInternal(storeRef);
  }
);
