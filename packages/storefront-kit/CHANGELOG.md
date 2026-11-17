# @ecomweb/storefront-kit

## 0.15.0

### Minor Changes

- c894e03: Storefront secret keys. Breaking: `createEcomwebSdk` now returns the catalog and content modules only; cart, orders, payments, customers, addresses and the private review, shipping-quote, promotion-code and blog-comment methods live on `createEcomwebServerSdk({ ..., secretKey })` and `createEcomwebProxiedSdk({ publicHttp, proxyHttp })`. The kit signs server calls with `PLATFORM_SECRET_KEY` (shared app) or `ECOMWEB_SECRET_KEY` (single store, server env only; server-side `PLATFORM_API_KEY` is retired), sends every private browser call through the store's backend proxy, locks that proxy to listed private routes, the served store and same-origin callers, refuses `sk_` values in `NEXT_PUBLIC_*`, and adds `ecomweb-check-client-bundle` to fail a build that leaks a secret. The kit entry points also export the `EcomwebSdk` and `EcomwebServerSdk` types (from the root and `/server` entry points). The SDK now calls `/storefront/stores/...`, and the API no longer serves the old `/public/stores/...`, `/tenant/stores/...` or `/stores/<ref>/cart` storefront routes (they answer 404). The signed-in shopper cart is `/storefront/stores/<ref>/customers/cart`. The kit supports API 3.x servers that ship the `/storefront/` routes; kits older than 0.15.0 stop working against them.

  Upgrading an ejected storefront to 0.15.0:
  1. Create a storefront secret key (`sk_storefront_...`) in the dashboard.
  2. Set it as `ECOMWEB_SECRET_KEY` at run time, in the server's environment only: never as a `NEXT_PUBLIC_*` variable, a Dockerfile `ARG`/`ENV`, a `next.config` `env` entry or a committed `.env`. The build needs no secret; the server refuses to start without one.
  3. Delete `PLATFORM_API_KEY` from your environment and code; it is retired.
  4. Add the bundle check to the `build` script: `"build": "next build && ecomweb-check-client-bundle"`.
  5. Move every `sdk.cart`, `sdk.orders`, `sdk.payments`, `sdk.customers` and `sdk.addresses` call, and the private `sdk.reviews` (invitations, submissions), `sdk.shipping.calculate`, `sdk.promotions.validate` and `sdk.blog.submitComment` calls, off the module `sdk`: to `createStoreSdk(storeRef)` in client code, or to `await getServerSdk()` (`@ecomweb/storefront-kit/server`) in server components and route handlers. Left on `sdk`, they are type errors. Calls that need the signed-in shopper (their cart, orders, account and addresses) work only through `createStoreSdk` in the browser; on `getServerSdk()` they fail with `SDK_SHOPPER_CALL_ON_SERVER`.
  6. Replace any hand-built `/public/stores/`, `/tenant/stores/` or `/stores/<ref>/cart` URL in your own code with `/storefront/stores/` (signed-in cart: `/storefront/stores/<ref>/customers/cart`). In an ejected theme that means `lib/blog/api-client.ts`, `lib/sitemap/api-client.ts` and `components/web-vitals-reporter.tsx` (the web-vitals POST is now `/storefront/stores/<ref>/web-vitals`).

### Patch Changes

- Updated dependencies [c894e03]
  - @ecomweb/sdk@0.15.0

## 0.14.1

### Patch Changes

- 55fe4dc: TSDoc on the SDK's client methods and the kit's hooks, components and server helpers, so your editor and the SDK reference at developers.ecomweb.app explain them. No code changes.
- Updated dependencies [55fe4dc]
  - @ecomweb/sdk@0.14.1

## 0.14.0

### Minor Changes

- 33b6dc9: Version reporting and update warnings.
  - Every SDK request sends `X-Ecomweb-Client: @ecomweb/sdk/<version>`, so the platform can tell which kit and SDK a store runs and warn the owner when it falls behind. `createEcomwebSdk({ clientInfo })` puts your own `name/version` tokens first; the kit passes `@ecomweb/storefront-kit/<version>`. New exports: `SDK_VERSION`, `SDK_CLIENT_TOKEN`, `CLIENT_HEADER`, `clientHeaderValue()`, `withClientHeader()`.
  - `checkClientVersions({ phase, apiUrl })` (`@ecomweb/storefront-kit/config`): on `next build` only, asks the platform which versions are supported and prints a warning when the installed kit or SDK is behind, with a stronger one for security updates. 2 s timeout, never fails the build; `ECOMWEB_SKIP_VERSION_CHECK=1` turns it off. Also exported: `KIT_VERSION`, `KIT_CLIENT_TOKEN`, `formatClientVersionWarning()`.
  - Ejected storefronts: to get the build warning, make `next.config.mjs` export `async function config(phase) { await checkClientVersions({ phase, apiUrl: API_URL }); return nextConfig; }` (new projects already do).
  - The packages' source is now mirrored, read-only, at https://github.com/ecomwebai/ecomweb-storefront-sdk; report issues there.

### Patch Changes

- Updated dependencies [33b6dc9]
  - @ecomweb/sdk@0.14.0

## 0.13.1

### Patch Changes

- 92b6565: Client side of the API security fixes; works against older APIs too.
  - Email-proof bindings (F10): the auth route keeps register's `verification_binding` and change-email's `confirmation_binding` in httpOnly cookies and sends them as `binding` on `verify-email` and `change-email/confirm`, then clears them. `AuthApi.verifyEmail(token, binding?)` and `confirmEmailChange(token, binding?)` take the binding; new `RegisterResult` and `ChangeEmailResult` types.
  - Checkout sends `promotion_code` with `promotion_id` (F12); `CreateOrderRequest` gains `promotion_code?`.
  - Copy for `PROMOTION_IDENTITY_REQUIRED` (F18); checkout keeps the code so the shopper can add an email and retry.
  - `BlogComment.author_email` is optional (the public API no longer returns it); creating a comment still requires it.

- Updated dependencies [92b6565]
  - @ecomweb/sdk@0.13.1

## 0.13.0

### Patch Changes

- ce1fe24: `orders.lookupGuest()` now returns the order, or `null` when no order matches, instead of a `{ order, found }` object the API never sent. `GuestOrderLookupResult` is removed. The guest order lookup hook no longer treats a "not found" reply as an order.
- 5a97f3c: Previewing a coming soon store is more reliable: sign-in pages keep their config and the signed-in check, a stale or expired preview cookie no longer hides a valid one, and the checkout shipping quote shows the "viewing a preview" notice instead of a shipping error.
- Updated dependencies [ce1fe24]
- Updated dependencies [228c936]
- Updated dependencies [c2d8aaa]
  - @ecomweb/sdk@0.13.0

## 0.12.1

### Patch Changes

- 941f6ad: Signing in now moves the guest cart into the account instead of losing it, cart lines keep the order they were added in, and an identity with no cart no longer shows the previous identity's items.
- 941f6ad: `buildStoreUrl` no longer doubles the slash when a hosted store's path starts with one, which sent signed-out shoppers to `//login`.
- @ecomweb/sdk@0.12.1

## 0.12.0

### Patch Changes

- ab6499f: Sign-in: `AUTH_ACCOUNT_DISABLED` (the merchant marked the customer inactive) is a known `AuthErrorCode` and `errorCopy` has Vietnamese copy for it.
- 020e29b: Catalog and content fixes. The SDK's `StoreSettings` gains optional `blog_description`, `posts_per_page` and `allow_comments`. The kit adds `useBankTransferDetails`, `shouldShowBankTransferDetails` and `pickBankTransfer` (bank transfer details for any unpaid bank transfer order, not just through the checkout handoff; `useOrderStatus` now uses them), Vietnamese copy for `BLOG_COMMENTS_DISABLED`, and the middleware keeps a redirect destination's own query string instead of percent-encoding its `?`.
- a91dd20: Lint cleanup with no runtime change: an unused import removed, a regex escape simplified to the same pattern, and targeted lint comments.
- c8c41ab: `errorCopy` has Vietnamese copy for `PROMOTION_USAGE_LIMIT_REACHED`, which the API now returns when placing an order would pass a discount code's usage limit. `useCheckout` drops the code on it, as on `ORDER_PROMOTION_NOT_APPLICABLE`, so the next attempt shows and charges the real total.
- 71bcbd5: The subdomain redirects to a custom domain only once that domain is verified. The SDK `StoreConfig` gains optional `verified`; `getStoreByHost` reports `domain` only when it is true, and the 301 now carries `Cache-Control: public, max-age=3600`.
- Updated dependencies [ab6499f]
- Updated dependencies [020e29b]
- Updated dependencies [a91dd20]
- Updated dependencies [71bcbd5]
  - @ecomweb/sdk@0.12.0

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

### Patch Changes

- Updated dependencies [3addebf]
  - @ecomweb/sdk@0.11.0

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

### Patch Changes

- Updated dependencies [755afa8]
  - @ecomweb/sdk@0.10.0

## 0.9.0

### Minor Changes

- aff621d: Themes can now render the product, collection, content page, blog index and blog post pages (new slots `ProductPage`, `CollectionPage`, `ContentPage`, `BlogIndex`, `BlogPost`), and declare client components (`ProductCard`, `NotFound`) through `ThemeClientComponents`. Adds `useOptionalThemeId()`.
- 784603c: `PlaceOrderInput.summary` (`OrderHandoffSummary`): the storefront can hand the thank-you page the order's contact, address, methods, lines and money. It is stored with the order handoff in the shopper's browser only and is never sent to the API; `useOrderStatus().handoff.summary` reads it back (null when absent or malformed).
- d7fdc2d: Banners and the shop introduction are default theme settings (default@1.1.0). Breaking: `sdk.banners`, the `Banner` types and `StoreConfigurationInfo.settings.shop_introduction` are removed, and `HomePageSlotProps` no longer has `banners`. Read `settings.banner_N_image`, `banner_N_link`, `banner_N_alt` and `settings.shop_introduction` instead. The API keeps serving the old endpoint and field for a deprecation window.
- 9c0a113: Theme majors: `ThemeSettingsProvider` takes an optional `themeKey` ("meridian@1"), read by `useOptionalThemeKey()`.

### Patch Changes

- 9426337: Multi-tenant middleware: `/store/<ref>/…` on the platform apex (and `www.`) now redirects to the store's subdomain (302, 307 for non-GET) instead of rendering the store there, so stores no longer share one origin with each other's embedded scripts; localhost keeps path-based access. `getStoreByHost` reuses lookups in-process (30s for a found store, 10s for a miss or suspension, never after a failed lookup; bounded at 10,000 hosts) and only treats a single label under the platform domain as a subdomain (`shop.evilecomsite.app` and `www.shop.ecomsite.app` no longer count; multi-label platform domains such as the lab's now work).
- c5c599e: Checkout pre-selects the cheapest shipping rate (the API's order breaks ties) instead of the first one, so a free rate is never passed over for a paid one.
- 9aa10b9: In production, the session, Google sign-in nonce and theme preview cookies stored at `Path=/` (store subdomains, custom domains, single-store sites) use `__Host-` names, and only those names are read. A merchant script on one store subdomain can no longer plant a session or nonce on another store with a `Domain=` cookie. Shoppers signed in before this release are signed out once; logout also clears the old names.
- b09fbf0: `placeOrder`'s `error` result carries the API's `code`, and `errorCopy` has Vietnamese copy for `ORDER_PROMOTION_NOT_APPLICABLE`, which the API now returns instead of placing the order without the discount the shopper was shown. On that code `useCheckout` also removes the applied promotion, so the next attempt shows and charges the real total. `OrderTimelineActor` gains an optional `email` (set for staff actors).
- 8817265: usePromotionValidation no longer logs a rejected code (unknown, expired, not eligible) as a console error; only unexpected failures are logged. The shopper still sees the message.
- 16611e1: Multi-tenant middleware logs per-store traffic, to size a per-store limit: a store reaching `STORE_TRAFFIC_LOG_PER_MINUTE` requests (default 600; 0 turns it off) in a minute on one server is logged as `[store-traffic] over …`, and its final count as `[store-traffic] peak …` when the minute closes. Log only; nothing is refused.
- Updated dependencies [2e5cb42]
- Updated dependencies [aff621d]
- Updated dependencies [b09fbf0]
- Updated dependencies [d7fdc2d]
- Updated dependencies [87e4a06]
  - @ecomweb/sdk@0.9.0

## 0.8.0

### Minor Changes

- 0cd5112: Theme preview hosts: every store theme previews at its own `p-<slug>.<platform domain>`. On such a host the multi-tenant middleware renders the store without redirecting to its custom domain, names the slug to the page (`readPreviewHostSlug()` from `@ecomweb/storefront-kit/server`; a client-sent header is always dropped), marks every response `noindex`, serves a disallow-all `robots.txt` and no sitemap. The editor's `?preview_theme=` token still works there, for its unsaved values. SDK: `themes.getPreviewBySlug(storeRef, slug)`, and `preview_slug` on the store-by-domain lookup.

### Patch Changes

- Updated dependencies [0cd5112]
  - @ecomweb/sdk@0.8.0

## 0.7.0

### Minor Changes

- b652b9f: Theme editor live preview: `<ThemePreviewBridge onRefresh={...} />` (render it in the store layout while a theme preview is open) lets the dashboard's theme editor re-render its preview frame in place as the merchant edits. It calls `onRefresh` when the editor asks; the app passes its router's `refresh()`, since routing stays with the app. It answers only the frame's parent and does nothing outside a frame; it marks `<html>` with `data-theme-preview-frame` (`THEME_PREVIEW_FRAME_ATTR`) so a preview banner can hide there. The messages use the `ecomweb:theme-preview` type (`THEME_PREVIEW_MESSAGE`). In production the preview cookie is now `SameSite=None; Secure; Partitioned`, so it survives inside the editor's cross-site frame.

### Patch Changes

- @ecomweb/sdk@0.7.0

## 0.6.0

### Minor Changes

- dc5f22b: External themes: in multi-tenant mode the middleware sends shoppers to the live external theme's URL (`storefront_url` from the by-domain lookup) with a 302 (307 for non-GET), keeping the path and query, before the subdomain → custom domain redirect; robots.txt and sitemap.xml follow. Previews (`?preview_theme=` or the preview cookie) are never redirected, a URL on the request's own host rewrites to `/domain-not-connected` instead of looping, and a missing field or failed lookup never redirects. Single-store mode is unchanged. `@ecomweb/storefront-kit/server` adds `externalThemeRedirectFor(request, storeRef, theme, previewOpen)`, the same decision for a store layout reached by path (`/store/<ref>/…`); the middleware now passes the requested path and query to renders in the `x-ecomweb-request-path` header.

### Patch Changes

- Updated dependencies [4473f76]
- Updated dependencies [8fc7b6b]
- Updated dependencies [14bb677]
  - @ecomweb/sdk@0.6.0

## 0.5.0

### Minor Changes

- a558741: Metafields and metaobjects for themes: `metafield(resource, "namespace.key")` and `metaobjectField(entry, key)` read resolved values, `getMetaobjects(storeRef, type, { filter, cursor, limit })` and `getMetaobject(storeRef, type, handle)` load entries, and `<RichText value={tree} />` renders a rich-text metafield as React elements (links limited to http, https and mailto).

### Patch Changes

- Updated dependencies [979fedb]
  - @ecomweb/sdk@0.5.0

## 0.4.0

### Minor Changes

- a559112: Themes P5: the page builder's `theme_config` is gone.
  - SDK: removes the storefront-builder schemas and types (`builderThemeConfigSchema`, `BuilderThemeConfig`, the header/footer and section schemas, `SECTION_CONFIG_SCHEMAS`, `WIDGET_REGISTRY`, `parseSectionContent`, `themeVersionSchema`/`ThemeVersion`), `themeConfigSchema`, `ThemeConfig`, and `theme_config` on `StoreSettings`, `StoreConfigurationInfo` and `storeWithRelationsSchema`. Adds `legalLinksSchema` and `legal_links` on the store settings schema.
  - Kit: `readBasicSettings` now returns only `{ legalLinks }`, read from `store.settings.legal_links`, and is deprecated.

  Migration: read theme settings (menus, top bar, footer text, homepage collection, colors) with `useThemeSettings`, or from `store.theme.values`; read the checkout links from `store.settings.legal_links`.

### Patch Changes

- Updated dependencies [a559112]
  - @ecomweb/sdk@0.4.0

## 0.3.0

### Minor Changes

- 9789634: Theme contract: setting types, `validateThemeValues` and `resolveThemeSettings` (SDK); `defineSchema`, `defineTheme`, `ThemeSettingsProvider`, `useThemeSettings` and `ThemeStyle` (kit).
- 358b783: Themes P2: `store.theme` and `sdk.themes.getPreview` (SDK); theme preview cookies in the middleware and `readThemePreviewToken` (kit).

### Patch Changes

- 5efba6d: Single-store mode defaults the API URL to `https://apibase.ecomweb.app/api/v1` (production serves the API under `/api/v1`; the bare origin answered 404, so a fresh ejected storefront showed "store not found"), and stored assets default to the API URL's origin.
- Updated dependencies [9789634]
- Updated dependencies [358b783]
  - @ecomweb/sdk@0.3.0

## 0.2.0

### Minor Changes

- 1f8540d: First public release: the storefront API client (`@ecomweb/sdk`) and the
  headless storefront kit (`@ecomweb/storefront-kit`): auth, cart, checkout,
  order status, API proxy and middleware for multi-tenant and single-store
  storefronts.

### Patch Changes

- 2327701: `CLIENT_IP_HEADER` chooses which incoming header carries the shopper's IP:
  `x-forwarded-for` (default, for edges that overwrite it) or `cf-connecting-ip`
  (behind Cloudflare and proxies that append to X-Forwarded-For). The backend
  proxy no longer forwards an incoming `cf-connecting-ip`.
- 13eb905: `storefrontMiddlewareConfig` no longer matches `/_vercel/*` (Vercel Analytics), so off Vercel those requests are not rewritten into a store page render.
- Updated dependencies [1f8540d]
  - @ecomweb/sdk@0.2.0
