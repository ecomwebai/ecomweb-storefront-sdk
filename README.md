# ecomweb storefront SDK

Source of the two npm packages behind ecomweb storefronts:

| Package | |
|---|---|
| [`@ecomweb/sdk`](packages/sdk) | typed client for the ecomweb storefront API |
| [`@ecomweb/storefront-kit`](packages/storefront-kit) | auth and session, API proxy, cart, checkout and config for Next.js storefronts |

This version: **0.14.1** (`npm i @ecomweb/sdk@0.14.1 @ecomweb/storefront-kit@0.14.1`).

## Read-only mirror

This repository is a read-only copy, updated once per release: each commit is
the full source of one published version, tagged `packages-v<version>`.
Development happens elsewhere, so pull requests here are not merged.

- **What changed:** [Releases](https://github.com/ecomwebai/ecomweb-storefront-sdk/releases), or
  `packages/*/CHANGELOG.md`.
- **Updating a storefront:** `ecomweb storefront upgrade`, see the
  [guide](https://help.ecomweb.app/guides/storefront/upgrade-kit).
- **Bugs and questions:** [open an issue](https://github.com/ecomwebai/ecomweb-storefront-sdk/issues).
- **Security issues:** never in a public issue; see [SECURITY.md](SECURITY.md).

## Building

```sh
pnpm install --no-frozen-lockfile
pnpm build      # packages/*/dist, as published (type-checks both)
pnpm test       # the SDK's unit tests
```

MIT licensed, see [LICENSE](LICENSE).
