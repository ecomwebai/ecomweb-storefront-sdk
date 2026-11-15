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

describe("createAuthRoutes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_ECOMWEB_MODE", "multi");
    m.handleAuthRoute.mockResolvedValue(new Response("ok"));
  });

  it("uses the store from the /store/<ref> route", async () => {
    const { POST } = createAuthRoutes();
    await POST(req(), ctx({ storeRef: "s1", route: ["login"] }));
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
    expect(await res.json()).toEqual({
      error: { message: "Store not found for host" },
    });
    expect(m.handleAuthRoute).not.toHaveBeenCalled();
  });
});

describe("createBackendProxy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.handleBackendProxy.mockResolvedValue(new Response("ok"));
  });

  it("forwards every method with the store and path", async () => {
    const handlers = createBackendProxy();
    for (const method of ["GET", "POST", "PUT", "PATCH", "DELETE"] as const) {
      await handlers[method](
        req(),
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
