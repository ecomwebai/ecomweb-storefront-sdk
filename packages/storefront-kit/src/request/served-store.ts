/**
 * The store this request serves, stamped by the middleware (the host's store
 * on a store host, the path's store on localhost, the configured one in single
 * mode). The middleware always deletes any client copy first, so a server-side
 * reader can trust it. Absent when no store was resolved. No `server-only`:
 * the middleware imports it.
 */
export const SERVED_STORE_HEADER = "x-ecomweb-served-store";
