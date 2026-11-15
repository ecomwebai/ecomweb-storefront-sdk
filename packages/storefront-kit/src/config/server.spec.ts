import { describe, it, expect } from "vitest";
import { parseServerConfig } from "./server";

describe("parseServerConfig (multi)", () => {
  const base = {
    ECOMWEB_MODE: "multi",
    NEXT_PUBLIC_PLATFORM_API_KEY: "pk_pub",
  };

  it("prefers PLATFORM_API_KEY over the public key", () => {
    expect(
      parseServerConfig({ ...base, PLATFORM_API_KEY: "pk_srv" }).platformApiKey
    ).toBe("pk_srv");
    expect(parseServerConfig(base).platformApiKey).toBe("pk_pub");
  });

  it("treats a blank forwarder secret as unset", () => {
    expect(
      parseServerConfig({ ...base, CLIENT_IP_FORWARDER_SECRET: "  " })
        .clientIpForwarderSecret
    ).toBeUndefined();
  });

  it("logs stores above 600 requests a minute unless told otherwise", () => {
    expect(parseServerConfig(base).storeTrafficLogPerMinute).toBe(600);
    expect(
      parseServerConfig({ ...base, STORE_TRAFFIC_LOG_PER_MINUTE: "0" })
        .storeTrafficLogPerMinute
    ).toBe(0);
    expect(
      parseServerConfig({ ...base, STORE_TRAFFIC_LOG_PER_MINUTE: "lots" })
        .storeTrafficLogPerMinute
    ).toBe(600);
  });

  it("defaults appBaseUrl and appEnv", () => {
    const c = parseServerConfig(base);
    expect(c.appBaseUrl).toBe("http://localhost:3002");
    expect(c.appEnv).toBe("unknown");
  });

  it("trusts X-Forwarded-For unless told the edge is Cloudflare", () => {
    expect(parseServerConfig(base).clientIpHeader).toBe("x-forwarded-for");
    expect(
      parseServerConfig({ ...base, CLIENT_IP_HEADER: "cf-connecting-ip" })
        .clientIpHeader
    ).toBe("cf-connecting-ip");
    expect(() =>
      parseServerConfig({ ...base, CLIENT_IP_HEADER: "x-real-ip" })
    ).toThrow(/CLIENT_IP_HEADER/);
  });
});
