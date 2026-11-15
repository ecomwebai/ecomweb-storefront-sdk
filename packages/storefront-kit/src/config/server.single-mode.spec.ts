import { describe, it, expect } from "vitest";
import { parseServerConfig } from "./server";

describe("parseServerConfig (single)", () => {
  it("uses the publishable key for server calls", () => {
    expect(
      parseServerConfig({ ECOMWEB_PUBLISHABLE_KEY: "pk_demo" }).platformApiKey
    ).toBe("pk_demo");
  });

  it("falls back to the build-time public key when the runtime env lacks it", () => {
    // A Docker image built with --build-arg only has the key inlined as
    // NEXT_PUBLIC_ECOMWEB_PUBLISHABLE_KEY; the server must still start.
    expect(
      parseServerConfig({ NEXT_PUBLIC_ECOMWEB_PUBLISHABLE_KEY: "pk_built" })
        .platformApiKey
    ).toBe("pk_built");
  });

  it("names ECOMWEB_PUBLISHABLE_KEY when it is missing", () => {
    expect(() => parseServerConfig({})).toThrow(/ECOMWEB_PUBLISHABLE_KEY/);
  });
});
