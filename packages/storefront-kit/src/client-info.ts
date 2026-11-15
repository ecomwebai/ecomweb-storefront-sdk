// Replaced at build time (tsup `define`, and the workspace's Next and vitest
// configs) with this package's version from package.json.
declare const __ECOMWEB_KIT_VERSION__: string | undefined;

/**
 * This package's version, baked in at build time. `dev` when the source runs
 * without the define (the API ignores a version that isn't semver).
 */
export const KIT_VERSION: string =
  typeof __ECOMWEB_KIT_VERSION__ === "string" ? __ECOMWEB_KIT_VERSION__ : "dev";

/** The kit's token in `X-Ecomweb-Client`, put before the SDK's own. */
export const KIT_CLIENT_TOKEN = `@ecomweb/storefront-kit/${KIT_VERSION}`;
