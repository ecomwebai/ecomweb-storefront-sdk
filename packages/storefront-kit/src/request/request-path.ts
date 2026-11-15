/**
 * The path and query the shopper asked for (`/store/<ref>/x?y` on the shared
 * host, `/x?y` on a store's own host), before the middleware's rewrite. Server
 * components cannot see the URL; this is how the store layout learns it.
 * The multi-tenant middleware always overwrites it, so a browser-supplied
 * value never survives.
 */
export const REQUEST_PATH_HEADER = "x-ecomweb-request-path";
