import { describe, it, expect } from "vitest";
import { parseServerConfig } from "./server";

describe("parseServerConfig (multi)", () => {
  const base = {
    ECOMWEB_MODE: "multi",
    NEXT_PUBLIC_PLATFORM_API_KEY: "pk_pub",
  };
  const ok = { ...base, PLATFORM_SECRET_KEY: "sk_platform_base" };

  it("reads PLATFORM_SECRET_KEY, not the public or retired keys", () => {
    expect(
      parseServerConfig({ ...base, PLATFORM_SECRET_KEY: "sk_platform_a" })
        .secretKey
    ).toBe("sk_platform_a");
    expect(() =>
      parseServerConfig({ ...base, PLATFORM_API_KEY: "pk_srv" })
    ).toThrow(/PLATFORM_SECRET_KEY[\s\S]*PLATFORM_API_KEY is retired/);
    // NEXT_PUBLIC_PLATFORM_API_KEY is not a fallback
    expect(() => parseServerConfig(base)).toThrow(/PLATFORM_SECRET_KEY/);
    expect(() =>
      parseServerConfig({ ...base, PLATFORM_SECRET_KEY: "pk_live_x" })
    ).toThrow(/publishable/);
  });

  it("refuses a secret in any NEXT_PUBLIC_ variable and never prints it", () => {
    const run = () =>
      parseServerConfig({
        ...base,
        PLATFORM_SECRET_KEY: "sk_platform_a",
        NEXT_PUBLIC_FOO: "sk_storefront_leak",
      });
    expect(run).toThrow(/NEXT_PUBLIC_FOO/);
    expect(run).not.toThrow(/sk_storefront_leak/);
  });

  it("lets next build run without a secret, leaving it empty", () => {
    expect(
      parseServerConfig({ ...base, NEXT_PHASE: "phase-production-build" })
        .secretKey
    ).toBe("");
    expect(() =>
      parseServerConfig({ ...base, NEXT_PHASE: "phase-production-server" })
    ).toThrow(/PLATFORM_SECRET_KEY/);
  });

  it("treats a blank forwarder secret as unset", () => {
    expect(
      parseServerConfig({ ...ok, CLIENT_IP_FORWARDER_SECRET: "  " })
        .clientIpForwarderSecret
    ).toBeUndefined();
  });

  it("logs stores above 600 requests a minute unless told otherwise", () => {
    expect(parseServerConfig(ok).storeTrafficLogPerMinute).toBe(600);
    expect(
      parseServerConfig({ ...ok, STORE_TRAFFIC_LOG_PER_MINUTE: "0" })
        .storeTrafficLogPerMinute
    ).toBe(0);
    expect(
      parseServerConfig({ ...ok, STORE_TRAFFIC_LOG_PER_MINUTE: "lots" })
        .storeTrafficLogPerMinute
    ).toBe(600);
  });

  it("defaults appBaseUrl and appEnv", () => {
    const c = parseServerConfig(ok);
    expect(c.appBaseUrl).toBe("http://localhost:3002");
    expect(c.appEnv).toBe("unknown");
  });

  it("trusts X-Forwarded-For unless told the edge is Cloudflare", () => {
    expect(parseServerConfig(ok).clientIpHeader).toBe("x-forwarded-for");
    expect(
      parseServerConfig({ ...ok, CLIENT_IP_HEADER: "cf-connecting-ip" })
        .clientIpHeader
    ).toBe("cf-connecting-ip");
    expect(() =>
      parseServerConfig({ ...ok, CLIENT_IP_HEADER: "x-real-ip" })
    ).toThrow(/CLIENT_IP_HEADER/);
  });
});
