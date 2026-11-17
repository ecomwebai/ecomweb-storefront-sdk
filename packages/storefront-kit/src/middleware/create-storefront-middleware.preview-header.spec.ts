import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { InternalAxiosRequestConfig } from "axios";
import { publicApiClient } from "../api/client";
import { clearStoreByHostCache } from "../stores/get-store-by-host";
import { clearStoreSubdomainCache } from "../stores/store-subdomain";
import { createStorefrontMiddleware } from "./create-storefront-middleware";

vi.hoisted(() => {
  vi.stubEnv("NEXT_PUBLIC_ECOMWEB_MODE", "multi");
});

// Next 16 runs the middleware inside a request store, so `next/headers`
// works there and returns the middleware's own incoming request, unsanitised
// (next/dist/esm/server/web/adapter.js). Mirror that here.
const incoming = vi.hoisted(() => ({ req: null as NextRequest | null }));
vi.mock("next/headers", () => ({
  cookies: async () => incoming.req!.cookies,
  headers: async () => incoming.req!.headers,
}));

vi.mock("../stores/store-traffic", () => ({ recordStoreRequest: vi.fn() }));

const proxy = createStorefrontMiddleware({ mode: "multi" });

describe("the middleware's own lookups — x-store-preview on the wire", () => {
  const sent: InternalAxiosRequestConfig[] = [];
  const instance = publicApiClient.getAxiosInstance();
  const originalAdapter = instance.defaults.adapter;
  const previewOf = (fragment: string) => {
    const call = sent.find(c => c.url!.includes(fragment));
    expect(call, `a request to ${fragment}`).toBeDefined();
    return call!.headers.get("x-store-preview");
  };
  const run = (url: string, headers: Record<string, string>) => {
    const host = new URL(url).host;
    incoming.req = new NextRequest(url, { headers: { host, ...headers } });
    return proxy(incoming.req);
  };

  beforeEach(() => {
    sent.length = 0;
    clearStoreByHostCache();
    clearStoreSubdomainCache();
    vi.stubEnv("NEXT_PUBLIC_PLATFORM_DOMAIN_SUFFIX", "ecomsite.app");
    instance.defaults.adapter = async config => {
      sent.push(config);
      const data = config.url!.includes("/url-redirects/lookup")
        ? { data: null }
        : { ref: "abc123", config: { subdomain: "shop" } };
      return { data, status: 200, statusText: "OK", headers: {}, config };
    };
  });

  afterEach(() => {
    instance.defaults.adapter = originalAdapter;
    incoming.req = null;
  });

  const cases: Array<[string, Record<string, string>]> = [
    ["a forged internal header", { "x-ecomweb-store-preview-token": "forged" }],
    ["a real preview cookie", { cookie: "ecw_store_preview=real" }],
  ];

  for (const [label, headers] of cases) {
    it(`sends none on the redirect lookup under ${label}`, async () => {
      const res = await run("https://shop.example.com/products/a", headers);
      expect(res.headers.get("x-middleware-rewrite")).toContain(
        "/store/abc123/products/a"
      );
      expect(previewOf("/url-redirects/lookup")).toBeUndefined();
    });

    it(`sends none on the apex's subdomain lookup under ${label}`, async () => {
      const res = await run("https://ecomsite.app/store/abc123/products/a", {
        "x-forwarded-proto": "https",
        ...headers,
      });
      expect(res.headers.get("location")).toBe(
        "https://shop.ecomsite.app/products/a"
      );
      expect(previewOf("/storefront/stores/abc123?")).toBeUndefined();
    });
  }

  it("never caches a subdomain fetched with a token", async () => {
    // A previewer first, then a public visitor within the 60 s window: the
    // one fetch whose answer the cache holds carried no token.
    await run("https://ecomsite.app/store/abc123", {
      "x-forwarded-proto": "https",
      cookie: "ecw_store_preview=real",
      "x-ecomweb-store-preview-token": "forged",
    });
    await run("https://ecomsite.app/store/abc123", {
      "x-forwarded-proto": "https",
    });
    const fetches = sent.filter(c => c.url!.includes("/storefront/stores/abc123?"));
    expect(fetches).toHaveLength(1);
    expect(fetches[0]!.headers.get("x-store-preview")).toBeUndefined();
    expect(
      (fetches[0] as { skipStorePreview?: unknown }).skipStorePreview
    ).toBe(true);
  });
});
