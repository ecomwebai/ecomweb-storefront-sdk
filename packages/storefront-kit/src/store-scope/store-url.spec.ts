import { describe, it, expect, vi, beforeEach } from "vitest";

async function load(env: Record<string, string>) {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_ECOMWEB_MODE", "multi");
  for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
  return (await import("./store-url")).buildStoreUrl;
}

describe("buildStoreUrl (multi)", () => {
  beforeEach(() => vi.unstubAllEnvs());

  it("uses the custom domain first", async () => {
    const b = await load({ NEXT_PUBLIC_PLATFORM_DOMAIN_SUFFIX: "ecomweb.app" });
    expect(
      b({ ref: "s1", subdomain: "shop", custom_domain: "shop.com" }, "about")
    ).toBe("https://shop.com/about");
  });

  it.each([
    [
      "a custom domain",
      { custom_domain: "shop.com", subdomain: null },
      "https://shop.com/login",
    ],
    [
      "a subdomain",
      { custom_domain: null, subdomain: "shop" },
      "https://shop.ecomweb.app/login",
    ],
    ["no domain", { custom_domain: null, subdomain: null }, "/store/s1/login"],
  ])(
    "takes a leading slash without doubling it on %s",
    async (_name, domains, url) => {
      const b = await load({
        NEXT_PUBLIC_PLATFORM_DOMAIN_SUFFIX: "ecomweb.app",
      });
      expect(b({ ref: "s1", ...domains }, "/login")).toBe(url);
    }
  );

  it("treats / as the store root", async () => {
    const b = await load({ NEXT_PUBLIC_PLATFORM_DOMAIN_SUFFIX: "ecomweb.app" });
    expect(
      b({ ref: "s1", subdomain: null, custom_domain: "shop.com" }, "/")
    ).toBe("https://shop.com");
  });

  it("falls back to the platform subdomain", async () => {
    const b = await load({ NEXT_PUBLIC_PLATFORM_DOMAIN_SUFFIX: "ecomweb.app" });
    expect(b({ ref: "s1", subdomain: "shop", custom_domain: null })).toBe(
      "https://shop.ecomweb.app"
    );
  });

  it("uses /store/<ref> on a local stack", async () => {
    const b = await load({
      NEXT_PUBLIC_APP_BASE_URL: "local",
      APP_BASE_URL: "http://localhost:3002",
    });
    expect(b({ ref: "s1", subdomain: "shop", custom_domain: null }, "x")).toBe(
      "http://localhost:3002/store/s1/x"
    );
  });

  it("falls back to a relative /store/<ref> path", async () => {
    const b = await load({});
    expect(b({ ref: "s1", subdomain: null, custom_domain: null })).toBe(
      "/store/s1"
    );
  });
});
