// Store API - Pure API Client Architecture
// All operations use backend API exclusively - no direct database calls
// Supabase used only for auth and storage

export { getCachedStore } from "./cached";
export { getStoreByHost } from "./get-store-by-host";
