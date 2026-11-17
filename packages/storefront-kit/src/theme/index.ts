/**
 * Authoring a theme: `defineSchema`, `defineTheme` and the slot prop types.
 * No side effects, so build tools such as CI's theme export can import it
 * without a storefront configuration.
 *
 * Import from `@ecomweb/storefront-kit/theme` in a theme's source files.
 *
 * @packageDocumentation
 */
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
