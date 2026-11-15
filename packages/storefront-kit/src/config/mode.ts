import { ConfigError, envValue, type EnvSource } from "./schema";

/**
 * multi: the shared platform storefront, every store under /store/<ref> or
 * its own host. single: one merchant's storefront, the store is the site.
 */
export type StorefrontMode = "multi" | "single";

const MODES: readonly StorefrontMode[] = ["multi", "single"];

/**
 * NEXT_PUBLIC_ECOMWEB_MODE is inlined into client bundles, so it wins;
 * ECOMWEB_MODE is the server-side spelling. Unset means single: an ejected
 * storefront needs no extra setting, and the shared app sets multi in
 * next.config.mjs.
 */
export function resolveMode(env: EnvSource): StorefrontMode {
  const name = envValue(env, "NEXT_PUBLIC_ECOMWEB_MODE")
    ? "NEXT_PUBLIC_ECOMWEB_MODE"
    : "ECOMWEB_MODE";
  const value = envValue(env, name);
  if (value === undefined) return "single";
  if ((MODES as readonly string[]).includes(value)) {
    return value as StorefrontMode;
  }
  throw new ConfigError(
    `Invalid storefront configuration:\n  - ${name}: expected "multi" or "single", got "${value}"`
  );
}
