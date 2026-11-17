import { createEcomwebProxiedSdk, createEcomwebSdk } from "@ecomweb/sdk";
import type {
  ApiResponse,
  EcomwebSdk,
  EcomwebServerSdk,
  IHttpClient,
} from "@ecomweb/sdk";
import { createStoreApiClient, publicApiClient } from "./api/client";
import { KIT_CLIENT_TOKEN } from "./client-info";

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
export const sdk: EcomwebSdk = createEcomwebSdk({
  publicHttp: publicApiClient as any,
  authHttp: requireStoreScopedSdk(),
  clientInfo: KIT_CLIENT_TOKEN,
});

const storeSdks = new Map<string, EcomwebServerSdk>();

/**
 * SDK bound to one store, for the browser. Public calls go straight to the
 * API with the publishable key; every private call (cart, orders, payments,
 * customers, addresses, shopper-side blog, review and metaobject calls, rate
 * calculation, promotion validation) goes to the same-origin proxy at
 * `/store/<ref>/api/backend` (`/api/backend` on a single-store site), which
 * adds the storefront secret key and turns the httpOnly session cookie into a
 * bearer token. The secret key never reaches the browser.
 *
 * Memoised per store so the returned object is referentially stable and safe to
 * use in a React dependency array.
 */
export function createStoreSdk(storeRef: string): EcomwebServerSdk {
  const cached = storeSdks.get(storeRef);
  if (cached) return cached;

  const created = createEcomwebProxiedSdk({
    publicHttp: publicApiClient as any,
    proxyHttp: createStoreApiClient(storeRef) as any,
    clientInfo: KIT_CLIENT_TOKEN,
  });

  storeSdks.set(storeRef, created);
  return created;
}
