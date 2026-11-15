// @ecomweb/storefront-kit/server: server-only handlers and helpers.
import "server-only";

export {
  createAuthRoutes,
  createBackendProxy,
  requireSession,
} from "./server/routes";
export type {
  CustomerIdentity,
  RouteContext,
  RouteHandler,
} from "./server/routes";
export { hasCustomerSession } from "./auth/session";
export { parseServerConfig, serverConfig } from "./config/server";
export { resolveRootStoreRef } from "./store-scope/root";
export { readThemePreviewToken } from "./theme/read-preview-token";
export { readStorePreviewToken } from "./stores/read-store-preview-token";
export { readPreviewHostSlug } from "./theme/read-preview-host";
export { externalThemeRedirectFor } from "./theme/external-storefront";
export { resolveComingSoonStore } from "./stores/resolve-coming-soon";
