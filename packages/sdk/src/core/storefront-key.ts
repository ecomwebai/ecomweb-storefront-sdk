import type { IHttpClient, RequestOptions } from "./types";

const KEY_HEADER = "x-storefront-api-key";

function withKey(options: RequestOptions | undefined, key: string): RequestOptions {
  const headers: Record<string, string> = {};
  for (const [name, value] of Object.entries(options?.headers ?? {})) {
    if (name.toLowerCase() !== KEY_HEADER) headers[name] = value;
  }
  headers[KEY_HEADER] = key;
  return { ...options, headers };
}

/**
 * Wraps an HTTP client so every request carries `x-storefront-api-key: <key>`.
 * A key header the caller set, in any casing, is removed: the secret wins.
 */
export function withStorefrontKey(http: IHttpClient, key: string): IHttpClient {
  return {
    get: (url, options) => http.get(url, withKey(options, key)),
    post: (url, data, options) => http.post(url, data, withKey(options, key)),
    put: (url, data, options) => http.put(url, data, withKey(options, key)),
    patch: (url, data, options) => http.patch(url, data, withKey(options, key)),
    delete: (url, options) => http.delete(url, withKey(options, key)),
  };
}
