import type { MetafieldType } from "./metafield-engine";

/**
 * Metafields as the public and customer APIs return them (spec §6.4): only
 * definitions with storefront (or customer) access, keyed "namespace.key",
 * with references already resolved (spec §6.5).
 */
export interface StorefrontMetafield<V = unknown> {
  type: MetafieldType;
  value: V;
}

export type StorefrontMetafields = Record<string, StorefrontMetafield>;

export interface WithMetafields {
  metafields?: StorefrontMetafields;
}

/** One write in a customer PUT. `value: null` clears the metafield. */
export interface MetafieldWrite {
  namespace: string;
  key: string;
  value: unknown;
}

// ─── Resolved references (spec §6.5) ────────────────────────────

export interface ResolvedImage {
  url: string;
  alt: string | null;
  width: number | null;
  height: number | null;
}

/** file, image and video values. */
export interface ResolvedAsset extends ResolvedImage {
  mime_type: string;
}

export interface ResolvedProductRef {
  id: string;
  name: string;
  slug: string | null;
  image_url: string | null;
  min_price: number | null;
  max_price: number | null;
  available: boolean;
}

export interface ResolvedVariantRef {
  id: string;
  product_id: string;
  product_slug: string | null;
  /** Option values joined with " / ", e.g. "Red / M". */
  title: string;
  price: number;
  image_url: string | null;
  available: boolean;
}

export interface ResolvedCollectionRef {
  id: string;
  name: string;
  slug: string;
  image_url: string | null;
}

export interface ResolvedPageRef {
  id: string;
  title: string;
  slug: string;
}

export interface ResolvedBlogPostRef {
  id: string;
  title: string;
  slug: string;
  featured_image_url: string | null;
  published_at: string | null;
}

/** A metaobject reference beyond the resolution depth (2). */
export interface ResolvedMetaobjectStub {
  type: string;
  handle: string;
}

export interface ResolvedMetaobjectRef extends ResolvedMetaobjectStub {
  display_name: string;
  fields: StorefrontMetafields;
}

export interface StorefrontMetaobjectEntry extends ResolvedMetaobjectRef {
  updated_at: string;
}
