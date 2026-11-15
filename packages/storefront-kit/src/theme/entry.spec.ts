import { afterEach, describe, expect, it, vi } from "vitest";

const CONFIG_ENV = [
  "NEXT_PUBLIC_ECOMWEB_STORE_REF",
  "NEXT_PUBLIC_SITE_URL",
  "NEXT_PUBLIC_ECOMWEB_PUBLISHABLE_KEY",
  "ECOMWEB_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_API_URL",
  "NEXT_PUBLIC_PLATFORM_API_KEY",
  "NEXT_PUBLIC_ECOMWEB_API_URL",
];

afterEach(() => vi.unstubAllEnvs());

describe("@ecomweb/storefront-kit/theme", () => {
  it("loads without any storefront configuration (CI exports theme schemas)", async () => {
    vi.resetModules();
    for (const name of CONFIG_ENV) vi.stubEnv(name, "");
    const theme = await import("./index");
    expect(typeof theme.defineSchema).toBe("function");
    expect(typeof theme.defineTheme).toBe("function");
  });
});
