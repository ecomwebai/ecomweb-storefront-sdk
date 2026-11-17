import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { handleBackendProxy } from "./proxy";

vi.mock("../auth/sdk", () => ({
  backendBaseUrl: () => "http://api.test",
  storefrontSecretKey: () => "sk_platform_test",
  createAuthApi: vi.fn(),
}));

const upstream: Headers[] = [];
const upstreamUrls: string[] = [];

beforeEach(() => {
  upstream.length = 0;
  upstreamUrls.length = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: URL, init: RequestInit) => {
      upstreamUrls.push(String(url));
      upstream.push(new Headers(init.headers));
      return new Response("{}", {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    })
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const SHOP = "http://shop.test/store/abc/api/backend";
const CART = ["storefront", "stores", "abc", "cart"];
const SAME_ORIGIN = { "sec-fetch-site": "same-origin" };

const onShop = (
  headers: Record<string, string>,
  path = "/store/abc/api/backend/storefront/stores/abc/cart"
) =>
  new NextRequest(`http://shop.test${path}`, {
    headers: { "x-ecomweb-host-mapped": "1", ...headers },
  });

const onShopPost = (headers: Record<string, string>) =>
  new NextRequest(`${SHOP}/storefront/stores/abc/cart/items`, {
    method: "POST",
    headers: {
      "x-ecomweb-host-mapped": "1",
      "content-type": "application/json",
      ...headers,
    },
    body: JSON.stringify({ variant_id: "v1", quantity: 1 }),
  });

describe("handleBackendProxy — lockdown", () => {
  it("404s the old public/ prefix and never forwards it", async () => {
    const res = await handleBackendProxy(
      onShop(SAME_ORIGIN, "/store/abc/api/backend/public/stores/abc/cart"),
      "abc",
      ["public", "stores", "abc", "cart"]
    );
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ code: "NOT_FOUND" });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("404s a path naming another store, and sends nothing", async () => {
    const res = await handleBackendProxy(
      onShop(SAME_ORIGIN, "/store/abc/api/backend/storefront/stores/xyz/cart"),
      "abc",
      ["storefront", "stores", "xyz", "cart"]
    );
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({
      code: "NOT_FOUND",
      message: "Not found",
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("404s public catalog paths, traversal and cross-site callers", async () => {
    for (const [headers, segs] of [
      [SAME_ORIGIN, ["storefront", "stores", "abc", "products", "slug", "x"]],
      [SAME_ORIGIN, ["storefront", "stores", "abc", "..", "cart"]],
      [{ "sec-fetch-site": "same-site" }, ["storefront", "stores", "abc", "cart"]],
      [{ "sec-fetch-site": "cross-site" }, ["storefront", "stores", "abc", "cart"]],
    ] as const) {
      const res = await handleBackendProxy(onShop(headers), "abc", [...segs]);
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({
        code: "NOT_FOUND",
        message: "Not found",
      });
    }
    expect(fetch).not.toHaveBeenCalled();
  });

  it("lets an old-Safari GET through (no Sec-Fetch-Site, no Origin)", async () => {
    const res = await handleBackendProxy(onShop({}), "abc", [...CART]);
    expect(res.status).toBe(200);
    expect(upstreamUrls).toEqual(["http://api.test/storefront/stores/abc/cart"]);
  });

  it("404s a POST with neither Sec-Fetch-Site nor Origin", async () => {
    const res = await handleBackendProxy(onShopPost({}), "abc", [
      ...CART,
      "items",
    ]);
    expect(res.status).toBe(404);
    expect(fetch).not.toHaveBeenCalled();
  });

  // Was 400 PROXY_INVALID_PATH; every refusal now has one shape.
  it("404s a path resolveTarget rejects, as NOT_FOUND", async () => {
    for (const segs of [[], ["storefront", "stores", "abc", "a/b"], [""]]) {
      const res = await handleBackendProxy(onShop(SAME_ORIGIN), "abc", segs);
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({
        code: "NOT_FOUND",
        message: "Not found",
      });
    }
    expect(fetch).not.toHaveBeenCalled();
  });

  it("404s a control-character item id (tab, LF, CR, NUL)", async () => {
    for (const id of [".\t.", "a\nb", "a\rb", "a\u0000b"]) {
      const res = await handleBackendProxy(
        new NextRequest(`${SHOP}/storefront/stores/abc/cart/items/x`, {
          method: "DELETE",
          headers: SAME_ORIGIN,
        }),
        "abc",
        ["storefront", "stores", "abc", "cart", "items", id]
      );
      expect(res.status).toBe(404);
    }
    expect(fetch).not.toHaveBeenCalled();
  });

  it("404s the right path under the wrong method", async () => {
    const res = await handleBackendProxy(
      new NextRequest(`${SHOP}/storefront/stores/abc/cart`, {
        method: "PATCH",
        headers: SAME_ORIGIN,
        body: "{}",
      }),
      "abc",
      CART
    );
    expect(res.status).toBe(404);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("logs one debug line per refusal: reason, store, method, never the path or headers", async () => {
    const debug = vi.spyOn(console, "debug").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    await handleBackendProxy(
      onShop(
        { ...SAME_ORIGIN, authorization: "Bearer leak" },
        "/store/abc/api/backend/storefront/stores/abc/review-invitations/tok_secret/x"
      ),
      "abc",
      ["storefront", "stores", "abc", "review-invitations", "tok_secret", "x"]
    );
    await handleBackendProxy(
      onShop({ "sec-fetch-site": "cross-site" }),
      "abc",
      CART
    );
    await handleBackendProxy(onShop(SAME_ORIGIN), "abc", [
      "storefront",
      "stores",
      "xyz",
      "cart",
    ]);
    await handleBackendProxy(onShop(SAME_ORIGIN), "abc", [
      "storefront",
      "stores",
      "abc",
      "..",
    ]);

    expect(debug.mock.calls).toEqual([
      [
        "backend proxy refused",
        { reason: "not-proxied", storeRef: "abc", method: "GET" },
      ],
      [
        "backend proxy refused",
        { reason: "cross-site", storeRef: "abc", method: "GET" },
      ],
      [
        "backend proxy refused",
        { reason: "store-mismatch", storeRef: "abc", method: "GET" },
      ],
      [
        "backend proxy refused",
        { reason: "invalid-path", storeRef: "abc", method: "GET" },
      ],
    ]);
    const logged = JSON.stringify([debug.mock.calls, error.mock.calls]);
    expect(logged).not.toContain("tok_secret");
    expect(logged).not.toContain("leak");
    expect(error).not.toHaveBeenCalled();
  });

  it("forwards a guest cart add with the session id, the secret and the shopper IP", async () => {
    const res = await handleBackendProxy(
      onShopPost({
        ...SAME_ORIGIN,
        "x-session-id": "sess_1",
        "x-storefront-api-key": "pk_browser",
        "x-forwarded-for": "203.0.113.9",
      }),
      "abc",
      ["storefront", "stores", "abc", "cart", "items"]
    );
    expect(res.status).toBe(200);
    expect(upstreamUrls).toEqual([
      "http://api.test/storefront/stores/abc/cart/items",
    ]);
    const sent = upstream[0]!;
    expect(sent.get("x-session-id")).toBe("sess_1");
    expect(sent.get("x-storefront-api-key")).toBe("sk_platform_test");
    expect(sent.get("x-forwarded-for")).toBe("203.0.113.9");
  });

  it("accepts an Origin equal to the shopper-facing origin when Sec-Fetch-Site is absent", async () => {
    const res = await handleBackendProxy(
      onShop({ origin: "http://shop.test" }),
      "abc",
      CART
    );
    expect(res.status).toBe(200);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("percent-encodes each matched segment in the upstream URL", async () => {
    await handleBackendProxy(
      new NextRequest(`${SHOP}/storefront/stores/abc/cart/items/x`, {
        method: "DELETE",
        headers: SAME_ORIGIN,
      }),
      "abc",
      ["storefront", "stores", "abc", "cart", "items", "a;b:ü"]
    );
    expect(upstreamUrls).toEqual([
      `http://api.test/storefront/stores/abc/cart/items/${encodeURIComponent("a;b:ü")}`,
    ]);
  });

  it("works on a preview host: secret plus the preview token", async () => {
    const req = new NextRequest(
      "https://p-x3hm7wca.ecomsite.app/store/abc/api/backend/storefront/stores/abc/cart/items",
      {
        method: "POST",
        headers: {
          "x-ecomweb-host-mapped": "1",
          "sec-fetch-site": "same-origin",
          "x-ecomweb-store-preview-token": "sp.tok",
          "content-type": "application/json",
        },
        body: "{}",
      }
    );
    const res = await handleBackendProxy(req, "abc", [
      "storefront",
      "stores",
      "abc",
      "cart",
      "items",
    ]);
    expect(res.status).toBe(200);
    expect(upstream).toHaveLength(1);
    expect(upstream[0]!.get("x-storefront-api-key")).toBe("sk_platform_test");
    expect(upstream[0]!.get("x-store-preview")).toBe("sp.tok");
  });
});

describe("handleBackendProxy — X-Store-Preview", () => {
  const sentPreview = () => upstream[0]!.get("x-store-preview");

  it("replaces a browser x-store-preview with the cookie's", async () => {
    await handleBackendProxy(
      onShop({
        ...SAME_ORIGIN,
        "x-store-preview": "forged",
        cookie: "ecw_store_preview=real",
      }),
      "abc",
      CART
    );
    expect(sentPreview()).toBe("real");
  });

  it("drops it without a cookie", async () => {
    await handleBackendProxy(
      onShop({ ...SAME_ORIGIN, "x-store-preview": "forged" }),
      "abc",
      CART
    );
    expect(upstream).toHaveLength(1);
    expect(sentPreview()).toBeNull();
  });

  it("sends a preview host's token", async () => {
    const req = new NextRequest(
      "https://p-x3hm7wca.ecomsite.app/store/abc/api/backend/storefront/stores/abc/cart",
      {
        headers: {
          "x-ecomweb-host-mapped": "1",
          "sec-fetch-site": "same-origin",
          // As the middleware stamps it on that host.
          "x-ecomweb-store-preview-token": "sp.tok",
          "x-store-preview": "forged",
        },
      }
    );
    await handleBackendProxy(req, "abc", CART);
    expect(sentPreview()).toBe("sp.tok");
  });

  it("never forwards the internal token header itself", async () => {
    await handleBackendProxy(
      onShop({ ...SAME_ORIGIN, "x-ecomweb-store-preview-token": "sp.tok" }),
      "abc",
      CART
    );
    expect(upstream).toHaveLength(1);
    expect(upstream[0]!.get("x-ecomweb-store-preview-token")).toBeNull();
  });

  // Root /api/* (the single-store proxy) is outside the middleware's matcher,
  // so nothing stripped a client's copy of the internal header there.
  it("trusts only the cookie at the root /api/backend", async () => {
    const atRoot = (cookie?: string) =>
      new NextRequest("http://shop.test/api/backend/storefront/stores/abc/cart", {
        headers: {
          "sec-fetch-site": "same-origin",
          "x-ecomweb-store-preview-token": "forged",
          "x-store-preview": "forged",
          ...(cookie ? { cookie } : {}),
        },
      });

    await handleBackendProxy(atRoot(), "abc", CART);
    expect(upstream).toHaveLength(1);
    expect(sentPreview()).toBeNull();

    upstream.length = 0;
    await handleBackendProxy(atRoot("ecw_store_preview=real"), "abc", CART);
    expect(sentPreview()).toBe("real");
  });
});
