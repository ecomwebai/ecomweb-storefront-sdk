/**
 * Parsing and types for the storefront's configuration: public (client-safe)
 * settings, the deployment mode, the build-time version check and
 * `ConfigError`.
 *
 * Import from `@ecomweb/storefront-kit/config` in `next.config` and config
 * code. It has no React or server-only dependency.
 *
 * @packageDocumentation
 */
export {
  parsePublicConfig,
  publicConfig,
  // For specs that stub env per test (the config is memoized on first read).
  resetPublicConfigForTests,
} from "./config/public";
export { resolveMode } from "./config/mode";
export type { StorefrontMode } from "./config/mode";
export { ConfigError } from "./config/schema";
export type {
  EnvSource,
  LogLevel,
  PublicConfig,
  ServerConfig,
} from "./config/schema";
export { KIT_CLIENT_TOKEN, KIT_VERSION } from "./client-info";
export {
  checkClientVersions,
  formatClientVersionWarning,
} from "./config/version-check";
export type {
  CheckClientVersionsOptions,
  ClientVersionReport,
  ClientVersionStatus,
} from "./config/version-check";
