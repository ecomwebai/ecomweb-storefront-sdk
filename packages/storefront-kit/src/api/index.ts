// Client-side API clients (for use in React components).
// `publicApiClient` talks to the backend origin directly and can never carry a
// session token; `createStoreApiClient(storeRef)` routes through the
// same-origin proxy that attaches one server-side.
export { publicApiClient, createStoreApiClient, ApiClient } from "./client";

// Server-side private reads go through getServerSdk() from
// `@ecomweb/storefront-kit/server`, which signs with the secret key.
