# @ecomweb/sdk

## 0.14.0

### Minor Changes

- 33b6dc9: Version reporting and update warnings.
  - Every SDK request sends `X-Ecomweb-Client: @ecomweb/sdk/<version>`, so the platform can tell which kit and SDK a store runs and warn the owner when it falls behind. `createEcomwebSdk({ clientInfo })` puts your own `name/version` tokens first; the kit passes `@ecomweb/storefront-kit/<version>`. New exports: `SDK_VERSION`, `SDK_CLIENT_TOKEN`, `CLIENT_HEADER`, `clientHeaderValue()`, `withClientHeader()`.
  - `checkClientVersions({ phase, apiUrl })` (`@ecomweb/storefront-kit/config`): on `next build` only, asks the platform which versions are supported and prints a warning when the installed kit or SDK is behind, with a stronger one for security updates. 2 s timeout, never fails the build; `ECOMWEB_SKIP_VERSION_CHECK=1` turns it off. Also exported: `KIT_VERSION`, `KIT_CLIENT_TOKEN`, `formatClientVersionWarning()`.
  - Ejected storefronts: to get the build warning, make `next.config.mjs` export `async function config(phase) { await checkClientVersions({ phase, apiUrl: API_URL }); return nextConfig; }` (new projects already do).
  - The packages' source is now mirrored, read-only, at https://github.com/ecomwebai/ecomweb-storefront-sdk; report issues there.

## 0.13.1

### Patch Changes

- 92b6565: Client side of the API security fixes; works against older APIs too.
  - Email-proof bindings (F10): the auth route keeps register's `verification_binding` and change-email's `confirmation_binding` in httpOnly cookies and sends them as `binding` on `verify-email` and `change-email/confirm`, then clears them. `AuthApi.verifyEmail(token, binding?)` and `confirmEmailChange(token, binding?)` take the binding; new `RegisterResult` and `ChangeEmailResult` types.
  - Checkout sends `promotion_code` with `promotion_id` (F12); `CreateOrderRequest` gains `promotion_code?`.
  - Copy for `PROMOTION_IDENTITY_REQUIRED` (F18); checkout keeps the code so the shopper can add an email and retry.
  - `BlogComment.author_email` is optional (the public API no longer returns it); creating a comment still requires it.

## 0.13.0

### Minor Changes

- ce1fe24: `orders.lookupGuest()` now returns the order, or `null` when no order matches, instead of a `{ order, found }` object the API never sent. `GuestOrderLookupResult` is removed. The guest order lookup hook no longer treats a "not found" reply as an order.

### Patch Changes

- 228c936: `cart.merge()` is now typed `CartApiResponse | { merged: false }`: the API answers `{ merged: false }` when neither cart exists.
- c2d8aaa: `Store.user_id` is now optional (deprecated): the public store endpoints stopped sending it, so `storeSchema` no longer rejects a store without it.

## 0.12.1

No changes in this release.

## 0.12.0

### Minor Changes

- 71bcbd5: The subdomain redirects to a custom domain only once that domain is verified. The SDK `StoreConfig` gains optional `verified`; `getStoreByHost` reports `domain` only when it is true, and the 301 now carries `Cache-Control: public, max-age=3600`.

### Patch Changes

- ab6499f: Sign-in: `AUTH_ACCOUNT_DISABLED` (the merchant marked the customer inactive) is a known `AuthErrorCode` and `errorCopy` has Vietnamese copy for it.
- 020e29b: Catalog and content fixes. The SDK's `StoreSettings` gains optional `blog_description`, `posts_per_page` and `allow_comments`. The kit adds `useBankTransferDetails`, `shouldShowBankTransferDetails` and `pickBankTransfer` (bank transfer details for any unpaid bank transfer order, not just through the checkout handoff; `useOrderStatus` now uses them), Vietnamese copy for `BLOG_COMMENTS_DISABLED`, and the middleware keeps a redirect destination's own query string instead of percent-encoding its `?`.
- a91dd20: Lint cleanup with no runtime change: an unused import removed, a regex escape simplified to the same pattern, and targeted lint comments.

## 0.11.0

### Minor Changes

- 3addebf: Coming soon stores. A store its merchant has not opened yet now shows a "Sắp ra mắt" page (store name, `noindex`, an empty sitemap) instead of the 404 or error page, and the dashboard's preview link lets the merchant see the real store meanwhile. This is kit 0.11.0.

  **SDK**
  - `Store` gains optional `coming_soon` and `first_opened_at`.
  - `stores.getByDomain(domain, options?)` takes request options. `StoreByDomainInfo` gains `store_preview_token`: on a theme preview host (`p-<slug>`), the token that lets that host read a coming soon store.
  - `stores.getById` and `redirects.lookup` take an optional `RequestOptions` (additive).

  **Kit**
  - Coming soon helpers: `isStoreComingSoonError`, `comingSoonStoreNameOf`, `STORE_COMING_SOON_REDIRECT_PATH` (`/coming-soon`), `comingSoonStoreMetadata` and `COMING_SOON_STORE_DESCRIPTION`. `withSuspendedStoreMetadataFallback` also returns coming soon metadata for a `STORE_COMING_SOON` error. `STORE_COMING_SOON` is added to `errorCopy`.
  - The middleware rewrites a coming soon store to `/coming-soon` (`noindex`), unless the request carries a valid preview token.
  - Store preview cookie and routes: `/preview?token=<t>` on the store's host (and `/store/<ref>/preview?token=<t>` on path-based localhost) sets the httpOnly `ecw_store_preview` cookie for 24 h (`__Host-` prefixed on host-mapped hosts in production) and redirects to the store's home.
  - `X-Store-Preview` is sent by every kit API client (server and browser) and by the backend proxy. The token is, in order: a theme preview host's (`p-<slug>`) token from its lookup, then the store preview cookie, then the theme preview cookie. So the theme editor and `deploy --draft` previews work for coming soon stores, and a `?preview_theme=` link on the store's own host opens the store too. The kit's own redirect and subdomain lookups never send a visitor's token, and its host lookup sends one only for a request that carries a preview cookie and never caches that answer, so a visitor's token never reaches a shared cache.
  - Server exports: `resolveComingSoonStore()` (is this request's store coming soon, and its name) and `readStorePreviewToken()`.
  - `StorefrontKitProvider` gains `storePreviewToken` (give the browser the token while the store is coming soon) and `onStorePreviewRenew` (renews a theme preview host's 1 h token).
  - Previews are read-only: cart writes and `placeOrder` are refused in the browser with a preview notice ("Đang xem trước: chưa thể đặt hàng khi cửa hàng chưa mở cửa.", exported as `STORE_PREVIEW_READ_ONLY_MESSAGE`, the message `placeOrder` returns), a refused write never redirects, and web vitals are not sent.

  Older kits (0.10.0 and below) show their 404 or error page for a coming soon store, never the real store. Ejected stores upgrade the kit to get the coming soon page in place of that page.

## 0.10.0

### Minor Changes

- 755afa8: Carrier-calculated shipping options (AllinGo) and shipment tracking.

  **SDK.** New types for carrier options: `ShippingOption` gains `option_id`,
  `carrier_code`, `carrier_service_id`, `carrier_name`, `carrier_service_name`,
  `carrier_logo_url` and
  `estimated_label`. The shipping calculation request takes an opt-in
  `include_carrier_options`; the SDK never defaults it. `CreateOrderRequest` gains
  `shipping_service_id` and `shipping_quoted_amount`, which `useCheckout` sends for a
  carrier option. `SHIPPING_ERROR_CODES` (including `RATE_UNAVAILABLE`, i.e.
  `ORDER_SHIPPING_RATE_UNAVAILABLE`) and `ShippingQuoteChangedDetails` describe the
  409 `SHIPPING_QUOTE_CHANGED` response. Orders gain `shipping_carrier`, `shipment`
  (`OrderShipmentSummary`, `OrderShipmentEvent`, `ShipmentStatus`) and `can_cancel`.

  **Kit.** `useCheckout` takes `includeCarrierOptions` (default `false`). New helpers:
  `optionIdOf`, `describeShippingOption`, `deriveShipmentTracking`, `canCustomerCancel`,
  `isHandedToCarrier`, `isCarrierShipment` and `shipmentEventLabel`. `placeOrder()` can now return `{ kind: "quote_changed" }`.
  The shipping state exposes `selectedOptionId`, `selectedOption` and `selectOption`.
  `RATE_SELECTED` and `selectRate` are deprecated in favour of option selection.

  `ORDER_ACTOR_TYPES` and `ORDER_EVENT_TYPES` (and their unions) widened: ejected
  stores with exhaustive switches over them must add the new cases. Also new:
  `ORDER_SHIPMENT_ERROR_CODES`, `SHIPMENT_STATUS_LABELS`, `TRACKING_MESSAGES` and
  `quoteChangedOptionsFrom`.
  On `quote_changed` the new amounts are merged into the option list by option id (other
  options are kept); on `ORDER_SHIPPING_RATE_UNAVAILABLE` the kit re-quotes the options.

  **Without the opt-in nothing changes**: stores that do not pass
  `includeCarrierOptions` get the same fixed rates as before.

  **Migration for ejected stores that want carrier options**
  1. Pass `includeCarrierOptions: true` to `useCheckout`.
  2. Key and select options by `optionIdOf(option)` instead of `rate_id`. Stores that
     keep keying by `rate_id` only work with fixed rates until they adopt `option_id`.
  3. Render each option with `describeShippingOption` (name, carrier, estimate). Logo
     and tracking links are `http(s)` only.
  4. Handle `kind: "quote_changed"` from `placeOrder()`: the options were replaced
     with the current ones, nothing was placed, and the buyer must re-confirm the new
     price before submitting again.
  5. On the order page, use `deriveShipmentTracking`, `canCustomerCancel` and
     `isHandedToCarrier` instead of re-implementing the cancel and tracking rules.

## 0.9.0

### Minor Changes

- 2e5cb42: `Collection.type` is now `"manual" | "smart"`, the names the API sends (it never sent `"automated"`), and a manual collection's `product_ids?: number[]` is typed.
- aff621d: Themes can now render the product, collection, content page, blog index and blog post pages (new slots `ProductPage`, `CollectionPage`, `ContentPage`, `BlogIndex`, `BlogPost`), and declare client components (`ProductCard`, `NotFound`) through `ThemeClientComponents`. Adds `useOptionalThemeId()`.
- d7fdc2d: Banners and the shop introduction are default theme settings (default@1.1.0). Breaking: `sdk.banners`, the `Banner` types and `StoreConfigurationInfo.settings.shop_introduction` are removed, and `HomePageSlotProps` no longer has `banners`. Read `settings.banner_N_image`, `banner_N_link`, `banner_N_alt` and `settings.shop_introduction` instead. The API keeps serving the old endpoint and field for a deprecation window.
- 87e4a06: Theme majors: `themeMajor`, the migration format (`ThemeMigrationStep`, `ThemeMigration`, `ThemeMigrationReport`, `themeMigrationSchema`, `parseThemeMigration`) and `applyThemeMigration`; `PublishedStoreTheme.release_version`.

### Patch Changes

- b09fbf0: `placeOrder`'s `error` result carries the API's `code`, and `errorCopy` has Vietnamese copy for `ORDER_PROMOTION_NOT_APPLICABLE`, which the API now returns instead of placing the order without the discount the shopper was shown. On that code `useCheckout` also removes the applied promotion, so the next attempt shows and charges the real total. `OrderTimelineActor` gains an optional `email` (set for staff actors).

## 0.8.0

### Minor Changes

- 0cd5112: Theme preview hosts: every store theme previews at its own `p-<slug>.<platform domain>`. On such a host the multi-tenant middleware renders the store without redirecting to its custom domain, names the slug to the page (`readPreviewHostSlug()` from `@ecomweb/storefront-kit/server`; a client-sent header is always dropped), marks every response `noindex`, serves a disallow-all `robots.txt` and no sitemap. The editor's `?preview_theme=` token still works there, for its unsaved values. SDK: `themes.getPreviewBySlug(storeRef, slug)`, and `preview_slug` on the store-by-domain lookup.

## 0.7.0

No changes in this release.

## 0.6.0

### Minor Changes

- 4473f76: External themes: `PublishedStoreTheme.kind` may be `"external"` and gains optional `hosting` and `external_url`; `sdk.stores.getByDomain` returns `StoreByDomainInfo`, whose optional `storefront_url` is the live external theme's URL (null otherwise).
- 8fc7b6b: Theme schemas accept `blog_post`, `blog_category`, `blog_tag` and `product` settings: the merchant picks a post, a post category, a post tag or a product, and the value is its slug (null until chosen), like `collection` and `page`.
- 14bb677: Theme schemas accept a `page` setting: the merchant picks one of the store's content pages and the value is that page's slug (null until chosen), like `collection`.

## 0.5.0

### Minor Changes

- 979fedb: Metafields and metaobjects: the metafield type engine (`validateMetafieldValue`, `validateRichText`, `validateMetafieldDefinition`, `validateMetaobjectDefinition`, `validateMetaobjectEntry`), storefront metafield types on product, variant, collection, content page, blog post, store and customer order responses, `sdk.metaobjects.list/get`, and `sdk.customers.getMetafields/updateMetafields`.

## 0.4.0

### Minor Changes

- a559112: Themes P5: the page builder's `theme_config` is gone.
  - SDK: removes the storefront-builder schemas and types (`builderThemeConfigSchema`, `BuilderThemeConfig`, the header/footer and section schemas, `SECTION_CONFIG_SCHEMAS`, `WIDGET_REGISTRY`, `parseSectionContent`, `themeVersionSchema`/`ThemeVersion`), `themeConfigSchema`, `ThemeConfig`, and `theme_config` on `StoreSettings`, `StoreConfigurationInfo` and `storeWithRelationsSchema`. Adds `legalLinksSchema` and `legal_links` on the store settings schema.
  - Kit: `readBasicSettings` now returns only `{ legalLinks }`, read from `store.settings.legal_links`, and is deprecated.

  Migration: read theme settings (menus, top bar, footer text, homepage collection, colors) with `useThemeSettings`, or from `store.theme.values`; read the checkout links from `store.settings.legal_links`.

## 0.3.0

### Minor Changes

- 9789634: Theme contract: setting types, `validateThemeValues` and `resolveThemeSettings` (SDK); `defineSchema`, `defineTheme`, `ThemeSettingsProvider`, `useThemeSettings` and `ThemeStyle` (kit).
- 358b783: Themes P2: `store.theme` and `sdk.themes.getPreview` (SDK); theme preview cookies in the middleware and `readThemePreviewToken` (kit).

## 0.2.0

### Minor Changes

- 1f8540d: First public release: the storefront API client (`@ecomweb/sdk`) and the
  headless storefront kit (`@ecomweb/storefront-kit`): auth, cart, checkout,
  order status, API proxy and middleware for multi-tenant and single-store
  storefronts.
