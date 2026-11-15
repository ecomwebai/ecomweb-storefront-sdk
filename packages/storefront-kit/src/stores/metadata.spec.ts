import { describe, expect, it, vi } from "vitest";
import { ApiClientError } from "@ecomweb/sdk";
import {
  comingSoonStoreMetadata,
  SUSPENDED_STORE_METADATA,
  withSuspendedStoreMetadataFallback,
} from "./metadata";

describe("withSuspendedStoreMetadataFallback", () => {
  it("returns the wrapped function's metadata unchanged on success", async () => {
    const metadata = { title: "A real store" };
    const fn = vi.fn().mockResolvedValue(metadata);

    const result = await withSuspendedStoreMetadataFallback(fn);

    expect(result).toBe(metadata);
  });

  it("substitutes suspended-store metadata when the store lookup is suspended", async () => {
    const fn = vi
      .fn()
      .mockRejectedValue(
        new ApiClientError("suspended", 403, "STORE_SUSPENDED")
      );

    const result = await withSuspendedStoreMetadataFallback(fn);

    expect(result).toEqual(SUSPENDED_STORE_METADATA);
  });

  it("substitutes coming soon metadata when the store is coming soon", async () => {
    const fn = vi.fn().mockRejectedValue(
      new ApiClientError("Coming soon", 403, "STORE_COMING_SOON", {
        name: "Tiệm Hoa",
      })
    );

    const result = await withSuspendedStoreMetadataFallback(fn);

    expect(result).toEqual(comingSoonStoreMetadata("Tiệm Hoa"));
  });

  it("does not swallow an unrelated error", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("network error"));

    await expect(withSuspendedStoreMetadataFallback(fn)).rejects.toThrow(
      "network error"
    );
  });
});

describe("comingSoonStoreMetadata", () => {
  it("names the store and is noindex", () => {
    expect(comingSoonStoreMetadata("Tiệm Hoa")).toEqual({
      title: "Tiệm Hoa sắp ra mắt",
      description: "Cửa hàng đang chuẩn bị và sẽ sớm mở cửa.",
      robots: "noindex, nofollow",
    });
  });

  it("falls back to a generic title without a name", () => {
    const metadata = comingSoonStoreMetadata(null);
    expect(metadata.title).toBe("Sắp ra mắt");
    expect(metadata.robots).toBe("noindex, nofollow");
  });
});
