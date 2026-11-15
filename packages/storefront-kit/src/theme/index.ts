// @ecomweb/storefront-kit/theme: authoring a theme (schema, definition, slot
// types). No side effects, so build tools such as CI's theme export can import
// it without a storefront configuration.
export { defineSchema, defineTheme } from "./define";
export type {
  AnyThemeDefinition,
  BlogIndexSlotProps,
  BlogPostSlotProps,
  CollectionPageSlotProps,
  CollectionSearchParams,
  ContentPageSlotProps,
  NotFoundProps,
  ProductCardProps,
  ProductPageSlotProps,
  ThemeClientComponents,
  HomePageSlotProps,
  LayoutSlotProps,
  ThemeComponents,
  ThemeDefinition,
  ThemeInfo,
  ThemeSlot,
  ThemeSlotName,
  ThemeSlotProps,
} from "./define";
