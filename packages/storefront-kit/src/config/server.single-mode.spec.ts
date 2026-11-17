import { describe, it, expect } from "vitest";
import { parseServerConfig } from "./server";

describe("parseServerConfig (single)", () => {
  it("reads ECOMWEB_SECRET_KEY for server calls", () => {
    expect(
      parseServerConfig({ ECOMWEB_SECRET_KEY: "sk_storefront_demo" }).secretKey
    ).toBe("sk_storefront_demo");
  });

  it("is not satisfied by the publishable key", () => {
    expect(() =>
      parseServerConfig({
        ECOMWEB_PUBLISHABLE_KEY: "pk_demo",
        NEXT_PUBLIC_ECOMWEB_PUBLISHABLE_KEY: "pk_built",
      })
    ).toThrow(/ECOMWEB_SECRET_KEY/);
  });

  it("names ECOMWEB_SECRET_KEY when it is missing", () => {
    expect(() => parseServerConfig({})).toThrow(/ECOMWEB_SECRET_KEY/);
  });

  it("refuses a publishable key in ECOMWEB_SECRET_KEY", () => {
    expect(() => parseServerConfig({ ECOMWEB_SECRET_KEY: "pk_demo" })).toThrow(
      /publishable/
    );
  });

  it("lets next build run without a secret", () => {
    expect(
      parseServerConfig({ NEXT_PHASE: "phase-production-build" }).secretKey
    ).toBe("");
  });
});
