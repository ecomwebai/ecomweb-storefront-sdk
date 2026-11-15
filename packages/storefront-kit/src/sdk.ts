import { createEcomwebSdk } from "@ecomweb/sdk";
import type { ApiResponse, IHttpClient } from "@ecomweb/sdk";
import { createStoreApiClient, publicApiClient } from "./api/client";

/**
 * The module-level `sdk` below has no store in scope, so it cannot build the
 * store-scoped proxy URL an authenticated call needs. Rather than let such a
 * call go out silently unauthenticated and 401 at the backend, its `authHttp`
 * fails here with an actionable message.
 */
function requireStoreScopedSdk(): IHttpClient {
  const fail = async (): Promise<ApiResponse<never>> => ({
    success: false,
    error: {
      message:
        "This endpoint requires a signed-in shopper. Use createStoreSdk(storeRef) instead of the module-level sdk.",
      statusCode: 401,
      error: "SDK_STORE_SCOPE_REQUIRED",
    },
  });

  return { get: fail, post: fail, put: fail, patch: fail, delete: fail };
}

// ApiClient satisfies IHttpClient structurally at runtime; cast resolves the
// AxiosRequestConfig vs RequestOptions type mismatch.
export const sdk = createEcomwebSdk({
  publicHttp: publicApiClient as any,
  authHttp: requireStoreScopedSdk(),
});

const storeSdks = new Map<string, ReturnType<typeof createEcomwebSdk>>();

/**
 * SDK bound to one store, whose authenticated modules (cart, orders, blog
 * comments, customers, addresses) go through the same-origin proxy route so the
 * httpOnly session cookie can be turned into a bearer token server-side.
 *
 * Memoised per store so the returned object is referentially stable and safe to
 * use in a React dependency array.
 */
export function createStoreSdk(storeRef: string) {
  const cached = storeSdks.get(storeRef);
  if (cached) return cached;

  const created = createEcomwebSdk({
    publicHttp: publicApiClient as any,
    authHttp: createStoreApiClient(storeRef) as any,
  });

  storeSdks.set(storeRef, created);
  return created;
}
