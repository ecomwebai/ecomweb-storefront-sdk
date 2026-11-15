import "server-only";
import { headers } from "next/headers";
import { publicConfig } from "../config/public";
import { getCachedStore } from "./cached";
import { getStoreByHost } from "./get-store-by-host";
import {
  comingSoonStoreNameOf,
  isStoreComingSoonError,
} from "./store-coming-soon";

/**
 * Whether the store this request belongs to is coming soon, and its name
 * (null when the API gave none). Null when the store is not coming soon.
 *
 * The name only ever comes from the API lookup, never from the request, so
 * the /coming-soon page cannot be made to show text a visitor chose.
 */
export async function resolveComingSoonStore(): Promise<{
  name: string | null;
} | null> {
  const config = publicConfig();
  if (config.mode === "single") {
    try {
      await getCachedStore(config.storeRef as string);
      return null;
    } catch (error) {
      if (isStoreComingSoonError(error)) {
        return { name: comingSoonStoreNameOf(error) };
      }
      throw error;
    }
  }
  const host = (await headers()).get("host") ?? "";
  const lookup = await getStoreByHost(host);
  return lookup.comingSoon ? { name: lookup.comingSoonName } : null;
}
