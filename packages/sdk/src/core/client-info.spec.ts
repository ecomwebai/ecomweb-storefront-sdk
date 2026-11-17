import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { createEcomwebServerSdk } from "../index";
import {
  CLIENT_HEADER,
  SDK_VERSION,
  clientHeaderValue,
  withClientHeader,
} from "./client-info";
import type { IHttpClient } from "./types";

const { version } = JSON.parse(
  readFileSync(new URL("../../package.json", import.meta.url), "utf8")
) as { version: string };

function recordingClient() {
  const ok = async (..._args: unknown[]) => ({ success: true, data: {} as any });
  const http = {
    get: vi.fn(ok),
    post: vi.fn(ok),
    put: vi.fn(ok),
    patch: vi.fn(ok),
    delete: vi.fn(ok),
  };
  return http as typeof http & IHttpClient;
}

describe("X-Ecomweb-Client", () => {
  it("bakes in this package's version", () => {
    expect(SDK_VERSION).toBe(version);
    expect(clientHeaderValue()).toBe(`@ecomweb/sdk/${version}`);
  });

  it("puts a caller's tokens first", () => {
    expect(clientHeaderValue("@ecomweb/storefront-kit/1.2.3")).toBe(
      `@ecomweb/storefront-kit/1.2.3 @ecomweb/sdk/${version}`
    );
  });

  it("adds the header to every method and keeps other options", async () => {
    const http = recordingClient();
    const wrapped = withClientHeader(http, "kit/1.0.0");
    const signal = new AbortController().signal;
    await wrapped.get("/a", { headers: { "x-other": "1" }, signal });
    await wrapped.post("/b", { x: 1 });
    await wrapped.put("/c", {});
    await wrapped.patch("/d", {});
    await wrapped.delete("/e");
    const value = `kit/1.0.0 @ecomweb/sdk/${version}`;
    expect(http.get).toHaveBeenCalledWith("/a", {
      headers: { [CLIENT_HEADER]: value, "x-other": "1" },
      signal,
    });
    expect(http.post).toHaveBeenCalledWith("/b", { x: 1 }, {
      headers: { [CLIENT_HEADER]: value },
    });
    for (const m of ["put", "patch"] as const) {
      expect(http[m].mock.calls[0][2]).toEqual({ headers: { [CLIENT_HEADER]: value } });
    }
    expect(http.delete.mock.calls[0][1]).toEqual({ headers: { [CLIENT_HEADER]: value } });
  });

  it("leaves a header the caller set", async () => {
    const http = recordingClient();
    await withClientHeader(http).get("/a", { headers: { "x-ecomweb-client": "mine/1" } });
    expect(http.get).toHaveBeenCalledWith("/a", { headers: { "x-ecomweb-client": "mine/1" } });
  });

  it("is sent by the SDK factories, with clientInfo first", async () => {
    const publicHttp = recordingClient();
    const authHttp = recordingClient();
    const sdk = createEcomwebServerSdk({ publicHttp, authHttp, secretKey: "sk_storefront_x", clientInfo: "@ecomweb/storefront-kit/9.9.9" });
    await sdk.stores.getById("store-1");
    await sdk.addresses.list("store-1");
    const calls = [...publicHttp.get.mock.calls, ...authHttp.get.mock.calls];
    expect(calls).toHaveLength(2);
    for (const call of calls) {
      expect((call[1] as any).headers[CLIENT_HEADER]).toBe(
        `@ecomweb/storefront-kit/9.9.9 @ecomweb/sdk/${version}`
      );
    }
  });
});
