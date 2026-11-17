# @ecomweb/sdk

Shared TypeScript SDK for the EcomWeb storefront API — request builders,
response types and the vocabulary (collection rules, payment methods, order
shapes) that the API and its consumers must agree on.

> Source: [ecomwebai/ecomweb-storefront-sdk](https://github.com/ecomwebai/ecomweb-storefront-sdk)
> (read-only mirror, one commit per release; issues welcome there).

## Source in the workspace, `dist/` on npm

Inside the storefront workspace, `exports` points at `./src/index.ts` and the
app compiles the source itself (`transpilePackages`). `pnpm build` (tsup)
produces `dist/` (ESM + `.d.ts`); `publishConfig.exports` swaps that in when
the package is published, so npm consumers never compile it.

```bash
pnpm --filter @ecomweb/sdk typecheck
pnpm --filter @ecomweb/sdk test
pnpm --filter @ecomweb/sdk build
```

## How consumers get it

| Consumer | Specifier |
|---|---|
| `ecomweb-storefront` (this workspace) | `workspace:*` |
| Ejected merchant storefronts | npm `@ecomweb/sdk` (caret range) |
| `@ecomweb/contracts` / `ecomweb-dashboard` | not npm yet: the last full-SDK commit in the private contracts repo, `github:ecomwebai/ecomweb-contracts#f3dc1ab…` (pinned by full SHA) |

Admin-only types and constants (permissions, purchase orders, sales channels,
timelines, …) are **not** here: they live in the private `@ecomweb/contracts`
package (the `ecomweb-contracts` repo).

### Working on the SDK locally

The SDK lives in the storefront's pnpm workspace (`packages/sdk`). The app
imports its source directly, so edits are visible immediately. Run
`pnpm --filter @ecomweb/sdk test` before you push.

### Two keys, three factories

A store has a publishable key (`pk_...`, safe in a browser) and a secret key
(`sk_storefront_...`, server only). Pick the factory by where the code runs:

| Factory | Runs in | Key | Modules |
|---|---|---|---|
| `createEcomwebSdk({ publicHttp, authHttp })` | browser or server | publishable | catalog and content reads: products, collections, categories, blog, stores, themes, metaobjects, search, shipping locations, promotion suggestions, payment methods, review reads, content pages, menus, redirects |
| `createEcomwebServerSdk({ publicHttp, authHttp, secretKey })` | server only | secret | all of the above plus `cart`, `orders`, `payments`, `customers`, `addresses`, and the private methods of `blog`, `reviews`, `shipping` and `promotions` (`validate`, `calculate`, ...) |
| `createEcomwebProxiedSdk({ publicHttp, proxyHttp })` | browser | publishable (direct), none (proxy) | same shape as the server SDK; private calls go to `proxyHttp`, a same-origin proxy that holds the secret |

The server SDK sets `x-storefront-api-key` to the secret on every request and
overrides any value the caller set. It throws when `secretKey` is blank, starts
with `pk_`, or when `window` exists. Never put a secret key in a browser
bundle, a `NEXT_PUBLIC_*` variable, an image or a log.

### The `X-Ecomweb-Client` header

All three factories wrap the HTTP clients so every request sends
`X-Ecomweb-Client: @ecomweb/sdk/<version>` (`SDK_VERSION`, set by tsup's
`define` at build; `dev` when the source runs without it). Pass
`clientInfo: "name/version"` to put your own tokens first, as the storefront
kit does. A header the caller sets itself wins. `withClientHeader(http)`
wraps a client used outside the factories.

## Layout

```
src/
├── core/       HTTP client, error types, shared plumbing
├── modules/    One directory per domain (products, orders, cart, search, …)
├── types/      Shared types and schemas
└── index.ts    Public surface — the only entry point
```

Anything not exported from `src/index.ts` is not public API.

## Conventions

- **The SDK owns the shared vocabulary.** Where the API and SDK both describe
  the same concept (collection rule fields, payment method codes, order
  statuses), the SDK is the source of truth and the API pins itself to it.
- **Widening an enum here is not enough.** The dashboard keeps private copies
  of some of this vocabulary; changing it in the SDK and API can still leave
  the merchant UI unable to use the new value. Grep the dashboard too.
- No user-facing strings. Consumers localise from error codes.
