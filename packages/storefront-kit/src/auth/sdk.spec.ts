import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("../config", () => ({
  publicConfig: () => ({ apiUrl: "http://api.test" }),
}));
const secret = vi.hoisted(() => ({ value: "sk_test" }));
vi.mock("../config/server", () => ({
  serverConfig: () => ({ secretKey: secret.value }),
}));

import { authHttpClient, createAuthApi, storefrontSecretKey } from "./sdk";
import { KIT_CLIENT_TOKEN } from "../client-info";

describe("authHttpClient store preview header", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({}), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  const headersOfCall = () => fetchMock.mock.calls[0][1].headers;

  it("sends X-Store-Preview on a GET when a token is given", async () => {
    await authHttpClient("1.2.3.4", "tok").get("/storefront/stores/s/auth/config");
    expect(headersOfCall()["x-store-preview"]).toBe("tok");
  });

  it("does not send it on a GET without a token", async () => {
    await authHttpClient("1.2.3.4").get("/storefront/stores/s/auth/config");
    expect(headersOfCall()).not.toHaveProperty("x-store-preview");
  });

  it("never sends it on a write", async () => {
    await authHttpClient("1.2.3.4", "tok").post(
      "/storefront/stores/s/auth/login",
      {}
    );
    expect(headersOfCall()).not.toHaveProperty("x-store-preview");
  });
});

describe("createAuthApi client header", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("sends X-Ecomweb-Client with the kit's token before the SDK's", async () => {
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify({}), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);
    await createAuthApi("s", "1.2.3.4").login({
      email: "a@b.c",
      password: "x",
    } as any);
    const headers = (fetchMock.mock.calls[0] as any)[1].headers;
    expect(headers["X-Ecomweb-Client"]).toMatch(
      new RegExp(
        `^${KIT_CLIENT_TOKEN.replace(/[.]/g, "\\.")} @ecomweb/sdk/\\d+\\.\\d+\\.\\d+`
      )
    );
  });
});

describe("storefrontSecretKey", () => {
  afterEach(() => {
    secret.value = "sk_test";
  });

  it("returns the configured secret key", () => {
    expect(storefrontSecretKey()).toBe("sk_test");
  });

  it("throws, naming the variables, when the key is empty (a build)", () => {
    secret.value = "";
    expect(() => storefrontSecretKey()).toThrow(/PLATFORM_SECRET_KEY/);
  });

  it("signs auth calls with it", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await authHttpClient("1.2.3.4").get("/storefront/stores/s/auth/config");
    expect(fetchMock.mock.calls[0][1].headers["x-storefront-api-key"]).toBe(
      "sk_test"
    );
    vi.unstubAllGlobals();
  });
});
