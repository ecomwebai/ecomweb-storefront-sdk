import { describe, it, expect, vi } from "vitest";

// Config is read lazily on first call, so stubbing env after these static
// imports is early enough.
import { resolveStoreRef, storePath, storeApiPath } from "./index";

vi.stubEnv("NEXT_PUBLIC_ECOMWEB_MODE", "single");
vi.stubEnv("NEXT_PUBLIC_ECOMWEB_STORE_REF", "demo");
vi.stubEnv("NEXT_PUBLIC_ECOMWEB_PUBLISHABLE_KEY", "pk_demo");
vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://shop.example.com");

describe("store-scope (single)", () => {
  it("resolves the configured store without params", async () => {
    await expect(resolveStoreRef()).resolves.toBe("demo");
  });

  it("serves pages at the root", () => {
    expect(storePath("demo")).toBe("/");
    expect(storePath("demo", "/login")).toBe("/login");
    expect(storePath("demo", "login")).toBe("/login");
    expect(storePath("demo", "?page=2")).toBe("/?page=2");
  });

  it("serves same-origin API routes at /api", () => {
    expect(storeApiPath("demo", "auth/session")).toBe("/api/auth/session");
    expect(storeApiPath("demo", "/backend")).toBe("/api/backend");
  });
});
