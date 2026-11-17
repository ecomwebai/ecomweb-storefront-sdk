/**
 * The store's checkout and register legal links, from `settings.legal_links`.
 * Everything else the page builder's theme_config held is a theme setting
 * now (`useThemeSettings`).
 */

type Loose = Record<string, any>;

export interface StoreLike {
  settings?: Loose | null;
}

export interface BasicSettings {
  legalLinks: { termsLink: string | null; policyLink: string | null };
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

/**
 * Reads the store's terms and privacy links from its settings.
 *
 * @param store - A store with a `settings` object.
 * @returns The links, `null` where the store sets none.
 * @deprecated Read `store.settings.legal_links` directly.
 */
export function readBasicSettings(store: StoreLike): BasicSettings {
  const legal: Loose = store.settings?.legal_links ?? {};
  return {
    legalLinks: {
      termsLink: str(legal.terms),
      policyLink: str(legal.privacy),
    },
  };
}

/**
 * Turns a legal link into the URL to put in an anchor. A full URL is kept; a
 * path is made store-relative.
 *
 * @param link - The store's own link, or `null`.
 * @param fallbackPath - Path to use when the store sets no link.
 * @param toStoreUrl - Builds a store URL from a path, for example with {@link storePath}.
 * @returns The URL, or `#` when there is neither link nor fallback.
 */
export function resolveLegalHref(
  link: string | null,
  fallbackPath: string | null,
  toStoreUrl: (path: string) => string
): string {
  const target = link ?? fallbackPath;
  if (!target) return "#";
  if (/^https?:\/\//i.test(target)) return target;
  return toStoreUrl(target.startsWith("/") ? target : `/${target}`);
}
