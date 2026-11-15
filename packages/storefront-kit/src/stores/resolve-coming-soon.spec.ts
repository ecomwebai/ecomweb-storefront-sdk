import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiClientError } from "@ecomweb/sdk";
import { resolveComingSoonStore } from "./resolve-coming-soon";

const { headers, getStoreByHost, getCachedStore, publicConfig } = vi.hoisted(
  () => ({
    headers: vi.fn(),
    getStoreByHost: vi.fn(),
    getCachedStore: vi.fn(),
    publicConfig: vi.fn(),
  })
);

vi.mock("next/headers", () => ({ headers }));
vi.mock("./get-store-by-host", () => ({ getStoreByHost }));
vi.mock("./cached", () => ({ getCachedStore }));
vi.mock("../config/public", () => ({ publicConfig }));

function lookup(over: Record<string, unknown>) {
  return {
    storeRef: null,
    domain: null,
    isSubDomain: false,
    suspended: false,
    externalUrl: null,
    previewSlug: null,
    comingSoon: false,
    comingSoonName: null,
    storePreviewToken: null,
    ...over,
  };
}

describe("resolveComingSoonStore", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("multi mode", () => {
    beforeEach(() => {
      publicConfig.mockReturnValue({ mode: "multi", storeRef: undefined });
    });

    it("returns the store name for a coming soon host", async () => {
      headers.mockResolvedValue(new Headers({ host: "shop.example.com" }));
      getStoreByHost.mockResolvedValue(
        lookup({ comingSoon: true, comingSoonName: "Tiệm Hoa" })
      );

      await expect(resolveComingSoonStore()).resolves.toEqual({
        name: "Tiệm Hoa",
      });
      expect(getStoreByHost).toHaveBeenCalledWith("shop.example.com");
    });

    it("returns null for an open store", async () => {
      headers.mockResolvedValue(new Headers({ host: "shop.example.com" }));
      getStoreByHost.mockResolvedValue(
        lookup({ storeRef: "abc123", isSubDomain: true })
      );

      await expect(resolveComingSoonStore()).resolves.toBeNull();
    });

    it("returns null on localhost", async () => {
      headers.mockResolvedValue(new Headers({ host: "localhost:3002" }));
      getStoreByHost.mockResolvedValue(lookup({}));

      await expect(resolveComingSoonStore()).resolves.toBeNull();
    });
  });

  describe("single mode", () => {
    beforeEach(() => {
      publicConfig.mockReturnValue({ mode: "single", storeRef: "my-store" });
    });

    it("returns the name from the coming soon error", async () => {
      getCachedStore.mockRejectedValue(
        new ApiClientError("soon", 403, "STORE_COMING_SOON", { name: "Demo" })
      );

      await expect(resolveComingSoonStore()).resolves.toEqual({
        name: "Demo",
      });
      expect(getCachedStore).toHaveBeenCalledWith("my-store");
    });

    it("returns null when the store loads", async () => {
      getCachedStore.mockResolvedValue({ ref: "my-store" });

      await expect(resolveComingSoonStore()).resolves.toBeNull();
    });

    it("rethrows any other error", async () => {
      getCachedStore.mockRejectedValue(new Error("api down"));

      await expect(resolveComingSoonStore()).rejects.toThrow("api down");
    });
  });
});
