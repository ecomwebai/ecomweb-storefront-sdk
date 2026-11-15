import type { ComponentType, ReactNode } from "react";
import type {
  BlogCategory,
  BlogPost,
  Collection,
  ContentPage,
  Product,
  ProductDetail,
  ProductWithVariants,
  SearchProduct,
  StoreConfigurationInfo,
  ThemeSchema,
  ThemeSettingsOf,
} from "@ecomweb/sdk";

/**
 * The theme contract (spec: schema-driven themes §5.2). A theme declares its
 * settings with `defineSchema` and fills the slots the shared routes render.
 * Routes load data through the kit and pass it in: a theme is presentation.
 */

export function defineSchema<const S extends ThemeSchema>(schema: S): S {
  return schema;
}

export interface ThemeInfo {
  id: string;
  name: string;
  version: string;
  author: string;
}

/** A slot may be a server component (async) or a plain one. */
export type ThemeSlot<P> = (props: P) => ReactNode | Promise<ReactNode>;

export interface ThemeSlotProps<V> {
  store: StoreConfigurationInfo;
  storeRef: string;
  settings: V;
}

export interface LayoutSlotProps<V> extends ThemeSlotProps<V> {
  children: ReactNode;
}

/** Banners and the shop introduction are theme settings (default@1.1.0). */
export type HomePageSlotProps<V> = ThemeSlotProps<V>;

export interface ProductPageSlotProps<V> extends ThemeSlotProps<V> {
  product: ProductDetail;
}

/** The collection route's query string, as the filters read it. */
export interface CollectionSearchParams {
  q?: string;
  category?: string;
  page?: string;
  sort?: string;
  min_price?: string;
  max_price?: string;
  has_promotion?: string;
}

export interface CollectionPageSlotProps<V> extends ThemeSlotProps<V> {
  slug: string;
  /** Null for the "all" pseudo-collection. */
  collection: Collection | null;
  searchParams: CollectionSearchParams;
}

export interface ContentPageSlotProps<V> extends ThemeSlotProps<V> {
  page: ContentPage;
  isPreview: boolean;
}

export interface BlogIndexSlotProps<V> extends ThemeSlotProps<V> {
  blogTitle: string;
  posts: BlogPost[];
  categories: BlogCategory[];
  total: number;
  page: number;
  totalPages: number;
  /** Category id filter from the query string, "" when none. */
  category: string;
  search: string;
}

export interface BlogPostSlotProps<V> extends ThemeSlotProps<V> {
  blogTitle: string;
  post: BlogPost;
  /** The post's linked products, in the post's order. */
  products: SearchProduct[];
}

export interface ThemeComponents<V> {
  Layout?: ThemeSlot<LayoutSlotProps<V>>;
  HomePage?: ThemeSlot<HomePageSlotProps<V>>;
  ProductPage?: ThemeSlot<ProductPageSlotProps<V>>;
  CollectionPage?: ThemeSlot<CollectionPageSlotProps<V>>;
  ContentPage?: ThemeSlot<ContentPageSlotProps<V>>;
  BlogIndex?: ThemeSlot<BlogIndexSlotProps<V>>;
  BlogPost?: ThemeSlot<BlogPostSlotProps<V>>;
}

/**
 * Components rendered inside client components, so they cannot be resolved
 * on the server per request. The app keeps a registry keyed by theme id.
 */
export interface ProductCardProps {
  product: Product | ProductWithVariants | SearchProduct;
  storeRef?: string;
}

export interface NotFoundProps {
  /** Null when the store itself was not found. */
  storeRef: string | null;
}

export interface ThemeClientComponents {
  ProductCard?: ComponentType<ProductCardProps>;
  NotFound?: ComponentType<NotFoundProps>;
}

export type ThemeSlotName = keyof ThemeComponents<unknown>;

export interface ThemeDefinition<S extends ThemeSchema = ThemeSchema> {
  info: ThemeInfo;
  schema: S;
  components: ThemeComponents<ThemeSettingsOf<S>>;
  /** CSS custom properties for :root, from the resolved settings. */
  styles?: (settings: ThemeSettingsOf<S>) => Record<string, string>;
}

/**
 * A theme of unknown schema, as the registry holds it. Its slots are called
 * with settings resolved against its own schema.
 */
export interface AnyThemeDefinition {
  info: ThemeInfo;
  schema: ThemeSchema;
  components: ThemeComponents<any>;
  styles?: (settings: any) => Record<string, string>;
}

export function defineTheme<const S extends ThemeSchema>(
  theme: ThemeDefinition<S>
): ThemeDefinition<S> {
  return theme;
}
