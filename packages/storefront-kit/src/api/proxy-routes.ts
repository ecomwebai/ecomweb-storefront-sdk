/**
 * The storefront routes that go through the same-origin store proxy.
 *
 * A route in this list goes through the proxy, which attaches the storefront
 * secret key server-side. A public API route may stay listed (a secret key
 * also works on public routes). A private route missing here is broken in the
 * browser and refused by the proxy. This is the single list to edit; it must
 * agree with the API's route table (`@StorefrontAccess` classification).
 *
 * Shopper auth is not listed: it goes through the kit's auth routes, never
 * the backend proxy.
 */
export type ProxiedMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface ProxiedRoute {
  method: ProxiedMethod;
  /**
   * Relative to the API base. `/`-separated; exactly one `:storeRef`; any
   * other `:name` segment matches one non-empty segment.
   */
  path: string;
  /**
   * `private`: needs the secret key. `shopper-read`: a public route that
   * reads the shopper's session when a bearer is present.
   */
  access: "private" | "shopper-read";
}

const GUEST = "storefront/stores/:storeRef";
const CUSTOMER = "storefront/stores/:storeRef/customers";
const TENANT = CUSTOMER;

const priv = (method: ProxiedMethod, path: string): ProxiedRoute => ({
  method,
  path,
  access: "private",
});
const shopperRead = (path: string): ProxiedRoute => ({
  method: "GET",
  path,
  access: "shopper-read",
});

export const PROXIED_STOREFRONT_ROUTES: readonly ProxiedRoute[] = [
  // Guest cart
  priv("GET", `${GUEST}/cart`),
  priv("DELETE", `${GUEST}/cart`),
  priv("POST", `${GUEST}/cart/items`),
  priv("PUT", `${GUEST}/cart/items/:itemId`),
  priv("DELETE", `${GUEST}/cart/items/:itemId`),
  // Customer cart
  priv("GET", `${CUSTOMER}/cart`),
  priv("DELETE", `${CUSTOMER}/cart`),
  priv("POST", `${CUSTOMER}/cart/items`),
  priv("PUT", `${CUSTOMER}/cart/items/:itemId`),
  priv("DELETE", `${CUSTOMER}/cart/items/:itemId`),
  priv("POST", `${CUSTOMER}/cart/merge`),
  // Orders
  priv("POST", `${GUEST}/orders`),
  priv("GET", `${GUEST}/orders/lookup`),
  priv("GET", `${TENANT}/orders`),
  priv("POST", `${TENANT}/orders`),
  priv("GET", `${TENANT}/orders/:id`),
  priv("DELETE", `${TENANT}/orders/:id`),
  // Payments
  priv("POST", `${GUEST}/payments/initiate`),
  priv("GET", `${GUEST}/orders/:orderCode/payment-state`),
  // Review invitations
  priv("GET", `${GUEST}/review-invitations/by-order`),
  priv("GET", `${GUEST}/review-invitations/by-orders`),
  priv("GET", `${GUEST}/review-invitations/:token`),
  priv("POST", `${GUEST}/review-invitations/:token/submit`),
  // Checkout quotes
  priv("POST", `${GUEST}/shipping/calculate`),
  priv("POST", `${GUEST}/promotions/validate`),
  // Blog
  priv("POST", `${GUEST}/blog/posts/:postId/comments`),
  shopperRead(`${GUEST}/blog/posts/:postId/comments`),
  // Metaobjects
  shopperRead(`${GUEST}/metaobjects/:type`),
  shopperRead(`${GUEST}/metaobjects/:type/:handle`),
  // Customer
  priv("GET", `${TENANT}/metafields`),
  priv("PUT", `${TENANT}/metafields`),
  priv("GET", `${TENANT}/address`),
  priv("POST", `${TENANT}/address`),
  priv("GET", `${TENANT}/address/:addressId`),
  priv("PATCH", `${TENANT}/address/:addressId`),
  priv("DELETE", `${TENANT}/address/:addressId`),
  priv("PATCH", `${TENANT}/address/:addressId/set-default`),
  // Web vitals
  priv("POST", `${GUEST}/web-vitals`),
];

const PARSED = PROXIED_STOREFRONT_ROUTES.map(route => ({
  route,
  parts: route.path.split("/"),
}));

/**
 * Whether a decoded segment is safe to forward under the secret key: not
 * empty, not a dot segment, and free of path/query delimiters. A `%` left
 * after the proxy's one decode means a double-encoded value.
 */
function isSafeSegment(segment: string): boolean {
  return (
    segment !== "" &&
    segment !== "." &&
    segment !== ".." &&
    !/[/\\?#%\s]/.test(segment) &&
    ![...segment].some(c => c.charCodeAt(0) < 0x20 || c.charCodeAt(0) === 0x7f)
  );
}

function matchSegments(
  method: string,
  segments: readonly string[],
  strict: boolean
): { route: ProxiedRoute; storeRef: string } | null {
  if (strict && !segments.every(isSafeSegment)) return null;
  const verb = method.toUpperCase();
  for (const { route, parts } of PARSED) {
    if (route.method !== verb || parts.length !== segments.length) continue;
    let storeRef = "";
    let ok = true;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]!;
      const seg = segments[i]!;
      if (part === ":storeRef") {
        if (!seg) {
          ok = false;
          break;
        }
        storeRef = seg;
      } else if (part.startsWith(":")) {
        if (!seg) {
          ok = false;
          break;
        }
      } else if (part !== seg) {
        ok = false;
        break;
      }
    }
    if (ok) return { route, storeRef };
  }
  return null;
}

/**
 * The listed route a request matches, and the store its path names.
 * `segments` are already decoded once, as Next passes them. Any segment that
 * is empty, `.`, `..`, double-encoded or holds `/ \ ? #` rejects the whole
 * path, since a matched path is forwarded under the secret key. So does any
 * control character or whitespace (URL parsing strips tab/LF/CR, so `.\t.`
 * could collapse to `..`).
 *
 * Callers that forward the matched segments must `encodeURIComponent` each
 * one when building the upstream URL.
 */
export function matchProxiedRoute(
  method: string,
  segments: readonly string[]
): { route: ProxiedRoute; storeRef: string } | null {
  return matchSegments(method, segments, true);
}

function decodeSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

/** The private entry a request URL (path with optional query) matches. */
export function findPrivateStorefrontRoute(
  method: string,
  url: string
): ProxiedRoute | null {
  const path = url.split("?")[0]!.split("#")[0]!;
  const segments = path.split("/").filter(Boolean).map(decodeSegment);
  // Lenient on purpose: this only refuses, it never forwards.
  const match = matchSegments(method, segments, false);
  return match && match.route.access === "private" ? match.route : null;
}

export function isPrivateStorefrontPath(method: string, url: string): boolean {
  return findPrivateStorefrontRoute(method, url) !== null;
}
