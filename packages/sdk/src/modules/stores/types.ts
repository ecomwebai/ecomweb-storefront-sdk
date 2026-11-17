import type {
  Store,
  StoreConfig,
  StoreSettings,
  StoreStatus,
  CreateStore,
  UpdateStore,
  StorefrontMetafields,
} from "../../types";

/** The theme the storefront renders (themes spec §5.3); values are unvalidated. */
export interface PublishedStoreTheme {
  id: string | null;
  name: string;
  /** `external`: the merchant's own site serves the storefront. */
  kind: "hosted" | "custom" | "external";
  /** Where the theme runs; absent from APIs older than external themes. */
  hosting?: "ecomweb" | "external";
  /** The external site's URL (https, no trailing slash); external themes only. */
  external_url?: string | null;
  source_theme_id: string;
  /**
   * The catalog release in use, e.g. "1.0.0" (theme majors): the storefront
   * renders that major's current code. Null for builds and links, absent
   * from older APIs.
   */
  release_version?: string | null;
  values: Record<string, unknown>;
}

export type StoreConfigurationInfo = Store & {
  config: StoreConfig;
  settings: StoreSettings;
  theme?: PublishedStoreTheme;
  /** Shop metafields with storefront access (spec §6.4). */
  metafields?: StorefrontMetafields;
};

/** `GET /storefront/stores/domain/:domain`: the store a host serves. */
export type StoreByDomainInfo = StoreConfigurationInfo & {
  /**
   * The live theme's URL when it is external (the shared storefront sends
   * shoppers there), else null. Absent from APIs older than external themes.
   */
  storefront_url?: string | null;
  /**
   * Set when the host is a theme's preview host, p-<slug>: that theme is
   * shown there, never the live one. Absent from older APIs.
   */
  preview_slug?: string | null;
  /**
   * A short-lived (1 h) store preview token, sent back as `X-Store-Preview`
   * in place of the preview cookie. Set only on a theme's preview host,
   * p-<slug>, while the store is coming soon; null otherwise. Absent from
   * older APIs.
   */
  store_preview_token?: string | null;
};

export type {
  Store,
  StoreConfig,
  StoreSettings,
  StoreStatus,
  CreateStore,
  UpdateStore,
};
