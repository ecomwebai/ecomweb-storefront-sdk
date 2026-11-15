import type { StoreConfig, StoreConfigurationInfo } from "@ecomweb/sdk";
import { publicConfig } from "../config/public";

/**
 * Build store URL based on environment and store configuration
 * @param store - Store object with subdomain and custom_domain
 * @param path - Optional path to append to the store URL
 * @returns Complete store URL
 *
 * @example
 * // Local development
 * buildStoreUrl({ id: 1, subdomain: 'mystore', custom_domain: null })
 * // Returns: 'http://localhost:3000/store/1'
 *
 * // Production with subdomain
 * buildStoreUrl({ id: 1, subdomain: 'mystore', custom_domain: null })
 * // Returns: 'https://mystore.{NEXT_PUBLIC_PLATFORM_DOMAIN_SUFFIX}'
 *
 * // Production with custom domain
 * buildStoreUrl({ id: 1, subdomain: 'mystore', custom_domain: 'mystore.com' })
 * // Returns: 'https://mystore.com'
 *
 * // With path
 * buildStoreUrl({ id: 1, subdomain: 'mystore', custom_domain: null }, 'about')
 * // Returns: 'https://mystore.{NEXT_PUBLIC_PLATFORM_DOMAIN_SUFFIX}/about'
 */
export function buildStoreUrl(
  store:
    | { ref: string; subdomain: string | null; custom_domain: string | null }
    | StoreConfig
    | StoreConfigurationInfo,
  path?: string
): string {
  const config = publicConfig();
  // Single-store: an absolute URL on this site; `store` is ignored.
  if (config.mode === "single") {
    if (!path) return config.appUrl;
    return `${config.appUrl}/${path.replace(/^\/+/, "")}`;
  }

  // Callers pass both "login" and "/login"; the base never ends in a slash.
  const subpath = (path ?? "").replace(/^\/+/, "");

  const isLocal = config.appBaseUrlFlag === "local";
  let subdomain = "";
  let custom_domain = "";
  let store_ref = "";

  if ("ref" in store && "subdomain" in store && "custom_domain" in store) {
    subdomain = store.subdomain || "";
    custom_domain = store.custom_domain || "";
    store_ref = (store as any).ref || "";
  } else if ("config" in store && store.config) {
    subdomain = store.config.subdomain || "";
    custom_domain = store.config.custom_domain || "";
    store_ref = (store as any).ref || "";
  } else if ("subdomain" in store && "custom_domain" in store) {
    subdomain = store.subdomain || "";
    custom_domain = store.custom_domain || "";
    store_ref = (store as any).ref || "";
  }

  if (isLocal) {
    // Server-only var, so the browser always gets the dev default (as before).
    const origin =
      (typeof window === "undefined" && process.env.APP_BASE_URL?.trim()) ||
      "http://localhost:3002";
    const baseUrl = `${origin}/store/${store_ref}`;
    return subpath ? `${baseUrl}/${subpath}` : baseUrl;
  }

  if (custom_domain) {
    const baseUrl = `https://${custom_domain}`;
    return subpath ? `${baseUrl}/${subpath}` : baseUrl;
  }

  if (subdomain) {
    const platformDomain = config.platformDomainSuffix ?? "ecomsite.app";
    const baseUrl = `https://${subdomain}.${platformDomain}`;
    return subpath ? `${baseUrl}/${subpath}` : baseUrl;
  }

  // Fallback: use store ref format
  const baseUrl = `/store/${store_ref}`;
  return subpath ? `${baseUrl}/${subpath}` : baseUrl;
}
