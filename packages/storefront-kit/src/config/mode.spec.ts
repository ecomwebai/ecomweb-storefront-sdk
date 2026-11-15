import { describe, expect, it } from "vitest";
import { resolveMode } from "./mode";
import { ConfigError } from "./schema";

describe("resolveMode", () => {
  it("defaults to single, the merchant's own storefront", () => {
    expect(resolveMode({})).toBe("single");
    expect(resolveMode({ ECOMWEB_MODE: " " })).toBe("single");
  });

  it("reads ECOMWEB_MODE on the server and NEXT_PUBLIC_ECOMWEB_MODE in the browser", () => {
    expect(resolveMode({ ECOMWEB_MODE: "multi" })).toBe("multi");
    expect(resolveMode({ NEXT_PUBLIC_ECOMWEB_MODE: "multi" })).toBe("multi");
    expect(resolveMode({ NEXT_PUBLIC_ECOMWEB_MODE: "single" })).toBe("single");
  });

  it("prefers the public variable, which next.config inlines into both bundles", () => {
    expect(
      resolveMode({ NEXT_PUBLIC_ECOMWEB_MODE: "multi", ECOMWEB_MODE: "single" })
    ).toBe("multi");
  });

  it("rejects an unknown mode, naming the variable", () => {
    expect(() => resolveMode({ ECOMWEB_MODE: "bogus" })).toThrow(ConfigError);
    expect(() => resolveMode({ ECOMWEB_MODE: "bogus" })).toThrow(
      /ECOMWEB_MODE/
    );
  });
});
