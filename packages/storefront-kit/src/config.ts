// @ecomweb/storefront-kit/config: config parsing and types.
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
