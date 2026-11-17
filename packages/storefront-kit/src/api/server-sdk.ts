import "server-only";

import { createEcomwebServerSdk } from "@ecomweb/sdk";
import type { ApiResponse, EcomwebServerSdk, IHttpClient } from "@ecomweb/sdk";
import { clientIpFrom } from "../auth/client-ip";
import { authHttpClient, storefrontSecretKey } from "../auth/sdk";
import { KIT_CLIENT_TOKEN } from "../client-info";
import { readStorePreviewToken } from "../stores/read-store-preview-token";

const SHOPPER_CALL_ON_SERVER: ApiResponse<never> = {
  success: false,
  error: {
    statusCode: 401,
    error: "SDK_SHOPPER_CALL_ON_SERVER",
    message:
      "Shopper calls run in the browser: use createStoreSdk(storeRef)",
  },
};

/** Answers every shopper-side call with the same 401: a server has no shopper session. */
const shopperCallsRefused: IHttpClient = {
  get: async () => SHOPPER_CALL_ON_SERVER,
  post: async () => SHOPPER_CALL_ON_SERVER,
  put: async () => SHOPPER_CALL_ON_SERVER,
  patch: async () => SHOPPER_CALL_ON_SERVER,
  delete: async () => SHOPPER_CALL_ON_SERVER,
};

/** Internal: builds the server SDK for one request's shopper IP and preview token. */
export function serverSdkFor(
  clientIp?: string,
  previewToken?: string | null
): EcomwebServerSdk {
  return createEcomwebServerSdk({
    publicHttp: authHttpClient(clientIp, previewToken),
    authHttp: shopperCallsRefused,
    secretKey: storefrontSecretKey(),
    clientInfo: KIT_CLIENT_TOKEN,
  });
}

/**
 * The server SDK for the current request, signed with the storefront secret
 * key, for private reads in server components and route handlers (for example
 * a review invitation by token). The shopper's IP and the store preview token
 * are taken from the request.
 *
 * Shopper-side methods (cart, orders, addresses and the like) do not work
 * here: a server has no shopper session, so they reject with
 * `SDK_SHOPPER_CALL_ON_SERVER`. Use `createStoreSdk(storeRef)` in the browser.
 *
 * @example
 * ```ts
 * import { getServerSdk } from "@ecomweb/storefront-kit/server";
 *
 * const sdk = await getServerSdk();
 * const invitation = await sdk.reviews.getReviewInvitation(storeRef, token);
 * ```
 *
 * @returns The server SDK for this request
 * @throws Error when the storefront secret key is not set
 */
export async function getServerSdk(): Promise<EcomwebServerSdk> {
  const { headers } = await import("next/headers");
  return serverSdkFor(
    clientIpFrom(await headers()),
    await readStorePreviewToken()
  );
}
