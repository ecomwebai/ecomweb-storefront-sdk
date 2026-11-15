// Client-side API clients (for use in React components).
// `publicApiClient` talks to the backend origin directly and can never carry a
// session token; `createStoreApiClient(storeRef)` routes through the
// same-origin proxy that attaches one server-side.
export { publicApiClient, createStoreApiClient, ApiClient } from "./client";

// Note: serverApiClient is not exported here to avoid bundling server-only
// dependencies on the client. Use getApiClient() for universal usage,
// or import { serverApiClient } from './server-client' directly
// in server-only contexts if needed.
