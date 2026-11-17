import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { createAuthRoutes, createBackendProxy, requireSession } from "./routes";

const m = vi.hoisted(() => ({
  handleAuthRoute: vi.fn(),
  handleBackendProxy: vi.fn(),
  resolveRootStoreRef: vi.fn(),
  getServerIdentity: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`);
  }),
}));
vi.mock("../auth/route-handlers", () => ({
  handleAuthRoute: m.handleAuthRoute,
}));
vi.mock("../api/proxy", () => ({ handleBackendProxy: m.handleBackendProxy }));
vi.mock("../store-scope/root", () => ({
  resolveRootStoreRef: m.resolveRootStoreRef,
}));
vi.mock("../auth/session", () => ({ getServerIdentity: m.getServerIdentity }));
vi.mock("next/navigation", () => ({ redirect: m.redirect }));

const req = () => new NextRequest("https://shop.example.com/api/auth/login");
const ctx = <T extends object>(p: T) => ({ params: Promise.resolve(p) });

/** A request under /store/<pathRef>/api/<rest>, stamped as serving `served`. */
const onStore = (
  served: string | null,
  pathRef: string,
  rest: string,
  method = "GET",
  site?: string
) =>
  new NextRequest(`https://a.ecomsite.app/store/${pathRef}/api/${rest}`, {
    method,
    headers: {
      ...(served ? { "x-ecomweb-served-store": served } : {}),
      ...(site ? { "sec-fetch-site": site } : {}),
    },
  });

describe("createAuthRoutes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_ECOMWEB_MODE", "multi");
    m.handleAuthRoute.mockResolvedValue(new Response("ok"));
  });

  it("uses the store from the /store/<ref> route", async () => {
    const { POST } = createAuthRoutes();
    await POST(onStore("s1", "s1", "login", "POST", "same-origin"), ctx({ storeRef: "s1", route: ["login"] }));
    expect(m.handleAuthRoute).toHaveBeenCalledWith(
      expect.any(NextRequest),
      "s1",
      ["login"]
    );
    expect(m.resolveRootStoreRef).not.toHaveBeenCalled();
  });

  it("asks the host for the store on routes without a ref", async () => {
    m.resolveRootStoreRef.mockResolvedValue("s2");
    const { GET } = createAuthRoutes();
    await GET(req(), ctx({ route: ["session"] }));
    expect(m.handleAuthRoute).toHaveBeenCalledWith(
      expect.any(NextRequest),
      "s2",
      ["session"]
    );
  });

  it("answers 404 when the host names no store", async () => {
    m.resolveRootStoreRef.mockResolvedValue(null);
    const res = await createAuthRoutes().GET(
      req(),
      ctx({ route: ["session"] })
    );
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ code: "NOT_FOUND", message: "Not found" });
    expect(m.handleAuthRoute).not.toHaveBeenCalled();
  });

  it("404s a /store/<ref> auth route for a store other than the one served", async () => {
    const res = await createAuthRoutes().POST(
      onStore("a", "b", "auth/login", "POST", "same-origin"),
      ctx({ storeRef: "b", route: ["login"] })
    );
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ code: "NOT_FOUND", message: "Not found" });
    expect(m.handleAuthRoute).not.toHaveBeenCalled();
  });

  it("404s a /store/<ref> auth route when no store was stamped", async () => {
    const res = await createAuthRoutes().GET(
      onStore(null, "a", "auth/session"),
      ctx({ storeRef: "a", route: ["session"] })
    );
    expect(res.status).toBe(404);
    expect(m.handleAuthRoute).not.toHaveBeenCalled();
  });

  it("404s a cross-site auth POST but serves a same-origin one", async () => {
    const { POST } = createAuthRoutes();
    for (const site of ["cross-site", "same-site", undefined]) {
      const res = await POST(
        onStore("a", "a", "auth/login", "POST", site),
        ctx({ storeRef: "a", route: ["login"] })
      );
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ code: "NOT_FOUND", message: "Not found" });
    }
    expect(m.handleAuthRoute).not.toHaveBeenCalled();

    const ok = await POST(
      onStore("a", "a", "auth/login", "POST", "same-origin"),
      ctx({ storeRef: "a", route: ["login"] })
    );
    expect(ok.status).toBe(200);
    expect(m.handleAuthRoute).toHaveBeenCalledWith(expect.any(NextRequest), "a", ["login"]);
  });

  it("404s a cross-site POST on a root auth route too", async () => {
    m.resolveRootStoreRef.mockResolvedValue("s2");
    const res = await createAuthRoutes().POST(
      new NextRequest("https://shop.example.com/api/auth/login", {
        method: "POST",
        headers: { "sec-fetch-site": "cross-site" },
      }),
      ctx({ route: ["login"] })
    );
    expect(res.status).toBe(404);
    expect(m.handleAuthRoute).not.toHaveBeenCalled();
  });

  it("lets Google's callback GET through cross-site", async () => {
    const res = await createAuthRoutes().GET(
      onStore("a", "a", "auth/google/complete", "GET", "cross-site"),
      ctx({ storeRef: "a", route: ["google", "complete"] })
    );
    expect(res.status).toBe(200);
    expect(m.handleAuthRoute).toHaveBeenCalledWith(expect.any(NextRequest), "a", [
      "google",
      "complete",
    ]);
  });
});

describe("createBackendProxy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_ECOMWEB_MODE", "multi");
    m.handleBackendProxy.mockResolvedValue(new Response("ok"));
  });

  it("forwards every method with the store and path", async () => {
    const handlers = createBackendProxy();
    for (const method of ["GET", "POST", "PUT", "PATCH", "DELETE"] as const) {
      await handlers[method](
        onStore("s1", "s1", "backend/carts/1", method === "GET" ? "GET" : method),
        ctx({ storeRef: "s1", path: ["carts", "1"] })
      );
    }
    expect(m.handleBackendProxy).toHaveBeenCalledTimes(5);
    expect(m.handleBackendProxy).toHaveBeenLastCalledWith(
      expect.any(NextRequest),
      "s1",
      ["carts", "1"]
    );
  });

  it("404s the proxy for a store ref other than the one this request serves", async () => {
    const req = new NextRequest(
      "https://a.ecomsite.app/store/b/api/backend/storefront/stores/b/cart",
      { headers: { "x-ecomweb-served-store": "a", "sec-fetch-site": "same-origin" } }
    );
    const res = await createBackendProxy().GET(
      req,
      ctx({ storeRef: "b", path: ["storefront", "stores", "b", "cart"] })
    );
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ code: "NOT_FOUND", message: "Not found" });
    expect(m.handleBackendProxy).not.toHaveBeenCalled();
  });

  it("404s when no store was stamped (host lookup failed)", async () => {
    const req = new NextRequest(
      "https://a.ecomsite.app/store/a/api/backend/storefront/stores/a/cart",
      { headers: { "sec-fetch-site": "same-origin" } }
    );
    const res = await createBackendProxy().GET(
      req,
      ctx({ storeRef: "a", path: ["storefront", "stores", "a", "cart"] })
    );
    expect(res.status).toBe(404);
    expect(m.handleBackendProxy).not.toHaveBeenCalled();
  });

  it("ignores a client's served-store header on a root /api path", async () => {
    // Outside the middleware matcher nothing stripped the client's copy.
    const req = new NextRequest("https://a.ecomsite.app/api/backend/storefront/stores/a/cart", {
      headers: { "x-ecomweb-served-store": "a", "sec-fetch-site": "same-origin" },
    });
    const res = await createBackendProxy().GET(
      req,
      ctx({ storeRef: "a", path: ["storefront", "stores", "a", "cart"] })
    );
    expect(res.status).toBe(404);
    expect(m.handleBackendProxy).not.toHaveBeenCalled();
  });
});

describe("requireSession", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the signed-in customer", async () => {
    const identity = { id: "c1", is_anonymous: false };
    m.getServerIdentity.mockResolvedValue(identity);
    await expect(requireSession("s1", "/login")).resolves.toBe(identity);
  });

  it("redirects a visitor or an anonymous identity", async () => {
    m.getServerIdentity.mockResolvedValue(null);
    await expect(requireSession("s1", "/login")).rejects.toThrow(
      "NEXT_REDIRECT /login"
    );
    m.getServerIdentity.mockResolvedValue({ id: "a1", is_anonymous: true });
    await expect(requireSession("s1", "/login")).rejects.toThrow(
      "NEXT_REDIRECT /login"
    );
  });
});
