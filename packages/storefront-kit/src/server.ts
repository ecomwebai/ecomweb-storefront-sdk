/**
 * Server-only route handlers and helpers: the auth routes, the backend proxy,
 * session checks and the server config.
 *
 * Import from `@ecomweb/storefront-kit/server` in route handlers and server
 * components only; the entry imports `server-only` and fails in a client
 * bundle.
 *
 * @packageDocumentation
 */
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
export { getServerSdk } from "./api/server-sdk";
export type { EcomwebSdk, EcomwebServerSdk } from "@ecomweb/sdk";
export { hasCustomerSession } from "./auth/session";
export { parseServerConfig, serverConfig } from "./config/server";
export { resolveRootStoreRef } from "./store-scope/root";
export { readThemePreviewToken } from "./theme/read-preview-token";
export { readStorePreviewToken } from "./stores/read-store-preview-token";
export { readPreviewHostSlug } from "./theme/read-preview-host";
export { externalThemeRedirectFor } from "./theme/external-storefront";
export { resolveComingSoonStore } from "./stores/resolve-coming-soon";
