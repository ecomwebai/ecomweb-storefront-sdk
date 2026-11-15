import { describe, it, expect } from "vitest";
import { parsePublicConfig } from "./public";
import { ConfigError } from "./schema";

const base = {
  ECOMWEB_MODE: "multi",
  NEXT_PUBLIC_API_URL: "https://api.example.com",
  NEXT_PUBLIC_PLATFORM_API_KEY: "pk_test",
};

describe("parsePublicConfig (multi)", () => {
  it("applies today's defaults", () => {
    const c = parsePublicConfig(base);
    expect(c.mode).toBe("multi");
    expect(c.storeRef).toBeNull();
    expect(c.apiUrl).toBe("https://api.example.com");
    expect(c.assetBaseUrl).toBe("");
    expect(c.appUrl).toBe("https://ecomweb.app");
    expect(c.storefrontApiKey).toBe("pk_test");
    expect(c.platformDomainSuffix).toBe("ecomsite.app");
    expect(c.primaryMenuRef).toBe("main-menu");
    expect(c.webVitalsSampleRate).toBe(0.1);
  });

  it("strips a trailing slash from the API URL", () => {
    expect(
      parsePublicConfig({ ...base, NEXT_PUBLIC_API_URL: "https://a.io/" }).apiUrl
    ).toBe("https://a.io");
  });

  it("names every missing required variable", () => {
    expect(() => parsePublicConfig({ ECOMWEB_MODE: "multi" })).toThrow(ConfigError);
    expect(() => parsePublicConfig({ ECOMWEB_MODE: "multi", NEXT_PUBLIC_API_URL: "  " })).toThrow(
      /NEXT_PUBLIC_API_URL[\s\S]*NEXT_PUBLIC_PLATFORM_API_KEY/
    );
  });

  it("rejects a non-URL API URL", () => {
    expect(() =>
      parsePublicConfig({ ...base, NEXT_PUBLIC_API_URL: "localhost:3001" })
    ).toThrow(/NEXT_PUBLIC_API_URL/);
  });

  it("falls back to 0.1 for an unparseable sample rate", () => {
    expect(
      parsePublicConfig({ ...base, NEXT_PUBLIC_WEB_VITALS_SAMPLE_RATE: "abc" })
        .webVitalsSampleRate
    ).toBe(0.1);
  });
});
