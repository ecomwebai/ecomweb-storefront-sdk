import "server-only";
import type { NextRequest } from "next/server";
import { redirect } from "next/navigation";
import { handleBackendProxy } from "../api/proxy";
import {
  isSameOriginRequest,
  proxyNotFound,
  servedStoreRef,
} from "../api/proxy-guard";
import { handleAuthRoute } from "../auth/route-handlers";
import { getServerIdentity } from "../auth/session";
import { resolveStoreRef } from "../store-scope";
import { resolveRootStoreRef } from "../store-scope/root";

type Params = Record<string, string | string[] | undefined>;
export type RouteContext = { params: Promise<Params> };
export type RouteHandler = (
  req: NextRequest,
  ctx: RouteContext
) => Promise<Response>;

/**
 * The store a route serves: the /store/<ref> segment when the route has one,
 * otherwise whatever the host (or, single-store, the config) names.
 */
async function storeRefFor(params: Params): Promise<string | null> {
  if (typeof params.storeRef === "string") {
    return resolveStoreRef(Promise.resolve({ storeRef: params.storeRef }));
  }
  return resolveRootStoreRef();
}

const segments = (v: Params[string]): string[] =>
  Array.isArray(v) ? v : v ? [v] : [];

/**
 * False when the route names a store (`/store/<ref>/...`) other than the one
 * the middleware stamped for this request, or when it stamped none. Routes
 * without the param take the store from the host or config instead.
 */
function servesRouteStore(req: NextRequest, params: Params): boolean {
  if (params.storeRef === undefined) return true;
  return servedStoreRef(req) === params.storeRef;
}

/**
 * `export const { GET, POST } = createAuthRoutes();` in api/auth/[...route].
 * These routes sign every shopper-auth call with the storefront secret key,
 * so they answer 404 for a `/store/<ref>` other than the one this request
 * serves, and for any non-GET request that is not same-origin (GETs stay
 * open: Google's OAuth callback arrives cross-site).
 */
export function createAuthRoutes(): { GET: RouteHandler; POST: RouteHandler } {
  const handle: RouteHandler = async (req, { params }) => {
    const p = await params;
    if (!servesRouteStore(req, p)) return proxyNotFound();
    if (req.method !== "GET" && !isSameOriginRequest(req)) {
      return proxyNotFound();
    }
    const storeRef = await storeRefFor(p);
    if (!storeRef) return proxyNotFound();
    return handleAuthRoute(req, storeRef, segments(p.route));
  };
  return { GET: handle, POST: handle };
}

/**
 * `export const { GET, POST, PUT, PATCH, DELETE } = createBackendProxy();`
 * in api/backend/[...path]. It carries every private browser call under the
 * storefront secret key, so it forwards only same-origin calls to routes in
 * `PROXIED_STOREFRONT_ROUTES`, for the store this request serves, and answers
 * every other request 404 `NOT_FOUND`.
 */
export function createBackendProxy(): Record<
  "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
  RouteHandler
> {
  const handle: RouteHandler = async (req, { params }) => {
    const p = await params;
    if (!servesRouteStore(req, p)) return proxyNotFound();
    const storeRef = await storeRefFor(p);
    if (!storeRef) return proxyNotFound();
    return handleBackendProxy(req, storeRef, segments(p.path));
  };
  return {
    GET: handle,
    POST: handle,
    PUT: handle,
    PATCH: handle,
    DELETE: handle,
  };
}

export type CustomerIdentity = NonNullable<
  Awaited<ReturnType<typeof getServerIdentity>>
>;

/**
 * The signed-in customer, or a redirect to `redirectTo`. An anonymous
 * identity holds a valid token but no customer profile, so it redirects too.
 */
export async function requireSession(
  storeRef: string,
  redirectTo: string
): Promise<CustomerIdentity> {
  const identity = await getServerIdentity(storeRef);
  if (!identity || identity.is_anonymous) redirect(redirectTo);
  return identity;
}
