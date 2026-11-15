import type { IHttpClient, RequestOptions } from "./types";

// Replaced at build time (tsup `define`, and the workspace's Next and vitest
// configs) with this package's version from package.json.
declare const __ECOMWEB_SDK_VERSION__: string | undefined;

/**
 * This package's version, baked in at build time. `dev` when the source runs
 * without the define (the API ignores a version that isn't semver).
 */
export const SDK_VERSION: string =
  typeof __ECOMWEB_SDK_VERSION__ === "string" ? __ECOMWEB_SDK_VERSION__ : "dev";

/** Sent on every SDK request: space-separated `name/version` tokens. */
export const CLIENT_HEADER = "X-Ecomweb-Client";

/** This SDK's own token, `@ecomweb/sdk/<version>`. */
export const SDK_CLIENT_TOKEN = `@ecomweb/sdk/${SDK_VERSION}`;

/**
 * The `X-Ecomweb-Client` value: `clientInfo` (a caller's own tokens, such as
 * `@ecomweb/storefront-kit/0.14.0`) followed by this SDK's token.
 */
export function clientHeaderValue(clientInfo?: string): string {
  const prefix = clientInfo?.trim();
  return prefix ? `${prefix} ${SDK_CLIENT_TOKEN}` : SDK_CLIENT_TOKEN;
}

const WRAPPED = Symbol.for("ecomweb.sdk.clientHeader");

function withHeader(
  options: RequestOptions | undefined,
  value: string
): RequestOptions {
  const headers = options?.headers ?? {};
  const present = Object.keys(headers).some(
    name => name.toLowerCase() === CLIENT_HEADER.toLowerCase()
  );
  return {
    ...options,
    headers: present ? headers : { [CLIENT_HEADER]: value, ...headers },
  };
}

/**
 * Wraps an HTTP client so every request carries `X-Ecomweb-Client`. A header
 * the caller already set wins, and a client wrapped once is not wrapped again.
 */
export function withClientHeader(
  http: IHttpClient,
  clientInfo?: string
): IHttpClient {
  if ((http as { [WRAPPED]?: true })[WRAPPED]) return http;
  const value = clientHeaderValue(clientInfo);
  const wrapped: IHttpClient & { [WRAPPED]: true } = {
    [WRAPPED]: true,
    get: (url, options) => http.get(url, withHeader(options, value)),
    post: (url, data, options) =>
      http.post(url, data, withHeader(options, value)),
    put: (url, data, options) => http.put(url, data, withHeader(options, value)),
    patch: (url, data, options) =>
      http.patch(url, data, withHeader(options, value)),
    delete: (url, options) => http.delete(url, withHeader(options, value)),
  };
  return wrapped;
}
