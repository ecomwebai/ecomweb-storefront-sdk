import { publicNextUrl } from "../request/public-url";
import { REQUEST_PATH_HEADER } from "../request/request-path";
import { SERVED_STORE_HEADER } from "../request/served-store";
import {
  applyThemePreview,
  hasThemePreview,
  THEME_PREVIEW_PARAM,
  themePreviewCookieName,
} from "../theme/preview-cookie";
import {
  externalStorefrontUrl,
  isSameHost,
} from "../theme/external-storefront";
import { NextRequest, NextResponse } from "next/server";
import type { UrlRedirect } from "@ecomweb/sdk";
import { authCookiePath, writeAuthCookies } from "../auth/cookies";
import {
  downstreamRequestHeaders,
  refreshIfNearExpiry,
} from "../auth/session-refresh";
import type { StorefrontMode } from "../config/mode";
import { publicConfig } from "../config/public";
import { lookupRedirect } from "../redirects/lookup-redirect";
import { multiTenantStorePath } from "../store-scope";
import { getStoreByHost } from "../stores/get-store-by-host";
import { STORE_COMING_SOON_REDIRECT_PATH } from "../stores/store-coming-soon";
import {
  applyStorePreview,
  firstLivePreviewToken,
  STORE_PREVIEW_PATH,
  STORE_PREVIEW_TOKEN_HEADER,
  storePreviewCookieName,
} from "../stores/store-preview-cookie";
import { getStoreSubdomain } from "../stores/store-subdomain";
import { recordStoreRequest } from "../stores/store-traffic";
import {
  PREVIEW_HOST_ROBOTS,
  THEME_PREVIEW_HOST_HEADER,
} from "../theme/preview-host";

/** Served from the app root in both modes; never rewritten or redirected. */
const METADATA_FILES = [
  "/robots.txt",
  "/sitemap.xml",
  "/favicon.ico",
  "/manifest.json",
  "/manifest.webmanifest",
  "/icon",
  "/apple-icon",
];

/**
 * Metadata files that follow the store to an external site: crawlers must
 * find the external site's robots.txt and sitemap, not ours.
 */
const EXTERNAL_METADATA_FILES = ["/robots.txt", "/sitemap.xml"];

/** Rewrite target when a store's external URL still points at Ecomweb. */
const DOMAIN_NOT_CONNECTED_PATH = "/domain-not-connected";

/**
 * Cache-Control on the subdomain → custom domain 301. An hour keeps the 301
 * for search engines and caps how long browsers follow it after the merchant
 * removes the domain.
 */
const CUSTOM_DOMAIN_REDIRECT_CACHE = "public, max-age=3600";

/**
 * The response for a store whose live theme is external, or null to serve
 * the request here (theme anatomy spec, "Storefront"):
 * - 302 to the external URL with the same path and query (307 for non-GET,
 *   so the method survives); never 301, the merchant may switch back.
 * - never while previewing (`?preview_theme=` or the preview cookie): a
 *   preview of an Ecomweb theme must render here.
 * - the external URL is this very host (the domain still points at Ecomweb):
 *   a "domain not connected" page rather than a redirect loop (robots.txt
 *   and the sitemap are still served here).
 * - no usable URL: null (fail open).
 */
function externalThemeResponse(
  req: NextRequest,
  host: string,
  storeRef: string,
  externalUrl: string | null | undefined
): NextResponse | null {
  if (!externalUrl) return null;
  if (
    req.nextUrl.searchParams.has(THEME_PREVIEW_PARAM) ||
    hasThemePreview(req, authCookiePath(storeRef, true))
  )
    return null;

  const pathname = req.nextUrl.pathname;
  const prefix = multiTenantStorePath(storeRef);
  const logicalPath =
    pathname === prefix || pathname.startsWith(`${prefix}/`)
      ? pathname.slice(prefix.length) || "/"
      : pathname;
  const target = externalStorefrontUrl(
    externalUrl,
    logicalPath,
    req.nextUrl.search
  );
  if (!target) return null;

  if (isSameHost(host, target.hostname)) {
    // Our own robots.txt and sitemap still describe this host correctly.
    if (EXTERNAL_METADATA_FILES.includes(pathname)) return null;
    const url = req.nextUrl.clone();
    url.pathname = DOMAIN_NOT_CONNECTED_PATH;
    url.search = "";
    const res = NextResponse.rewrite(url, withoutInternalHeaders(req));
    res.headers.set("x-robots-tag", "noindex");
    return res;
  }

  const safe = req.method === "GET" || req.method === "HEAD";
  return NextResponse.redirect(target, { status: safe ? 302 : 307 });
}

/**
 * The init for a response that lets the request through without the full
 * downstream headers (metadata files, the "domain not connected" and apex
 * 404 rewrites): the client's headers minus the middleware's internal ones.
 * With it, every request the matcher covers reaches the app with no client
 * copy of them, so a server-side reader can trust them there.
 */
function withoutInternalHeaders(req: NextRequest): {
  request: { headers: Headers };
} {
  const headers = new Headers(req.headers);
  headers.delete(THEME_PREVIEW_HOST_HEADER);
  headers.delete(STORE_PREVIEW_TOKEN_HEADER);
  headers.delete(SERVED_STORE_HEADER);
  return { request: { headers } };
}

/** True while the store preview cookie at `cookiePath` holds a token. */
function hasStorePreview(req: NextRequest, cookiePath: string): boolean {
  return !!req.cookies.get(storePreviewCookieName(cookiePath))?.value;
}

/**
 * The preview token for the host lookup on a store host: the store preview
 * cookie, else the theme preview cookie (`?preview_theme=` on the store's own
 * host), both at `/`; an expired one yields to the other. Read from the cookies only, never through
 * `storePreviewTokenFrom`: that trusts `STORE_PREVIEW_TOKEN_HEADER`, and on
 * the middleware's incoming request that header is whatever the client sent.
 */
function hostLookupPreviewToken(req: NextRequest): string | null {
  return firstLivePreviewToken(
    req.cookies.get(storePreviewCookieName("/"))?.value,
    req.cookies.get(themePreviewCookieName("/"))?.value
  );
}

/**
 * Path-based dev access: only outside production, and only the host named
 * exactly `localhost`, `127.0.0.1` or `[::1]` (port ignored). A look-alike such
 * as `mylocalhostshop.com` is a store host, so a client cannot choose the
 * served store through the path there.
 */
function isLocalDevelopmentHost(host: string): boolean {
  if (process.env.NODE_ENV === "production") return false;
  const hostname = host.startsWith("[")
    ? host.slice(0, host.indexOf("]") + 1)
    : host.split(":")[0];
  return ["localhost", "127.0.0.1", "[::1]"].includes(hostname.toLowerCase());
}

/**
 * The store a request belongs to, as far as the *path* can say.
 *
 * On localhost and on the platform apex there is no host→store mapping, but
 * the path is `/store/<storeRef>/…` — which is also how the auth cookies are
 * named. `params.storeRef` arrives URL-decoded downstream, so decode here too.
 */
function storeRefFromPath(pathname: string): string | null {
  const match = /^\/store\/([^/]+)/.exec(pathname);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]) || null;
  } catch {
    return match[1];
  }
}

/**
 * Where a stored redirect sends this request, on this request's own host.
 *
 * The destination is parsed as a URL rather than assigned to `pathname`,
 * which would percent-encode its `?` and lose the query. A destination with
 * a query (or fragment) keeps its own; one without carries the request's
 * query over, as before. Only the destination's path, query and fragment are
 * used, so the redirect never leaves the store's host.
 */
function redirectDestinationUrl(
  req: NextRequest,
  destination: string,
  pathPrefix = ""
) {
  const url = publicNextUrl(req);
  const parsed = new URL(destination, "http://destination.invalid");
  url.pathname = `${pathPrefix}${parsed.pathname}`;
  if (parsed.search) url.search = parsed.search;
  if (parsed.hash) url.hash = parsed.hash;
  return url;
}

/**
 * Turns a stored redirect row into the 301/302 response for it.
 *
 * `pathPrefix` re-adds the `/store/<ref>` segment that direct path-based
 * access needs on the destination but a host-mapped request (whose
 * `destination_path` is already store-root-relative) does not.
 */
function buildRedirectResponse(
  req: NextRequest,
  redirect: UrlRedirect,
  pathPrefix = ""
): NextResponse {
  return NextResponse.redirect(
    redirectDestinationUrl(req, redirect.destination_path, pathPrefix),
    { status: redirect.redirect_type }
  );
}

/**
 * `/store/<ref>/…` on the platform apex: never served here, sent to the
 * store's own subdomain instead.
 *
 * On the apex every store shares one origin, and a merchant's embedded
 * scripts run there. A cookie's Path is no boundary between pages of one
 * origin: store A's script could fetch `/store/B/api/…` with B's shopper
 * cookies attached, or frame `/store/B` and read it. Each store's subdomain
 * is its own origin. Localhost keeps path-based access (it is not the apex).
 *
 * 302 (307 for non-GET), not 301: the merchant may change the subdomain.
 * The subdomain then sends shoppers on to a custom domain when there is one.
 * No store, no subdomain, or the API unreachable: the 404 page.
 */
async function apexStoreResponse(
  req: NextRequest,
  storeRef: string,
  platformDomain: string
): Promise<NextResponse> {
  let subdomain: string | null = null;
  try {
    subdomain = await getStoreSubdomain(storeRef);
  } catch (error) {
    console.error("Store lookup failed for apex path:", storeRef, error);
  }

  if (!subdomain) {
    const url = req.nextUrl.clone();
    url.pathname = "/404";
    url.search = "";
    return NextResponse.rewrite(url, withoutInternalHeaders(req));
  }

  const prefix = multiTenantStorePath(storeRef);
  const pathname = req.nextUrl.pathname;
  const target = publicNextUrl(req);
  target.hostname = `${subdomain}.${platformDomain}`;
  target.port = "";
  target.pathname = pathname.startsWith(`${prefix}/`)
    ? pathname.slice(prefix.length)
    : "/";
  const safe = req.method === "GET" || req.method === "HEAD";
  return NextResponse.redirect(target, { status: safe ? 302 : 307 });
}

async function multiTenant(req: NextRequest): Promise<NextResponse> {
  const host = req.headers.get("host") || "";
  const pathname = req.nextUrl.pathname;

  // Skip metadata files - these are served from app root level - except the
  // ones that follow an external theme (checked once the store is known).
  const isMetadataFile = METADATA_FILES.includes(pathname);
  if (isMetadataFile && !EXTERNAL_METADATA_FILES.includes(pathname)) {
    return NextResponse.next(withoutInternalHeaders(req));
  }

  // Store-by-host resolution and redirect lookup genuinely do not apply on
  // localhost or on the platform apex — but the token refresh below does, so
  // these only skip the host-specific work now, not the whole middleware.
  const platformDomain = publicConfig().platformDomainSuffix ?? "ecomsite.app";
  const isLocalDevHost = isLocalDevelopmentHost(host);
  const hostIdentifiesStore =
    !isLocalDevHost &&
    host !== platformDomain &&
    host !== `www.${platformDomain}`;

  const isPlatformApex =
    host === platformDomain || host === `www.${platformDomain}`;
  if (isPlatformApex) {
    const apexStoreRef = storeRefFromPath(pathname);
    if (apexStoreRef)
      return apexStoreResponse(req, apexStoreRef, platformDomain);
  }

  // The dashboard's preview link on the store's own host. Before the lookup:
  // a coming soon store's host resolves to nothing until the cookie is set.
  if (hostIdentifiesStore && pathname === STORE_PREVIEW_PATH) {
    return applyStorePreview(req, "/", "/");
  }

  let hostStoreRef: string | null = null;
  let hostResolved = false;

  let hostStoreSuspended = false;
  let hostStoreComingSoon = false;
  // A theme's preview host (theme preview hosts): the theme's slug.
  let previewSlug: string | null = null;
  // A preview host's store preview token for a coming soon store (lookup).
  let storePreviewToken: string | null = null;

  if (isMetadataFile && !hostIdentifiesStore)
    return NextResponse.next(withoutInternalHeaders(req));

  if (hostIdentifiesStore) {
    try {
      // Without a token, the plain call: its answer is cached for the host.
      const previewToken = hostLookupPreviewToken(req);
      const lookup = previewToken
        ? await getStoreByHost(host, { previewToken })
        : await getStoreByHost(host);
      const { storeRef, domain, isSubDomain, suspended, externalUrl } = lookup;
      hostResolved = true;
      hostStoreRef = storeRef || null;
      hostStoreSuspended = suspended;
      hostStoreComingSoon = !storeRef && !!lookup.comingSoon;
      previewSlug = storeRef ? lookup.previewSlug : null;
      storePreviewToken = previewSlug ? lookup.storePreviewToken || null : null;

      // Nothing on a preview host is for search engines.
      if (previewSlug && isMetadataFile) {
        return pathname === "/robots.txt"
          ? new NextResponse(PREVIEW_HOST_ROBOTS, {
              headers: { "content-type": "text/plain" },
            })
          : new NextResponse(null, { status: 404 });
      }

      if (storeRef) {
        // An external theme is live: the shopper belongs on that site. Before
        // the subdomain → custom domain redirect, which would only add a hop.
        const external = externalThemeResponse(
          req,
          host,
          storeRef,
          externalUrl
        );
        if (external) return external;
      }

      if (isMetadataFile) return NextResponse.next(withoutInternalHeaders(req));

      if (storeRef) {
        // If accessing via subdomain but custom domain exists, redirect to
        // custom domain. Not a preview host: it is the theme's, not the store's.
        if (isSubDomain && domain && domain !== host && !previewSlug) {
          const url = publicNextUrl(req);
          url.hostname = domain;
          url.protocol = "https:";
          url.port = ""; // Remove port for custom domain
          const response = NextResponse.redirect(url, { status: 301 });
          // Browsers keep an uncached 301 forever: if the merchant removes a
          // broken domain, shoppers would never come back to the subdomain.
          response.headers.set("Cache-Control", CUSTOM_DOMAIN_REDIRECT_CACHE);
          return response;
        }

        // Check for URL redirects BEFORE rewriting
        // Skip redirect check if path already starts with /store/ (internal rewrite)
        if (!pathname.startsWith(multiTenantStorePath(storeRef))) {
          const redirect = await lookupRedirect(storeRef, pathname);

          if (redirect) {
            return buildRedirectResponse(req, redirect);
          }
        }
      }
    } catch (error) {
      console.debug("Middleware error:", error);
      if (isMetadataFile) return NextResponse.next(withoutInternalHeaders(req));
      // Fall through: no host mapping, but the refresh below still applies.
      hostResolved = false;
      hostStoreRef = null;
    }
  }

  // The host names the store on custom domains and subdomains; everywhere else
  // (localhost, the apex, direct /store/<ref>/… access) the path does.
  const storeRef = hostStoreRef ?? storeRefFromPath(pathname);
  if (storeRef) recordStoreRequest(storeRef);

  // A dashboard preview link: store its token in a cookie, then redirect to
  // the clean URL (themes spec §6.1). A coming soon store's own host resolves
  // no store until a preview token comes with the lookup, so there the link
  // becomes the host's `/` cookie, the lookup's fallback token
  // (hostLookupPreviewToken).
  if (hostStoreComingSoon) {
    const preview = applyThemePreview(req, "/");
    if (preview) return preview;
  }
  const cookiePath = storeRef ? authCookiePath(storeRef, !!hostStoreRef) : null;
  if (storeRef && cookiePath) {
    const preview = applyThemePreview(req, cookiePath);
    if (preview) return preview;
    // The store preview link on the shared path-based host (localhost; the
    // apex already sent /store/<ref>/… to the store's subdomain above). Not
    // on a store host, even one that resolved no store: it takes `/preview`.
    if (
      !hostIdentifiesStore &&
      pathname === multiTenantStorePath(storeRef, STORE_PREVIEW_PATH)
    ) {
      return applyStorePreview(req, cookiePath, multiTenantStorePath(storeRef));
    }
  }

  // Direct /store/<ref>/… access never goes through the host-mapped branch
  // above, so it gets no redirect check there. `redirect_source_path` rows
  // are store-root-relative (e.g. "/old"), the same shape a host-mapped
  // request already checks against — strip the /store/<ref> prefix to
  // recover that shape, and re-add it on the destination.
  if (!hostStoreRef && storeRef) {
    const prefix = multiTenantStorePath(storeRef);
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
      try {
        const logicalPath = pathname.slice(prefix.length) || "/";
        const redirect = await lookupRedirect(storeRef, logicalPath);

        if (redirect) {
          return buildRedirectResponse(req, redirect, prefix);
        }
      } catch (error) {
        // Fail open: lookupRedirect already catches internally and never
        // rejects, but this belongs to the caller's contract, not the
        // callee's — a future regression there must not take the page down.
        console.debug("Redirect lookup error:", error);
      }
    }
  }

  const rotated =
    storeRef && cookiePath
      ? await refreshIfNearExpiry(req, storeRef, cookiePath)
      : null;
  const downstream = downstreamRequestHeaders(
    req,
    !!hostStoreRef,
    storeRef,
    rotated,
    // A store host's own lookup decides (none if it failed). Only the local
    // dev host is path-based; anywhere else the path names no served store.
    isLocalDevHost
      ? storeRefFromPath(pathname)
      : hostIdentifiesStore
        ? hostStoreRef
        : null
  );
  downstream.set(
    REQUEST_PATH_HEADER,
    `${req.nextUrl.pathname}${req.nextUrl.search}`
  );
  if (previewSlug) downstream.set(THEME_PREVIEW_HOST_HEADER, previewSlug);
  // Set after downstreamRequestHeaders deleted any copy the client sent. On
  // every request to the preview host, the backend proxy's included.
  if (previewSlug && storePreviewToken)
    downstream.set(STORE_PREVIEW_TOKEN_HEADER, storePreviewToken);
  const init = { request: { headers: downstream } };

  let response: NextResponse;

  if (hostStoreRef) {
    const url = req.nextUrl.clone();
    // Only rewrite if the path doesn't already start with /store/
    if (!url.pathname.startsWith(multiTenantStorePath(hostStoreRef))) {
      url.pathname = multiTenantStorePath(hostStoreRef, url.pathname);
    }

    response = NextResponse.rewrite(url, init);
    // Add headers to indicate this is a domain-mapped store
    response.headers.set("x-store-domain", "true");
    response.headers.set("x-store-ref", hostStoreRef);
  } else if (hostStoreSuspended) {
    // A platform admin suspended this store. The 403 the backend returned
    // for a domain lookup carries no ref/id to route on (see
    // getStoreByHost), so this can't rewrite to `/store/<ref>` the way the
    // resolved-store branch above does — it goes to a platform-level page
    // instead of the not-found path below.
    const url = req.nextUrl.clone();
    url.pathname = "/store-suspended";
    response = NextResponse.rewrite(url, init);
  } else if (hostStoreComingSoon) {
    // The merchant has not opened the store, and the request carried no
    // valid preview token (an expired one lands here too). Like the
    // suspended branch, the 403 carries no ref, so a platform-level page.
    // Known limitation: on the shared path-based host (localhost) nothing
    // routes here; a store that turns coming soon mid-session sends the
    // browser to /coming-soon, which resolves no store there and 404s, as
    // the apex's /store/<ref> already does for these stores.
    const url = req.nextUrl.clone();
    url.pathname = STORE_COMING_SOON_REDIRECT_PATH;
    response = NextResponse.rewrite(url, init);
    response.headers.set("x-robots-tag", "noindex");
  } else if (hostResolved) {
    // The host looked like a store host but resolved to nothing: 404.
    console.debug("Store not found for host:", host);
    const url = req.nextUrl.clone();
    url.pathname = "/404";
    response = NextResponse.rewrite(url, init);
  } else {
    response = NextResponse.next(init);
  }

  // A store preview cookie lives at `/` on a store host, even when the host
  // resolved no store (coming soon), else at the store's path.
  const storePreviewPath = hostIdentifiesStore ? "/" : cookiePath;
  if (
    previewSlug ||
    (cookiePath && hasThemePreview(req, cookiePath)) ||
    (storePreviewPath && hasStorePreview(req, storePreviewPath))
  ) {
    response.headers.set("x-robots-tag", "noindex");
  }

  if (rotated && storeRef && cookiePath) {
    // Same path the auth route handler writes with, from the same signal.
    writeAuthCookies(response, storeRef, rotated, cookiePath);
  }

  return response;
}

/**
 * Single-store middleware: the store is fixed by ECOMWEB_STORE_REF, so there
 * is no host lookup and no rewrite. It applies the store's URL redirects and
 * refreshes a near-expiry session. Requests are stamped host-mapped, so auth
 * cookies use Path=/ (see auth/cookies.ts).
 */
async function singleStore(req: NextRequest): Promise<NextResponse> {
  const pathname = req.nextUrl.pathname;
  if (METADATA_FILES.includes(pathname))
    return NextResponse.next(withoutInternalHeaders(req));

  const storeRef = publicConfig().storeRef as string;

  const cookiePath = authCookiePath(storeRef, true);
  if (pathname === STORE_PREVIEW_PATH)
    return applyStorePreview(req, cookiePath, "/");
  const preview = applyThemePreview(req, cookiePath);
  if (preview) return preview;

  try {
    const redirect = await lookupRedirect(storeRef, pathname);
    if (redirect) {
      return NextResponse.redirect(
        redirectDestinationUrl(req, redirect.destination_path),
        { status: redirect.redirect_type }
      );
    }
  } catch (error) {
    // Fail open: a redirect lookup must never take the page down.
    console.debug("Redirect lookup error:", error);
  }

  const rotated = await refreshIfNearExpiry(req, storeRef, cookiePath);
  const response = NextResponse.next({
    request: {
      headers: downstreamRequestHeaders(req, true, storeRef, rotated, storeRef),
    },
  });

  if (hasThemePreview(req, cookiePath) || hasStorePreview(req, cookiePath))
    response.headers.set("x-robots-tag", "noindex");
  if (rotated) {
    writeAuthCookies(response, storeRef, rotated, cookiePath);
  }
  return response;
}

/**
 * The storefront's proxy.ts (Next middleware).
 * - multi: host → store lookup, rewrites to /store/<ref>, suspended and
 *   unknown stores, coming soon stores (rewritten to /coming-soon, noindex),
 *   redirects, session refresh. The store preview link (`/preview?token=`
 *   on a store host, `/store/<ref>/preview?token=` on localhost) becomes a
 *   cookie before the lookup, and the lookup carries that token.
 * - single: the `/preview?token=` link, redirects and session refresh.
 * Without `mode`, the configured mode (ECOMWEB_MODE) decides per request.
 */
export function createStorefrontMiddleware(
  opts: { mode?: StorefrontMode } = {}
): (req: NextRequest) => Promise<NextResponse> {
  return req =>
    (opts.mode ?? publicConfig().mode) === "multi"
      ? multiTenant(req)
      : singleStore(req);
}

/**
 * Next reads `config` from proxy.ts statically, so an app re-exports this as
 * `export const config = { matcher: [...] }` with the same literal.
 */
export const storefrontMiddlewareConfig = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - _vercel (Vercel Analytics; off Vercel, a store page render per hit)
     * - favicon.ico (favicon file)
     */
    "/((?!api|_next/static|_next/image|_vercel|favicon.ico).*)",
  ],
};
