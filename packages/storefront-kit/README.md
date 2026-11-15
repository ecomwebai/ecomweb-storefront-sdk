# @ecomweb/storefront-kit

Headless storefront logic for [ecomweb](https://ecomweb.app) stores on
Next.js 16: auth and session, the same-origin API proxy, cart, checkout,
order status and the middleware. No UI: you own every page and component.

```bash
pnpm add @ecomweb/storefront-kit @ecomweb/sdk
```

| Entry | Use it from | Main exports |
|---|---|---|
| `@ecomweb/storefront-kit` | client and server components | `StorefrontKitProvider`, `useAuth`, `useCart`, `useCheckout`, `useOrderStatus`, `useOrderLookup`, `storePath`, `storeApiPath`, `metafield`, `metaobjectField`, `getMetaobjects`, `getMetaobject`, `RichText`, `isStoreComingSoonError`, `comingSoonStoreNameOf`, `comingSoonStoreMetadata`, `STORE_COMING_SOON_REDIRECT_PATH` |
| `@ecomweb/storefront-kit/server` | route handlers, server components | `createAuthRoutes`, `createBackendProxy`, `requireSession`, `serverConfig`, `resolveRootStoreRef`, `resolveComingSoonStore`, `readStorePreviewToken` |
| `@ecomweb/storefront-kit/middleware` | `proxy.ts` | `createStorefrontMiddleware`, `storefrontMiddlewareConfig` |
| `@ecomweb/storefront-kit/config` | anywhere | `publicConfig`, `parsePublicConfig`, `resolveMode` |

## Modes

`ECOMWEB_MODE` (`NEXT_PUBLIC_ECOMWEB_MODE` in the browser) picks the
behaviour; it defaults to `single`:

- `single`: one store (`ECOMWEB_STORE_REF`), pages at the site root.
- `multi`: the ecomweb platform storefront, every store under
  `/store/<ref>` or its own domain.

## Wiring

```ts
// proxy.ts
import { createStorefrontMiddleware } from "@ecomweb/storefront-kit/middleware";
export default createStorefrontMiddleware();
export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};

// app/api/auth/[...route]/route.ts
import { createAuthRoutes } from "@ecomweb/storefront-kit/server";
export const { GET, POST } = createAuthRoutes();

// app/api/backend/[...path]/route.ts
import { createBackendProxy } from "@ecomweb/storefront-kit/server";
export const { GET, POST, PUT, PATCH, DELETE } = createBackendProxy();
```

Wrap the store layout in `<StorefrontKitProvider store={store} onNotice={…}>`;
`onNotice` receives the kit's messages (item added, request failed) for your
toasts. `useCheckout().placeOrder()` returns `redirect`, `redirect_failed`,
`success`, `stock_issues`, `error`, `quote_changed` or `busy`, and your page decides what to show.

## Coming soon stores and store previews

Needs kit 0.11.0. Until the merchant opens a store, the API answers every
storefront read with `403 STORE_COMING_SOON` (details: `{ name }`). The kit
turns that into a page:

- The middleware rewrites the request to `/coming-soon`, and the store layout
  renders the page inline when it meets the error itself. Your app owns
  `app/coming-soon/page.tsx`: call `resolveComingSoonStore()` for the store
  name and return `comingSoonStoreMetadata(name)` (`noindex`). The sitemap is
  empty because no store resolves.
- `isStoreComingSoonError(error)` and `comingSoonStoreNameOf(error)` let your
  own data loaders recognise the error. `errorCopy("STORE_COMING_SOON")` has
  the shopper-facing text.

The merchant sees the real store through a preview link from the dashboard:
`/preview?token=<token>` on the store's host, `/store/<ref>/preview?token=<token>`
on path-based localhost. The kit stores the token in the httpOnly
`ecw_store_preview` cookie for 24 h (`__Host-` prefixed on the store's host in
production), redirects to the store's home, and every kit client (server,
browser and the backend proxy) sends it as `X-Store-Preview`. Theme preview
hosts (`p-<slug>`) and `?preview_theme=` links on the store's own host work
for a coming soon store too. The token sent is, in order: a theme preview
host's own token, then the store preview cookie, then the theme preview cookie.

Wrap the layout so the browser can send the token as well, only while the
store is coming soon:

```tsx
// in your async layout
const storePreviewToken = store.coming_soon ? await readStorePreviewToken() : null;
<StorefrontKitProvider store={store} storePreviewToken={storePreviewToken}>
```

On a theme preview host also pass `onStorePreviewRenew` (for example
`router.refresh`), because that host's token lasts 1 h.

Previews are read-only: the API opens GET and HEAD only. In the browser, cart
writes and `placeOrder` are refused with a preview notice, and a refused write
does not redirect. `placeOrder`'s refusal message is
`STORE_PREVIEW_READ_ONLY_MESSAGE`: show it as is, and map any other
`STORE_COMING_SOON` message (the API's English) through `errorCopy`.

Older kits (0.10.0 and below) show their 404 or error page for a coming soon
store, never the real store, so upgrade to get the page.

Known limitations:

- The shared apex `/store/<ref>` path of a coming soon (or suspended) store
  still returns 404. Use the store's subdomain or custom domain.
- Development only: on a path-based `localhost` store, a preview that expires
  mid-session redirects to `/coming-soon`, which 404s there.
- A tab left open when the store opens keeps showing the preview notice until
  the layout re-renders; a reload clears it.

## Carrier shipping options and tracking

Carrier-calculated options (AllinGo) are opt-in:
`useCheckout({ includeCarrierOptions: true })`. Without it you get fixed rates
only, as before. When on:

- Key and select options by `optionIdOf(option)`, not `rate_id`
  (`shipping.selectedOptionId`, `shipping.selectOption`). `selectRate` is
  deprecated and only reaches fixed rates.
- Render each option with `describeShippingOption`. Logo and track links are
  `http(s)` only.
- `placeOrder()` sends `shipping_service_id` and `shipping_quoted_amount` for a
  carrier option. If the carrier price moved, the API answers 409
  `SHIPPING_QUOTE_CHANGED`; the kit swaps in the new options and returns
  `{ kind: "quote_changed" }`. The new amounts are merged into the list by
  option id (other options are kept; the API re-checks them at placement).
  Nothing was placed: show the new price and make the buyer confirm again. An
  unavailable rate surfaces as an `error` with code
  `ORDER_SHIPPING_RATE_UNAVAILABLE`, and the kit re-quotes the options.

On order pages, `deriveShipmentTracking(order)` builds the tracking view,
`canCustomerCancel(order)` follows the API's `can_cancel`, and
`isHandedToCarrier(order)` says whether the parcel has left the merchant.
`isCarrierShipment(order)` is false for a manual shipment (status `null`: show
only carrier and tracking number), and `shipmentEventLabel(event)` gives an
event's text with a neutral fallback.

## Metafields and metaobjects

Merchants define typed custom data in the dashboard (Settings, Custom data).
Definitions with storefront access come back on public product, variant,
collection, page, blog post and store responses as `metafields`, already
resolved (references are summaries, files are URLs).

```tsx
import { getMetaobjects, metafield, metaobjectField, RichText } from "@ecomweb/storefront-kit";
import type { ResolvedMetaobjectRef, RichTextRoot } from "@ecomweb/sdk";

const care = metafield<RichTextRoot>(product, "custom.care_guide");
const featured = metafield<ResolvedMetaobjectRef>(product, "custom.featured_feedback");
const { items, next_cursor } = await getMetaobjects(storeRef, "feedbacks", { limit: 10 });

<RichText value={care} />
<blockquote>{metaobjectField<string>(featured, "content")}</blockquote>
```

`list.*` types return arrays, e.g.
`metafield<ResolvedMetaobjectRef[]>(product, "custom.related")`.
`getMetaobjects` and `getMetaobject` are uncached on the server: wrap them in
React's `cache()` when several components in one request need the same data.

`metafield` returns `undefined` when there is no value or the reference is
hidden from the storefront. `RichText` renders bare `h1`..`h6`, `p`, `ul`,
`ol`, `li`, `strong`, `em` and `a` elements and never sets raw HTML; links
other than http, https and mailto render as text. For a metaobject type with
customer-account access only, pass `{ as_customer: true }` from a client
component.

## Versioning

Semver. Within 1.x no export is removed and no required prop or parameter
is added. Before 1.0, a minor (0.x) release may break; your caret range
(`^0.y.z`) only takes the patches of your minor.

## Version reporting and update warnings

Every SDK request the kit makes sends
`X-Ecomweb-Client: @ecomweb/storefront-kit/<version> @ecomweb/sdk/<version>`
(versions baked in at build), so the dashboard can tell a store owner when the
storefront runs an old or insecure kit.

`checkClientVersions` (`@ecomweb/storefront-kit/config`) warns at build time.
Call it from `next.config.mjs` with Next's `phase`; it does nothing outside
`next build`, gives up after 2 s and never fails the build. Set
`ECOMWEB_SKIP_VERSION_CHECK=1` to turn it off.

```js
import { checkClientVersions } from "@ecomweb/storefront-kit/config";

export default async function config(phase) {
  await checkClientVersions({ phase, apiUrl: process.env.ECOMWEB_API_URL });
  return nextConfig;
}
```

To update: `ecomweb storefront upgrade`
([guide](https://help.ecomweb.app/guides/storefront/upgrade-kit)); release
notes are the releases of
[ecomwebai/ecomweb-storefront-sdk](https://github.com/ecomwebai/ecomweb-storefront-sdk).
