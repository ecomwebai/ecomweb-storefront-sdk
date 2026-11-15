import { sdk } from "../sdk";
import { isStoreSuspendedError } from "./store-suspension";
import {
  comingSoonStoreNameOf,
  isStoreComingSoonError,
} from "./store-coming-soon";
import {
  SKIP_STORE_PREVIEW,
  STORE_PREVIEW_HEADER,
} from "./store-preview-cookie";
import { publicConfig } from "../config";
import { TtlCache } from "./ttl-cache";

type StoreByHost = Awaited<ReturnType<typeof getStoreByHost>>;

/**
 * How long a lookup is reused in this process. A merchant's change (custom
 * domain, external theme, suspension) reaches shoppers within this window on
 * top of the API's own Redis cache. Misses and suspensions expire sooner so
 * a new or re-enabled store shows up quickly. A failed lookup (API down) is
 * never cached: it would turn a blip into a run of 404s. Neither is a lookup
 * made with a preview token: its answer is that previewer's, not the public's.
 */
const FOUND_TTL_MS = 30_000;
const NOT_FOUND_TTL_MS = 10_000;
const MAX_HOSTS = 10_000;

const byHost = new TtlCache<StoreByHost>(MAX_HOSTS);

/** Tests only: forget every cached lookup. */
export function clearStoreByHostCache(): void {
  byHost.clear();
}

/**
 * The store's subdomain label when `hostname` is `<label>.<platformDomain>`
 * (a single label, so `www.shop.<platform>` and `shop.evil<platform>` are
 * not subdomains), else null.
 */
function platformSubdomain(
  hostname: string,
  platformDomain: string
): string | null {
  const suffix = `.${platformDomain}`;
  if (!hostname.endsWith(suffix)) return null;
  const label = hostname.slice(0, -suffix.length);
  return label && !label.includes(".") ? label : null;
}

/**
 * Get store ref and domain info from host
 * Used by middleware and API routes to determine which store is being accessed
 *
 * With `previewToken` (a store or theme preview token), the token is sent as
 * `X-Store-Preview`, which opens a coming soon store, and the cache is
 * neither read nor written. Without one the lookup is the public answer for
 * the host: it is cached, and it carries `SKIP_STORE_PREVIEW` so the API
 * client never attaches the request's ambient preview token to it.
 */
export async function getStoreByHost(
  host: string,
  options?: { previewToken?: string | null }
): Promise<{
  storeRef: string | null;
  domain: string | null;
  isSubDomain: boolean;
  // True when the backend identified a store for this host but rejected it
  // with STORE_SUSPENDED. There is no `ref` to route on in that case — the
  // 403 response carries no store-identifying payload — so the caller must
  // handle this without a storeRef (see proxy.ts, which rewrites to a
  // platform-level suspended page rather than `/store/<ref>`).
  suspended: boolean;
  // The live theme's URL when it is external (`storefront_url`), else null.
  // Null too when the API predates external themes.
  externalUrl: string | null;
  // A theme's preview host, p-<slug> (theme preview hosts): its slug.
  previewSlug: string | null;
  // True when the backend identified a store for this host but rejected it
  // with STORE_COMING_SOON: the merchant has not opened it yet. Like
  // `suspended`, there is no `ref` to route on, because the 403 carries only
  // `details.name`; the caller handles it without a storeRef (proxy.ts
  // rewrites to the platform-level coming soon page). A lookup with a valid
  // preview token gets the store instead.
  comingSoon: boolean;
  // The store's name from that 403's `details.name`, else null.
  comingSoonName: string | null;
  // On a theme's preview host only (previewSlug set): the API's short-lived
  // store preview token for a coming soon store, sent as X-Store-Preview in
  // place of the cookie on that host. Null everywhere else. It is cached
  // with the lookup, because the p-<slug> host is itself the capability, and
  // 30 s is far inside the token's 1 h.
  storePreviewToken: string | null;
}> {
  if (host.includes("localhost") || host.includes("127.0.0.1")) {
    return {
      storeRef: null,
      domain: null,
      isSubDomain: false,
      suspended: false,
      externalUrl: null,
      previewSlug: null,
      comingSoon: false,
      comingSoonName: null,
      storePreviewToken: null,
    };
  }

  const previewToken = options?.previewToken || null;
  const key = host.toLowerCase();
  if (!previewToken) {
    const cached = byHost.get(key);
    if (cached) return cached;
  }

  let storeRef: string | null = null;
  let domain: string | null = null;
  let suspended = false;
  let externalUrl: string | null = null;
  let previewSlug: string | null = null;
  let comingSoon = false;
  let comingSoonName: string | null = null;
  let storePreviewToken: string | null = null;

  let failed = false;

  const hostname = key.split(":")[0]!;
  const platformDomain = (
    publicConfig().platformDomainSuffix ?? "ecomsite.app"
  ).toLowerCase();
  const subdomain = platformSubdomain(hostname, platformDomain);
  const isSubDomain = subdomain !== null;

  try {
    const lookupValue = subdomain ?? host;
    const foundStore = await sdk.stores.getByDomain(
      lookupValue,
      previewToken
        ? { headers: { [STORE_PREVIEW_HEADER]: previewToken } }
        : SKIP_STORE_PREVIEW
    );

    if (foundStore?.ref) {
      storeRef = foundStore.ref;
      // Only a verified custom domain: the subdomain redirects to `domain`,
      // and before DNS works that would take the store offline.
      domain =
        foundStore.config?.verified === true
          ? foundStore.config.custom_domain || null
          : null;
      externalUrl = foundStore.storefront_url || null;
      previewSlug = foundStore.preview_slug || null;
      // Never taken from a non-preview host.
      storePreviewToken = previewSlug
        ? foundStore.store_preview_token || null
        : null;
    }
  } catch (error) {
    if (isStoreSuspendedError(error)) {
      suspended = true;
    } else if (isStoreComingSoonError(error)) {
      comingSoon = true;
      comingSoonName = comingSoonStoreNameOf(error);
    } else {
      failed = true;
      console.error("Store not found for host:", host);
    }
  }

  const result = {
    storeRef,
    domain,
    isSubDomain,
    suspended,
    externalUrl,
    previewSlug,
    comingSoon,
    comingSoonName,
    storePreviewToken,
  };
  if (!failed && !previewToken) {
    byHost.set(key, result, storeRef ? FOUND_TTL_MS : NOT_FOUND_TTL_MS);
  }
  return result;
}
