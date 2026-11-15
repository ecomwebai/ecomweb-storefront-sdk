import "server-only";
import { headers } from "next/headers";
import { publicConfig } from "../config/public";
import { getStoreByHost } from "../stores/get-store-by-host";

/**
 * The store for routes outside /store/<ref> (robots, sitemap, icons, manifest,
 * root /api/auth). Single-store: the configured store. Multi-tenant: only the
 * Host can name it.
 */
export async function resolveRootStoreRef(): Promise<string | null> {
  const config = publicConfig();
  if (config.mode === "single") return config.storeRef;
  const host = (await headers()).get("host") || "";
  const { storeRef } = await getStoreByHost(host);
  return storeRef;
}
