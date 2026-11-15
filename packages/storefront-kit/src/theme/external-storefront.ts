import { isHostMappedRequest } from "../auth/cookies";
import { REQUEST_PATH_HEADER } from "../request/request-path";

/**
 * Where a shopper's request goes when the store's live theme is external
 * (theme anatomy spec, "Storefront"): the external site's URL with the
 * request's path under its own path, and the query kept.
 *
 * `path` is the store-root-relative path as the request carried it (already
 * percent-encoded); `search` is `""` or starts with `?`. Null unless `base`
 * is an https URL, so a missing or bad value never redirects (fail open).
 */
export function externalStorefrontUrl(
  base: string | null | undefined,
  path: string,
  search: string
): URL | null {
  if (!base) return null;
  let url: URL;
  try {
    url = new URL(base);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  const basePath = url.pathname.replace(/\/+$/, "");
  const rel = path.startsWith("/") ? path : `/${path}`;
  url.pathname = rel === "/" ? basePath || "/" : `${basePath}${rel}`;
  url.search = search;
  url.hash = "";
  return url;
}

/** True when `host` (a Host header, port allowed) is `hostname`. */
export function isSameHost(host: string, hostname: string): boolean {
  const name = host.split(":")[0]?.trim().toLowerCase();
  return !!name && name === hostname.toLowerCase();
}

/**
 * Where the store layout sends a request when the published theme is
 * external, else null: the backstop for path-based access
 * (`/store/<ref>/…` on the shared host), which the middleware cannot check
 * because only the by-domain lookup carries `storefront_url`. Host-mapped
 * requests are left to the middleware, which already decided them. Never
 * while a preview is open, never to the request's own host, and null without
 * a usable https URL (fail open).
 */
export function externalThemeRedirectFor(
  request: { headers: { get(name: string): string | null } },
  storeRef: string,
  // The store's published theme (`PublishedStoreTheme` from @ecomweb/sdk).
  theme: { kind: string; external_url?: string | null } | null | undefined,
  previewOpen: boolean
): string | null {
  if (theme?.kind !== "external" || previewOpen) return null;
  if (isHostMappedRequest(request)) return null;

  const requested = request.headers.get(REQUEST_PATH_HEADER) || "/";
  const queryAt = requested.indexOf("?");
  const rawPath = queryAt < 0 ? requested : requested.slice(0, queryAt);
  const search = queryAt < 0 ? "" : requested.slice(queryAt);
  const path = rawPath.startsWith("/") ? rawPath : "/";

  let logicalPath = path;
  const match = /^\/store\/([^/]+)(\/.*)?$/.exec(path);
  if (match) {
    let segment = match[1] ?? "";
    try {
      segment = decodeURIComponent(segment);
    } catch {
      // keep the raw segment
    }
    if (segment === storeRef) logicalPath = match[2] || "/";
  }

  const target = externalStorefrontUrl(theme.external_url, logicalPath, search);
  if (!target) return null;
  if (isSameHost(request.headers.get("host") || "", target.hostname))
    return null;
  return target.toString();
}
