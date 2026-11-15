import { beforeEach, describe, it, expect, vi } from "vitest";
import { resolveStoreRef, storeApiPath, storePath } from "./";
import { authCookiePath } from "../auth/cookies";
import { resetPublicConfigForTests } from "../config/public";

describe("store-scope (multi)", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_ECOMWEB_MODE", "multi");
    resetPublicConfigForTests();
  });

  it("resolves the ref from route params", async () => {
    await expect(
      resolveStoreRef(Promise.resolve({ storeRef: "s1" }))
    ).resolves.toBe("s1");
  });

  it("prefixes page paths with /store/<ref>", () => {
    expect(storePath("s1")).toBe("/store/s1");
    expect(storePath("s1", "/login")).toBe("/store/s1/login");
    expect(storePath("s1", "login")).toBe("/store/s1/login");
    expect(storePath("s1", "?page=2")).toBe("/store/s1?page=2");
  });

  it("builds same-origin API paths", () => {
    expect(storeApiPath("s1", "auth/session")).toBe(
      "/store/s1/api/auth/session"
    );
    expect(storeApiPath("s1", "/backend")).toBe("/store/s1/api/backend");
  });

  it("encodes URL-unsafe refs exactly as the cookie path does", () => {
    expect(storePath("a b")).toBe("/store/a%20b");
    expect(storePath("a b")).toBe(authCookiePath("a b", false));
    expect(storeApiPath("a b", "auth")).toBe("/store/a%20b/api/auth");
  });
});
