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

/** @deprecated Read `store.settings.legal_links` directly. */
export function readBasicSettings(store: StoreLike): BasicSettings {
  const legal: Loose = store.settings?.legal_links ?? {};
  return {
    legalLinks: {
      termsLink: str(legal.terms),
      policyLink: str(legal.privacy),
    },
  };
}

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
