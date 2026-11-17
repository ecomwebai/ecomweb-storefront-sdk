import { describe, it, expect } from "vitest";
import { assertNoSecretInPublicEnv } from "./secret-guard";
import { ConfigError } from "./schema";

describe("assertNoSecretInPublicEnv", () => {
  it("catches a secret with leading whitespace", () => {
    expect(() =>
      assertNoSecretInPublicEnv({ NEXT_PUBLIC_X: "  sk_x" })
    ).toThrow(ConfigError);
    expect(() =>
      assertNoSecretInPublicEnv({ NEXT_PUBLIC_X: "  sk_x" })
    ).toThrow(/NEXT_PUBLIC_X/);
  });

  it("lists every offending variable and never the value", () => {
    const run = () =>
      assertNoSecretInPublicEnv({
        NEXT_PUBLIC_A: "sk_aaa_leak",
        NEXT_PUBLIC_B: "sk_bbb_leak",
      });
    expect(run).toThrow(/NEXT_PUBLIC_A[\s\S]*NEXT_PUBLIC_B/);
    expect(run).not.toThrow(/leak/);
  });

  it("passes publishable keys and server-only variables", () => {
    expect(() =>
      assertNoSecretInPublicEnv({
        NEXT_PUBLIC_PLATFORM_API_KEY: "pk_live_x",
        PLATFORM_SECRET_KEY: "sk_platform_x",
        ECOMWEB_SECRET_KEY: "sk_storefront_x",
        NEXT_PUBLIC_UNSET: undefined,
      })
    ).not.toThrow();
  });
});
