import { describe, it, expect } from "vitest";
import { parsePublicConfig } from "./public";

const base = {
  NEXT_PUBLIC_ECOMWEB_STORE_REF: "demo",
  NEXT_PUBLIC_ECOMWEB_PUBLISHABLE_KEY: "pk_demo",
  NEXT_PUBLIC_SITE_URL: "https://shop.example.com",
};

describe("parsePublicConfig (single)", () => {
  it("defaults the API and asset URLs", () => {
    const c = parsePublicConfig(base);
    expect(c.mode).toBe("single");
    expect(c.storeRef).toBe("demo");
    // Production serves the API under /api/v1 (Kong strips it); assets are
    // at the origin's /storage/v1.
    expect(c.apiUrl).toBe("https://apibase.ecomweb.app/api/v1");
    expect(c.assetBaseUrl).toBe("https://apibase.ecomweb.app");
    expect(c.appUrl).toBe("https://shop.example.com");
    expect(c.storefrontApiKey).toBe("pk_demo");
    expect(c.platformDomainSuffix).toBeNull();
  });

  it("names the template variables when they are missing", () => {
    expect(() => parsePublicConfig({})).toThrow(/ECOMWEB_STORE_REF/);
    expect(() => parsePublicConfig({})).toThrow(/ECOMWEB_PUBLISHABLE_KEY/);
    expect(() => parsePublicConfig({})).toThrow(/SITE_URL/);
  });

  it("serves assets from the API's origin when only the API URL is set", () => {
    expect(
      parsePublicConfig({
        ...base,
        NEXT_PUBLIC_ECOMWEB_API_URL: "https://api.example.com/api/v1/",
      })
    ).toMatchObject({
      apiUrl: "https://api.example.com/api/v1",
      assetBaseUrl: "https://api.example.com",
    });
    expect(
      parsePublicConfig({
        ...base,
        NEXT_PUBLIC_ECOMWEB_API_URL: "http://localhost:3001",
      }).assetBaseUrl
    ).toBe("http://localhost:3001");
  });

  it("uses ECOMWEB_ASSET_URL when set", () => {
    expect(
      parsePublicConfig({
        ...base,
        NEXT_PUBLIC_ECOMWEB_ASSET_URL: "https://cdn.x.io/",
      }).assetBaseUrl
    ).toBe("https://cdn.x.io");
  });
});

describe("parsePublicConfig mode selection", () => {
  it("parses the multi-tenant variables when ECOMWEB_MODE=multi", () => {
    const c = parsePublicConfig({
      ECOMWEB_MODE: "multi",
      NEXT_PUBLIC_API_URL: "https://api.example.com",
      NEXT_PUBLIC_PLATFORM_API_KEY: "pk_test",
    });
    expect(c.mode).toBe("multi");
  });

  it("ignores the multi-tenant variables when no mode is set", () => {
    expect(() =>
      parsePublicConfig({
        NEXT_PUBLIC_API_URL: "https://api.example.com",
        NEXT_PUBLIC_PLATFORM_API_KEY: "pk_test",
      })
    ).toThrow(/ECOMWEB_STORE_REF/);
  });
});
