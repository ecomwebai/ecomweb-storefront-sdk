import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { ApiClientError } from "@ecomweb/sdk";
import { resetPublicConfigForTests } from "../config/public";
import { clearStoreByHostCache, getStoreByHost } from "./get-store-by-host";
import { SKIP_STORE_PREVIEW } from "./store-preview-cookie";

const { getByDomain } = vi.hoisted(() => ({ getByDomain: vi.fn() }));

// vi.mock calls are hoisted above imports, so `getStoreByHost` above
// resolves against this mocked `sdk`, not the real one.
vi.mock("../sdk", () => ({
  sdk: { stores: { getByDomain } },
}));

describe("getStoreByHost", () => {
  beforeEach(() => {
    getByDomain.mockReset();
    clearStoreByHostCache();
  });

  it("skips resolution on localhost without calling the SDK", async () => {
    const result = await getStoreByHost("localhost:3002");

    expect(result).toEqual({
      storeRef: null,
      domain: null,
      isSubDomain: false,
      suspended: false,
      externalUrl: null,
      previewSlug: null,
      comingSoon: false,
      comingSoonName: null,
      storePreviewToken: null,
    });
    expect(getByDomain).not.toHaveBeenCalled();
  });

  it("resolves a subdomain host to a storeRef", async () => {
    getByDomain.mockResolvedValue({
      ref: "abc123",
      config: { custom_domain: null },
    });

    const result = await getStoreByHost("my-store.ecomsite.app");

    expect(result).toEqual({
      storeRef: "abc123",
      domain: null,
      isSubDomain: true,
      suspended: false,
      externalUrl: null,
      previewSlug: null,
      comingSoon: false,
      comingSoonName: null,
      storePreviewToken: null,
    });
    expect(getByDomain).toHaveBeenCalledWith("my-store", SKIP_STORE_PREVIEW);
  });

  it("resolves a custom domain host to a storeRef and its custom_domain", async () => {
    getByDomain.mockResolvedValue({
      ref: "abc123",
      config: { custom_domain: "shop.example.com", verified: true },
    });

    const result = await getStoreByHost("shop.example.com");

    expect(result).toEqual({
      storeRef: "abc123",
      domain: "shop.example.com",
      isSubDomain: false,
      suspended: false,
      externalUrl: null,
      previewSlug: null,
      comingSoon: false,
      comingSoonName: null,
      storePreviewToken: null,
    });
    expect(getByDomain).toHaveBeenCalledWith(
      "shop.example.com",
      SKIP_STORE_PREVIEW
    );
  });

  it("leaves domain null until the custom domain is verified", async () => {
    // A subdomain redirects to `domain`; before DNS works that would take
    // the store offline.
    for (const verified of [false, null, undefined]) {
      clearStoreByHostCache();
      getByDomain.mockResolvedValue({
        ref: "abc123",
        config: { custom_domain: "shop.example.com", verified },
      });

      const result = await getStoreByHost("my-store.ecomsite.app");

      expect(result.storeRef).toBe("abc123");
      expect(result.domain).toBeNull();
    }
  });

  it("flags suspended:true and no storeRef when the store is platform-suspended", async () => {
    getByDomain.mockRejectedValue(
      new ApiClientError("suspended", 403, "STORE_SUSPENDED")
    );

    const result = await getStoreByHost("shop.example.com");

    expect(result).toEqual({
      storeRef: null,
      domain: null,
      isSubDomain: false,
      suspended: true,
      externalUrl: null,
      previewSlug: null,
      comingSoon: false,
      comingSoonName: null,
      storePreviewToken: null,
    });
  });

  it("falls back to not-found (not suspended) for any other lookup failure", async () => {
    getByDomain.mockRejectedValue(new Error("network error"));

    const result = await getStoreByHost("shop.example.com");

    expect(result).toEqual({
      storeRef: null,
      domain: null,
      isSubDomain: false,
      suspended: false,
      externalUrl: null,
      previewSlug: null,
      comingSoon: false,
      comingSoonName: null,
      storePreviewToken: null,
    });
  });

  it("passes the live external theme's URL through as externalUrl", async () => {
    getByDomain.mockResolvedValue({
      ref: "abc123",
      config: { custom_domain: null },
      storefront_url: "https://shop.example.com",
    });

    const result = await getStoreByHost("my-store.ecomsite.app");

    expect(result.externalUrl).toBe("https://shop.example.com");
  });

  it("names the slug of a theme's preview host", async () => {
    getByDomain.mockResolvedValue({
      ref: "abc123",
      config: { custom_domain: "www.shop.vn" },
      storefront_url: null,
      preview_slug: "x3hm7wca",
    });
    const result = await getStoreByHost("p-x3hm7wca.ecomsite.app");
    expect(result).toMatchObject({
      storeRef: "abc123",
      previewSlug: "x3hm7wca",
    });
    expect(getByDomain).toHaveBeenCalledWith("p-x3hm7wca", SKIP_STORE_PREVIEW);
  });

  it("flags comingSoon with the store's name, and no storeRef, on STORE_COMING_SOON", async () => {
    getByDomain.mockRejectedValue(
      new ApiClientError("soon", 403, "STORE_COMING_SOON", { name: "Tiệm Hoa" })
    );

    const result = await getStoreByHost("shop.example.com");

    expect(result).toEqual({
      storeRef: null,
      domain: null,
      isSubDomain: false,
      suspended: false,
      externalUrl: null,
      previewSlug: null,
      comingSoon: true,
      comingSoonName: "Tiệm Hoa",
      storePreviewToken: null,
    });
  });

  it("passes a preview host's store_preview_token through", async () => {
    getByDomain.mockResolvedValue({
      ref: "abc123",
      config: {},
      preview_slug: "x3hm7wca",
      store_preview_token: "sp.tok",
    });

    const result = await getStoreByHost("p-x3hm7wca.ecomsite.app");

    expect(result.previewSlug).toBe("x3hm7wca");
    expect(result.storePreviewToken).toBe("sp.tok");
  });

  it("ignores store_preview_token off a preview host", async () => {
    getByDomain.mockResolvedValue({
      ref: "abc123",
      config: {},
      store_preview_token: "sp.tok",
    });

    const result = await getStoreByHost("my-store.ecomsite.app");

    expect(result.previewSlug).toBeNull();
    expect(result.storePreviewToken).toBeNull();
  });

  it("marks a plain lookup to skip the ambient preview token, and sends no preview header", async () => {
    getByDomain.mockResolvedValue(null);

    await getStoreByHost("shop.example.com");

    expect(getByDomain).toHaveBeenCalledWith("shop.example.com", {
      skipStorePreview: true,
    });
    const options = getByDomain.mock.calls[0]![1];
    expect(options.headers?.["x-store-preview"]).toBeUndefined();
  });

  it("treats an empty previewToken as a plain lookup", async () => {
    getByDomain.mockResolvedValue(null);

    await getStoreByHost("shop.example.com", { previewToken: "" });

    expect(getByDomain).toHaveBeenCalledWith(
      "shop.example.com",
      SKIP_STORE_PREVIEW
    );
  });
});

describe("getStoreByHost — which hosts are platform subdomains", () => {
  beforeEach(() => {
    getByDomain.mockReset().mockResolvedValue(null);
    clearStoreByHostCache();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    resetPublicConfigForTests();
  });

  it("is a single label under the platform domain, port ignored", async () => {
    const result = await getStoreByHost("my-store.ecomsite.app:443");
    expect(result.isSubDomain).toBe(true);
    expect(getByDomain).toHaveBeenCalledWith("my-store", SKIP_STORE_PREVIEW);
  });

  it("is not a host that only contains the platform domain", async () => {
    const result = await getStoreByHost("shop.evilecomsite.app");
    expect(result.isSubDomain).toBe(false);
    expect(getByDomain).toHaveBeenCalledWith(
      "shop.evilecomsite.app",
      SKIP_STORE_PREVIEW
    );
  });

  it("is not two labels deep", async () => {
    const result = await getStoreByHost("www.shop.ecomsite.app");
    expect(result.isSubDomain).toBe(false);
  });

  it("works for a platform domain of more than two labels (the lab)", async () => {
    // The suffix is a multi-tenant setting; single mode has none.
    vi.stubEnv("NEXT_PUBLIC_ECOMWEB_MODE", "multi");
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://api.test");
    vi.stubEnv("NEXT_PUBLIC_PLATFORM_API_KEY", "pk_test");
    vi.stubEnv("NEXT_PUBLIC_PLATFORM_DOMAIN_SUFFIX", "192-168-1-102.sslip.io");
    resetPublicConfigForTests();
    const result = await getStoreByHost("shop.192-168-1-102.sslip.io");
    expect(result.isSubDomain).toBe(true);
    expect(getByDomain).toHaveBeenCalledWith("shop", SKIP_STORE_PREVIEW);
  });
});

describe("getStoreByHost — in-process cache", () => {
  beforeEach(() => {
    getByDomain.mockReset();
    clearStoreByHostCache();
    vi.useRealTimers();
  });

  it("reuses a found store, case-insensitively, for 30 seconds", async () => {
    vi.useFakeTimers();
    getByDomain.mockResolvedValue({ ref: "abc123", config: {} });

    await getStoreByHost("shop.example.com");
    const again = await getStoreByHost("SHOP.example.com");
    expect(again.storeRef).toBe("abc123");
    expect(getByDomain).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(30_001);
    await getStoreByHost("shop.example.com");
    expect(getByDomain).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it("forgets a miss after 10 seconds, so a new store shows up soon", async () => {
    vi.useFakeTimers();
    getByDomain.mockResolvedValue(null);

    await getStoreByHost("new.example.com");
    await getStoreByHost("new.example.com");
    expect(getByDomain).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(10_001);
    getByDomain.mockResolvedValue({ ref: "new1", config: {} });
    expect((await getStoreByHost("new.example.com")).storeRef).toBe("new1");
    vi.useRealTimers();
  });

  it("caches a suspension (as a miss)", async () => {
    getByDomain.mockRejectedValue(
      new ApiClientError("suspended", 403, "STORE_SUSPENDED")
    );
    await getStoreByHost("shop.example.com");
    const again = await getStoreByHost("shop.example.com");
    expect(again.suspended).toBe(true);
    expect(getByDomain).toHaveBeenCalledTimes(1);
  });

  it("sends a preview token as x-store-preview and never caches that result", async () => {
    getByDomain.mockResolvedValueOnce({ ref: "abc123", config: {} });
    getByDomain.mockRejectedValueOnce(
      new ApiClientError("soon", 403, "STORE_COMING_SOON", { name: "Tiệm Hoa" })
    );

    const previewed = await getStoreByHost("shop.example.com", {
      previewToken: "tok",
    });
    expect(previewed.storeRef).toBe("abc123");
    expect(getByDomain).toHaveBeenCalledWith("shop.example.com", {
      headers: { "x-store-preview": "tok" },
    });

    const plain = await getStoreByHost("shop.example.com");
    expect(plain.comingSoon).toBe(true);
    expect(plain.storeRef).toBeNull();
    expect(getByDomain).toHaveBeenCalledTimes(2);
  });

  it("does not serve a cached plain lookup to a preview token call", async () => {
    getByDomain.mockResolvedValueOnce(null);
    getByDomain.mockResolvedValueOnce({ ref: "abc123", config: {} });

    await getStoreByHost("shop.example.com");
    const previewed = await getStoreByHost("shop.example.com", {
      previewToken: "tok",
    });

    expect(previewed.storeRef).toBe("abc123");
    expect(getByDomain).toHaveBeenCalledTimes(2);
  });

  it("does not cache a coming soon result looked up with a preview token", async () => {
    getByDomain.mockRejectedValue(
      new ApiClientError("expired", 403, "STORE_COMING_SOON", { name: "A" })
    );

    await getStoreByHost("shop.example.com", { previewToken: "old" });
    await getStoreByHost("shop.example.com", { previewToken: "old" });
    await getStoreByHost("shop.example.com");

    expect(getByDomain).toHaveBeenCalledTimes(3);
  });

  it("reuses a coming soon result for 10 seconds, then forgets it", async () => {
    vi.useFakeTimers();
    getByDomain.mockRejectedValue(
      new ApiClientError("soon", 403, "STORE_COMING_SOON", { name: "Tiệm Hoa" })
    );

    await getStoreByHost("soon.example.com");
    const again = await getStoreByHost("soon.example.com");
    expect(again.comingSoon).toBe(true);
    expect(again.comingSoonName).toBe("Tiệm Hoa");
    expect(getByDomain).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(10_001);
    getByDomain.mockResolvedValue({ ref: "open1", config: {} });
    const opened = await getStoreByHost("soon.example.com");
    expect(opened.storeRef).toBe("open1");
    expect(opened.comingSoon).toBe(false);
    expect(getByDomain).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it("never caches a failed lookup", async () => {
    getByDomain.mockRejectedValueOnce(new Error("network error"));
    getByDomain.mockResolvedValueOnce({ ref: "abc123", config: {} });

    expect((await getStoreByHost("shop.example.com")).storeRef).toBeNull();
    expect((await getStoreByHost("shop.example.com")).storeRef).toBe("abc123");
    expect(getByDomain).toHaveBeenCalledTimes(2);
  });
});
