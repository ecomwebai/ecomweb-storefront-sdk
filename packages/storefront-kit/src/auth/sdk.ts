import "server-only";

import { AuthApi, withClientHeader } from "@ecomweb/sdk";
import type { ApiResponse, IHttpClient, RequestOptions } from "@ecomweb/sdk";
import { forwardingHeaders } from "./client-ip";
import { KIT_CLIENT_TOKEN } from "../client-info";
import { publicConfig } from "../config";
import { serverConfig } from "../config/server";
import { STORE_PREVIEW_HEADER } from "../stores/store-preview-cookie";

/**
 * The one server-side resolution of the backend origin. `lib/api/proxy.ts`
 * uses this too so the proxy and the auth routes can never disagree about
 * where the backend is.
 */
export function backendBaseUrl(): string {
  return publicConfig().apiUrl;
}

/**
 * The key the server signs every backend call with (`x-storefront-api-key`):
 * PLATFORM_SECRET_KEY in the shared app, ECOMWEB_SECRET_KEY in a single-store
 * site. Builds hold none, so an empty one throws here, at use.
 */
export function storefrontSecretKey(): string {
  const key = serverConfig().secretKey;
  if (!key) {
    throw new Error(
      "The storefront secret key is not set (PLATFORM_SECRET_KEY or ECOMWEB_SECRET_KEY)"
    );
  }
  return key;
}

/**
 * Joins the backend origin and an SDK path with exactly one slash. Plain
 * string concatenation (unlike axios's baseURL join) turns a path without a
 * leading slash into `.../api/v1public/...`.
 */
function backendUrl(path: string): string {
  const base = backendBaseUrl().replace(/\/+$/, "");
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

async function send<T>(
  method: string,
  url: string,
  data?: unknown,
  options?: RequestOptions,
  clientIp?: string,
  previewToken?: string | null
): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(backendUrl(url), {
      method,
      headers: {
        "Content-Type": "application/json",
        "x-storefront-api-key": storefrontSecretKey(),
        // A store preview opens a coming soon store for reads only, so the
        // token rides on GETs (auth config, me) and never on writes.
        ...(previewToken && method === "GET"
          ? { [STORE_PREVIEW_HEADER]: previewToken }
          : {}),
        ...(options?.headers ?? {}),
        // The backend's auth throttler keys on the shopper IP, which it only
        // reads from `x-forwarded-for` when the forwarder secret rides along.
        // Without both, every shopper of a store shares one bucket, because
        // the only client the backend ever sees is this server. Spread last
        // so nothing an SDK call passes can replace the validated values.
        ...forwardingHeaders(clientIp),
      },
      body: data === undefined ? undefined : JSON.stringify(data),
      signal: options?.signal,
      cache: "no-store",
    });

    const body = await response.json().catch(() => null);

    if (!response.ok) {
      return {
        success: false,
        error: {
          message: body?.message ?? response.statusText,
          statusCode: response.status,
          // BusinessException serialises as { code, message, details,
          // timestamp } with no global exception filter rewriting the
          // shape (verified against src/common/exceptions/business.exception.ts
          // in the api repo), so the stable AUTH_* code lands in `code`.
          // `error` is checked too in case a future filter renames it.
          error: body?.code ?? body?.error,
        },
      };
    }

    return { success: true, data: body as T };
  } catch (error) {
    return {
      success: false,
      error: {
        message: error instanceof Error ? error.message : "Network error",
        statusCode: 0,
      },
    };
  }
}

export function authHttpClient(
  clientIp?: string,
  previewToken?: string | null
): IHttpClient {
  return {
    get: <T>(url: string, options?: RequestOptions) =>
      send<T>("GET", url, undefined, options, clientIp, previewToken),
    post: <T>(url: string, data?: unknown, options?: RequestOptions) =>
      send<T>("POST", url, data, options, clientIp),
    put: <T>(url: string, data?: unknown, options?: RequestOptions) =>
      send<T>("PUT", url, data, options, clientIp),
    patch: <T>(url: string, data?: unknown, options?: RequestOptions) =>
      send<T>("PATCH", url, data, options, clientIp),
    delete: <T>(url: string, options?: RequestOptions) =>
      send<T>("DELETE", url, undefined, options, clientIp),
  };
}

/**
 * @param clientIp the shopper's address, from `clientIpFrom(request.headers)`.
 *   Omit it only where there is genuinely no incoming request to read.
 * @param previewToken the request's store preview token
 *   (`storePreviewTokenFrom`), sent as `X-Store-Preview` on GETs so a
 *   previewer of a coming soon store still gets the auth config and `me`.
 */
export function createAuthApi(
  storeRef: string,
  clientIp?: string,
  previewToken?: string | null
): AuthApi {
  return new AuthApi(
    withClientHeader(authHttpClient(clientIp, previewToken), KIT_CLIENT_TOKEN),
    storeRef
  );
}
