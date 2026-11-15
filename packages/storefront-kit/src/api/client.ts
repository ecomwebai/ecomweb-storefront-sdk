import axios, {
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
  AxiosError,
} from "axios";
import { ApiResponse, AuthenticatedApiClient } from "../interfaces";
import {
  isStoreSuspendedResponseBody,
  STORE_SUSPENDED_REDIRECT_PATH,
} from "../stores/store-suspension";
import {
  isStoreComingSoonResponseBody,
  STORE_COMING_SOON_REDIRECT_PATH,
} from "../stores/store-coming-soon";
import {
  skipsStorePreview,
  STORE_PREVIEW_HEADER,
} from "../stores/store-preview-cookie";
import {
  currentStorePreviewToken,
  isBrowserStorePreview,
  requestStorePreviewRenewal,
} from "./store-preview-header";
import { publicConfig } from "../config";
import { storeApiPath } from "../store-scope";

const DEFAULT_TIMEOUT = 10000; // 10 seconds

/**
 * Whether a browser call's STORE_COMING_SOON 403 ends this visit, so the
 * browser goes to the coming soon page.
 *   - Not previewing: yes, the store is closed to this shopper.
 *   - Previewing, a write: no. A preview is read-only (the API opens GET and
 *     HEAD only), so the write was refused, not the preview; the caller
 *     reports it.
 *   - Previewing, a read: the token ran out. A preview host renews it
 *     (`requestStorePreviewRenewal`), so the preview goes on; a link
 *     preview has no renewer, and its preview is over.
 */
function comingSoonEndsThisVisit(method: string | undefined): boolean {
  if (!isBrowserStorePreview()) return true;
  const verb = (method ?? "get").toUpperCase();
  if (verb !== "GET" && verb !== "HEAD") return false;
  return !requestStorePreviewRenewal();
}

interface ApiClientOptions {
  /**
   * Send `x-storefront-api-key` from the browser. True for direct calls to the
   * backend's own origin; false for calls routed through the same-origin proxy
   * (`lib/api/proxy.ts`), which attaches the key server-side.
   */
  withApiKey?: boolean;
  timeout?: number;
}

class ApiClient implements AuthenticatedApiClient {
  private axiosInstance: AxiosInstance;
  private withApiKey: boolean;

  constructor(
    baseUrl: string = publicConfig().apiUrl,
    options?: ApiClientOptions
  ) {
    this.withApiKey = options?.withApiKey ?? true;

    const defaultHeaders: Record<string, string> = {
      "Content-Type": "application/json",
    };

    const platformApiKey = publicConfig().storefrontApiKey;
    if (this.withApiKey && platformApiKey) {
      defaultHeaders["x-storefront-api-key"] = platformApiKey;
    }

    this.axiosInstance = axios.create({
      baseURL: baseUrl.replace(/\/$/, ""), // Remove trailing slash
      timeout: options?.timeout ?? DEFAULT_TIMEOUT,
      headers: defaultHeaders,
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    // Request interceptor - add platform API key
    this.axiosInstance.interceptors.request.use(
      async config => {
        // Ensure API key is always present (in case instance was created before env loaded)
        const platformApiKey = publicConfig().storefrontApiKey;
        if (
          this.withApiKey &&
          platformApiKey &&
          !config.headers["x-storefront-api-key"]
        ) {
          config.headers["x-storefront-api-key"] = platformApiKey;
        }

        // Opens a coming soon store for a previewer (read-only on the API's
        // side). An explicit header wins, such as the token the middleware
        // passes to `getByDomain`, and a call carrying SKIP_STORE_PREVIEW (a
        // plain, cached host lookup) never gets the request's token.
        // `get`/`set` match the header name case-insensitively.
        const previewToken = await currentStorePreviewToken();
        if (
          previewToken &&
          !skipsStorePreview(config) &&
          !config.headers.get(STORE_PREVIEW_HEADER)
        ) {
          config.headers.set(STORE_PREVIEW_HEADER, previewToken);
        }

        // No Authorization header is ever set here. Session tokens live in
        // httpOnly, store-scoped cookies (lib/auth/cookies.ts) that browser JS
        // cannot read; authenticated calls go through the same-origin proxy
        // built by createStoreApiClient() below, which attaches the bearer
        // token server-side.
        return config;
      },
      error => {
        return Promise.reject(error);
      }
    );

    // Response interceptor - handle common errors and format responses
    this.axiosInstance.interceptors.response.use(
      (response: AxiosResponse) => {
        // Success response
        return response;
      },
      (error: AxiosError) => {
        // Never the error itself: its config carries the request headers,
        // the preview token and the API key among them.
        console.error("API Client Error:", {
          method: error.config?.method?.toUpperCase(),
          url: error.config?.url,
          status: error.response?.status,
          code:
            (error.response?.data as { code?: unknown } | undefined)?.code ??
            error.code,
        });
        // Handle common error scenarios
        if (error.code === "ECONNABORTED") {
          // Timeout error
          error.message = "Request timeout - please try again";
        } else if (!error.response) {
          // Network error
          error.message = "Network error - check your connection";
        }

        // A platform admin suspended this store mid-session. The initial
        // page render already handles suspension at store-resolution time
        // (app/store/[storeRef]/layout.tsx, proxy.ts) — but a client-side
        // call *after* that render (add-to-cart, checkout, a review
        // submission) hits this same guarded backend independently, and
        // isn't covered by that one-time check. Only the browser can
        // navigate on it; server-side callers still just get the rejection.
        if (
          typeof window !== "undefined" &&
          error.response?.status === 403 &&
          isStoreSuspendedResponseBody(error.response?.data)
        ) {
          window.location.href = STORE_SUSPENDED_REDIRECT_PATH;
        }

        // Likewise, the store went (or still is) coming soon. Not from the
        // coming soon page itself, so a call made there cannot reload it in
        // a loop. It is always this root path in the browser: the
        // middleware rewrites to it without changing the URL, and the shared
        // path-based host has no such page (known limitation,
        // create-storefront-middleware.ts).
        if (
          typeof window !== "undefined" &&
          error.response?.status === 403 &&
          isStoreComingSoonResponseBody(error.response?.data) &&
          window.location.pathname !== STORE_COMING_SOON_REDIRECT_PATH &&
          comingSoonEndsThisVisit(error.config?.method)
        ) {
          window.location.href = STORE_COMING_SOON_REDIRECT_PATH;
        }

        return Promise.reject(error);
      }
    );
  }

  private handleResponse<T>(response: AxiosResponse<T>): ApiResponse<T> {
    return {
      success: true,
      data: response.data,
    };
  }

  private handleError(error: any): ApiResponse<never> {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<any>;
      const responseData = axiosError.response?.data || {};
      return {
        success: false,
        error: {
          message:
            responseData.message || axiosError.message || "Request failed",
          statusCode: axiosError.response?.status || 0,
          // The backend serialises business errors as
          // `{ code, message, details, timestamp }`, so the stable identifier
          // lands in `code` — this is the browser-side twin of the same read
          // in `lib/auth/sdk.ts`. `unwrap()` copies it onto
          // `ApiClientError.code`, which `lib/auth/error-copy.ts` localises.
          // `responseData.error` is kept for any endpoint using Nest's default
          // envelope, and the axios code (ECONNABORTED, ERR_NETWORK) last.
          error: responseData.code || responseData.error || axiosError.code,
          // `unwrap()` copies this onto `ApiClientError.details`; checkout
          // reads `details.items` to mark the cart lines that are short.
          details: responseData.details,
        },
      };
    }

    return {
      success: false,
      error: {
        message:
          error instanceof Error ? error.message : "Unknown error occurred",
        statusCode: 0,
      },
    };
  }

  async get<T>(
    url: string,
    config?: AxiosRequestConfig
  ): Promise<ApiResponse<T>> {
    try {
      const response = await this.axiosInstance.get<T>(url, config);
      return this.handleResponse(response);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async post<T>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<ApiResponse<T>> {
    try {
      const response = await this.axiosInstance.post<T>(url, data, config);
      return this.handleResponse(response);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async put<T>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<ApiResponse<T>> {
    try {
      const response = await this.axiosInstance.put<T>(url, data, config);
      return this.handleResponse(response);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async patch<T>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<ApiResponse<T>> {
    try {
      const response = await this.axiosInstance.patch<T>(url, data, config);
      return this.handleResponse(response);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async delete<T>(
    url: string,
    config?: AxiosRequestConfig
  ): Promise<ApiResponse<T>> {
    try {
      const response = await this.axiosInstance.delete<T>(url, config);
      return this.handleResponse(response);
    } catch (error) {
      return this.handleError(error);
    }
  }

  // Additional utility methods
  getAxiosInstance(): AxiosInstance {
    return this.axiosInstance;
  }

  // Method to update base URL if needed
  setBaseURL(baseUrl: string): void {
    this.axiosInstance.defaults.baseURL = baseUrl.replace(/\/$/, "");
  }

  // Method to set default timeout
  setTimeout(timeout: number): void {
    this.axiosInstance.defaults.timeout = timeout;
  }
}

/**
 * Direct, key-authenticated client for the backend's own origin. Public
 * endpoints only — it can never carry a session token (see the request
 * interceptor above).
 */
export const publicApiClient = new ApiClient(publicConfig().apiUrl);

/**
 * A store-scoped instance whose baseURL is the same-origin proxy route
 * `/store/<storeRef>/api/backend`, so the httpOnly session cookie is sent with
 * every request and `lib/api/proxy.ts` turns it into a bearer token
 * server-side. It deliberately does NOT send `x-storefront-api-key` from the
 * browser: the proxy attaches it.
 *
 * The timeout is wider than the direct client's because a proxied call may
 * include one refresh round trip plus a retry.
 */
export function createStoreApiClient(storeRef: string): ApiClient {
  return new ApiClient(storeApiPath(storeRef, "backend"), {
    withApiKey: false,
    timeout: 20000,
  });
}

// Export the class for custom instances
export { ApiClient };
