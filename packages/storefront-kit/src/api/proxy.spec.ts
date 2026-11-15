import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { handleBackendProxy } from "./proxy";

vi.mock("../auth/sdk", () => ({
  backendBaseUrl: () => "http://api.test",
  storefrontApiKey: () => "pk_test",
  createAuthApi: vi.fn(),
}));

describe("handleBackendProxy — X-Store-Preview", () => {
  const upstream: Headers[] = [];
  const sentPreview = () => upstream[0]!.get("x-store-preview");
  const segments = ["public", "stores", "abc"];

  beforeEach(() => {
    upstream.length = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: URL, init: RequestInit) => {
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
  });

  const onShop = (headers: Record<string, string>) =>
    new NextRequest(
      "http://shop.test/store/abc/api/backend/public/stores/abc",
      { headers: { "x-ecomweb-host-mapped": "1", ...headers } }
    );

  it("replaces a browser x-store-preview with the cookie's", async () => {
    await handleBackendProxy(
      onShop({ "x-store-preview": "forged", cookie: "ecw_store_preview=real" }),
      "abc",
      segments
    );
    expect(sentPreview()).toBe("real");
  });

  it("drops it without a cookie", async () => {
    await handleBackendProxy(
      onShop({ "x-store-preview": "forged" }),
      "abc",
      segments
    );
    expect(upstream).toHaveLength(1);
    expect(sentPreview()).toBeNull();
  });

  it("sends a preview host's token", async () => {
    const req = new NextRequest(
      "https://p-x3hm7wca.ecomsite.app/store/abc/api/backend/public/stores/abc",
      {
        headers: {
          "x-ecomweb-host-mapped": "1",
          // As the middleware stamps it on that host.
          "x-ecomweb-store-preview-token": "sp.tok",
          "x-store-preview": "forged",
        },
      }
    );
    await handleBackendProxy(req, "abc", segments);
    expect(sentPreview()).toBe("sp.tok");
  });

  it("never forwards the internal token header itself", async () => {
    await handleBackendProxy(
      onShop({ "x-ecomweb-store-preview-token": "sp.tok" }),
      "abc",
      segments
    );
    expect(upstream[0]!.get("x-ecomweb-store-preview-token")).toBeNull();
  });

  // Root /api/* (the single-store proxy) is outside the middleware's matcher,
  // so nothing stripped a client's copy of the internal header there.
  it("trusts only the cookie at the root /api/backend", async () => {
    const atRoot = (cookie?: string) =>
      new NextRequest("http://shop.test/api/backend/public/stores/abc", {
        headers: {
          "x-ecomweb-store-preview-token": "forged",
          "x-store-preview": "forged",
          ...(cookie ? { cookie } : {}),
        },
      });

    await handleBackendProxy(atRoot(), "abc", segments);
    expect(sentPreview()).toBeNull();

    upstream.length = 0;
    await handleBackendProxy(atRoot("ecw_store_preview=real"), "abc", segments);
    expect(sentPreview()).toBe("real");
  });
});
