/**
 * The storefront's request middleware (`proxy.ts`): store routing and the
 * checks that run before a page renders.
 *
 * Import from `@ecomweb/storefront-kit/middleware` in the storefront's
 * `proxy.ts` (or `middleware.ts`).
 *
 * @packageDocumentation
 */
export {
  createStorefrontMiddleware,
  storefrontMiddlewareConfig,
} from "./middleware/create-storefront-middleware";
