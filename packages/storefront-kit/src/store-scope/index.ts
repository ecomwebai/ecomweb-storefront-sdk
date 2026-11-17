import { publicConfig } from "../config/public";

/**
 * The one place that knows which store a request serves and what its URLs look
 * like.
 * - multi: every store lives under /store/<ref>, the ref comes from the route.
 * - single: the store (ECOMWEB_STORE_REF) is the whole site, so pages live at
 *   the root and same-origin API routes under /api.
 */

const isSingle = () => publicConfig().mode === "single";

/**
 * Finds the ref of the store a request serves. In single-store mode it is
 * `ECOMWEB_STORE_REF`; in multi-store mode it comes from the route's
 * `storeRef` param.
 *
 * @param params - The page's `params` promise; only read in multi-store mode.
 * @returns The store ref.
 */
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

/**
 * Builds a page path for a store: `/store/<ref>/…` in multi-store mode, the
 * path from the site root in single-store mode.
 *
 * @param storeRef - The store's ref.
 * @param path - Path under the store, such as `/cart`; defaults to its home.
 * @returns The path to link to.
 */
export function storePath(storeRef: string, path = ""): string {
  if (isSingle()) {
    const p = normalize(path);
    return p.startsWith("/") ? p : `/${p}`;
  }
  return multiTenantStorePath(storeRef, path);
}

/**
 * Builds the path of the storefront's own API routes for a store:
 * `/store/<ref>/api/…` in multi-store mode, `/api/…` in single-store mode.
 *
 * @param storeRef - The store's ref.
 * @param subpath - Route under the API prefix, such as `auth/session`.
 * @returns The path to request.
 */
export function storeApiPath(storeRef: string, subpath: string): string {
  const rest = subpath.replace(/^\/+/, "");
  if (isSingle()) return `/api/${rest}`;
  return `/store/${encodeURIComponent(storeRef)}/api/${rest}`;
}
