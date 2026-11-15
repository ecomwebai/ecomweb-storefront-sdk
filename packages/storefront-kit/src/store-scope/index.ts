import { publicConfig } from "../config/public";

/**
 * The one place that knows which store a request serves and what its URLs look
 * like.
 * - multi: every store lives under /store/<ref>, the ref comes from the route.
 * - single: the store (ECOMWEB_STORE_REF) is the whole site, so pages live at
 *   the root and same-origin API routes under /api.
 */

const isSingle = () => publicConfig().mode === "single";

export async function resolveStoreRef(
  params?: Promise<{ storeRef?: string }>
): Promise<string> {
  if (isSingle()) return publicConfig().storeRef as string;
  const { storeRef } = (await params) ?? {};
  return storeRef as string;
}

function normalize(path: string): string {
  if (!path) return "";
  return path.startsWith("/") || path.startsWith("?") || path.startsWith("#")
    ? path
    : `/${path}`;
}

/** The multi-tenant path, whatever the configured mode (middleware uses it). */
export function multiTenantStorePath(storeRef: string, path = ""): string {
  return `/store/${encodeURIComponent(storeRef)}${normalize(path)}`;
}

export function storePath(storeRef: string, path = ""): string {
  if (isSingle()) {
    const p = normalize(path);
    return p.startsWith("/") ? p : `/${p}`;
  }
  return multiTenantStorePath(storeRef, path);
}

export function storeApiPath(storeRef: string, subpath: string): string {
  const rest = subpath.replace(/^\/+/, "");
  if (isSingle()) return `/api/${rest}`;
  return `/store/${encodeURIComponent(storeRef)}/api/${rest}`;
}
