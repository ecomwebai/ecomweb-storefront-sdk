import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("../config", () => ({
  publicConfig: () => ({ apiUrl: "http://api.test" }),
}));
vi.mock("../config/server", () => ({
  serverConfig: () => ({ platformApiKey: "pk_test" }),
}));

import { authHttpClient } from "./sdk";

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
    await authHttpClient("1.2.3.4", "tok").get("/public/stores/s/auth/config");
    expect(headersOfCall()["x-store-preview"]).toBe("tok");
  });

  it("does not send it on a GET without a token", async () => {
    await authHttpClient("1.2.3.4").get("/public/stores/s/auth/config");
    expect(headersOfCall()).not.toHaveProperty("x-store-preview");
  });

  it("never sends it on a write", async () => {
    await authHttpClient("1.2.3.4", "tok").post(
      "/public/stores/s/auth/login",
      {}
    );
    expect(headersOfCall()).not.toHaveProperty("x-store-preview");
  });
});
