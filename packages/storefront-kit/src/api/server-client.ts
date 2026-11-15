import { ApiResponse, AuthenticatedApiClient } from "../interfaces";
import { authCookiePathFor, readAuthCookies } from "../auth/cookies";
import { publicConfig } from "../config";

const DEFAULT_TIMEOUT = 10000; // 10 seconds

interface FetchConfig {
  headers?: Record<string, string>;
  signal?: AbortSignal;
  /**
   * Auth cookies are store-scoped (see lib/auth/cookies.ts), so a
   * `requireAuth` request needs to know which store's cookie to read. There
   * is no store context at the module level (serverApiClient is a shared
   * singleton), so callers thread it through here instead.
   */
  storeRef?: string;
  [key: string]: any;
}

class ServerApiClient implements AuthenticatedApiClient {
  private baseUrl: string;
  private timeout: number;
  private requireAuth: boolean;

  constructor(
    baseUrl: string = publicConfig().apiUrl,
    options?: { requireAuth?: boolean }
  ) {
    this.requireAuth =
      options?.requireAuth !== undefined ? options.requireAuth : true;
    this.baseUrl = baseUrl.replace(/\/$/, ""); // Remove trailing slash
    this.timeout = DEFAULT_TIMEOUT;
  }

  private async getAuthToken(storeRef?: string): Promise<string | null> {
    if (!this.requireAuth) {
      return null;
    }

    if (!storeRef) {
      // Auth cookies are store-scoped; without a storeRef there is no
      // cookie to read. Fail loudly rather than silently going anonymous.
      throw new Error(
        "ServerApiClient: storeRef is required for authenticated requests"
      );
    }

    // Dynamically import next/headers only when auth is needed — this
    // prevents Edge Runtime errors for non-auth requests.
    const { cookies, headers } = await import("next/headers");
    const tokens = readAuthCookies(
      await cookies(),
      storeRef,
      authCookiePathFor({ headers: await headers() }, storeRef)
    );

    if (!tokens) {
      throw new Error("User not authenticated");
    }

    return tokens.access_token;
  }

  private async makeRequest<T>(
    url: string,
    options: RequestInit = {},
    config?: FetchConfig
  ): Promise<ApiResponse<T>> {
    try {
      // Set up timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      // Prepare headers
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...config?.headers,
      };

      // Add platform API key for authentication
      const platformApiKey = publicConfig().storefrontApiKey;
      if (platformApiKey) {
        headers["x-storefront-api-key"] = platformApiKey;
      }

      // Add auth token if required
      if (this.requireAuth) {
        const token = await this.getAuthToken(config?.storeRef);
        if (token) {
          headers.Authorization = `Bearer ${token}`;
        }
      }

      // Make the fetch request
      const response = await fetch(`${this.baseUrl}${url}`, {
        ...options,
        headers,
        signal: config?.signal || controller.signal,
      });

      clearTimeout(timeoutId);

      // Parse response
      let data: T;
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        data = await response.json();
      } else {
        data = (await response.text()) as any;
      }

      // Handle non-OK responses
      if (!response.ok) {
        return {
          success: false,
          error: {
            message:
              (data as any)?.message ||
              `Request failed with status ${response.status}`,
            statusCode: response.status,
            error: (data as any)?.error || response.statusText,
            details: (data as any)?.details,
          },
        };
      }

      return {
        success: true,
        data,
      };
    } catch (error: any) {
      // Handle timeout
      if (error.name === "AbortError") {
        return {
          success: false,
          error: {
            message: "Request timeout - please try again",
            statusCode: 0,
            error: "TIMEOUT",
          },
        };
      }

      // Handle network errors
      if (error instanceof TypeError) {
        return {
          success: false,
          error: {
            message: "Network error - check your connection",
            statusCode: 0,
            error: "NETWORK_ERROR",
          },
        };
      }

      // Handle other errors
      return {
        success: false,
        error: {
          message:
            error instanceof Error ? error.message : "Unknown error occurred",
          statusCode: 0,
        },
      };
    }
  }

  async get<T>(url: string, config?: FetchConfig): Promise<ApiResponse<T>> {
    return this.makeRequest<T>(url, { method: "GET" }, config);
  }

  async post<T>(
    url: string,
    data?: any,
    config?: FetchConfig
  ): Promise<ApiResponse<T>> {
    return this.makeRequest<T>(
      url,
      {
        method: "POST",
        body: data ? JSON.stringify(data) : undefined,
      },
      config
    );
  }

  async put<T>(
    url: string,
    data?: any,
    config?: FetchConfig
  ): Promise<ApiResponse<T>> {
    return this.makeRequest<T>(
      url,
      {
        method: "PUT",
        body: data ? JSON.stringify(data) : undefined,
      },
      config
    );
  }

  async patch<T>(
    url: string,
    data?: any,
    config?: FetchConfig
  ): Promise<ApiResponse<T>> {
    return this.makeRequest<T>(
      url,
      {
        method: "PATCH",
        body: data ? JSON.stringify(data) : undefined,
      },
      config
    );
  }

  async delete<T>(url: string, config?: FetchConfig): Promise<ApiResponse<T>> {
    return this.makeRequest<T>(url, { method: "DELETE" }, config);
  }

  // Additional utility methods for server-side use
  setBaseURL(baseUrl: string): void {
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  setTimeout(timeout: number): void {
    this.timeout = timeout;
  }
}

// Create a default instance for server-side use
export const serverApiClient = new ServerApiClient();

// Create a server-side public (no-auth) instance
export const serverPublicApiClient = new ServerApiClient(publicConfig().apiUrl, {
  requireAuth: false,
});

// Export the class for custom instances
export { ServerApiClient };
