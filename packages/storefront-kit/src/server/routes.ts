import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { redirect } from "next/navigation";
import { handleBackendProxy } from "../api/proxy";
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

function storeNotFound(): Response {
  return NextResponse.json(
    { error: { message: "Store not found for host" } },
    { status: 404 }
  );
}

const segments = (v: Params[string]): string[] =>
  Array.isArray(v) ? v : v ? [v] : [];

/** `export const { GET, POST } = createAuthRoutes();` in api/auth/[...route]. */
export function createAuthRoutes(): { GET: RouteHandler; POST: RouteHandler } {
  const handle: RouteHandler = async (req, { params }) => {
    const p = await params;
    const storeRef = await storeRefFor(p);
    if (!storeRef) return storeNotFound();
    return handleAuthRoute(req, storeRef, segments(p.route));
  };
  return { GET: handle, POST: handle };
}

/**
 * `export const { GET, POST, PUT, PATCH, DELETE } = createBackendProxy();`
 * in api/backend/[...path].
 */
export function createBackendProxy(): Record<
  "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
  RouteHandler
> {
  const handle: RouteHandler = async (req, { params }) => {
    const p = await params;
    const storeRef = await storeRefFor(p);
    if (!storeRef) return storeNotFound();
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
