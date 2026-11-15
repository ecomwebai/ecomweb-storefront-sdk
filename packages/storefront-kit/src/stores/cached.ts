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
