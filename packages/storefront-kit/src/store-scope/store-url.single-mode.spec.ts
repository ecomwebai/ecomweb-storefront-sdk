import { describe, it, expect, vi } from "vitest";

// Config is read lazily on first call, so stubbing env after these static
// imports is early enough.
import { buildStoreUrl } from "./store-url";

vi.stubEnv("NEXT_PUBLIC_ECOMWEB_MODE", "single");
vi.stubEnv("NEXT_PUBLIC_ECOMWEB_STORE_REF", "demo");
vi.stubEnv("NEXT_PUBLIC_ECOMWEB_PUBLISHABLE_KEY", "pk_demo");
vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://shop.example.com");

describe("buildStoreUrl (single)", () => {
  it("builds absolute URLs from SITE_URL", () => {
    expect(
      buildStoreUrl({ ref: "demo", subdomain: "x", custom_domain: "y.com" })
    ).toBe("https://shop.example.com");
    expect(
      buildStoreUrl(
        { ref: "demo", subdomain: null, custom_domain: null },
        "about"
      )
    ).toBe("https://shop.example.com/about");
    expect(
      buildStoreUrl(
        { ref: "demo", subdomain: null, custom_domain: null },
        "/login"
      )
    ).toBe("https://shop.example.com/login");
  });
});
