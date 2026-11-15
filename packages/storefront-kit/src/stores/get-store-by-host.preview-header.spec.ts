import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { InternalAxiosRequestConfig } from "axios";
import { publicApiClient } from "../api/client";
import { clearStoreByHostCache, getStoreByHost } from "./get-store-by-host";

// The request this lookup runs under carries a store preview cookie and a
// preview host's stamped token. A plain lookup must still go out without
// `x-store-preview`: its result is cached per host for every visitor
// (pre-flight ruling S1). The kit's ApiClient interceptor reads these
// through `next/headers`, so they are mocked here, not passed in.
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === "ecw_store_preview" ? { value: "srv" } : undefined,
  }),
  headers: async () =>
    new Headers({ "x-ecomweb-store-preview-token": "sp.tok" }),
}));

describe("getStoreByHost — x-store-preview on the wire", () => {
  const sent: InternalAxiosRequestConfig[] = [];
  const instance = publicApiClient.getAxiosInstance();
  const originalAdapter = instance.defaults.adapter;

  beforeEach(() => {
    sent.length = 0;
    clearStoreByHostCache();
    instance.defaults.adapter = async config => {
      sent.push(config);
      return {
        data: { ref: "abc123", config: {} },
        status: 200,
        statusText: "OK",
        headers: {},
        config,
      };
    };
  });

  afterEach(() => {
    instance.defaults.adapter = originalAdapter;
  });

  it("sends no x-store-preview on a plain lookup, even when the request carries a preview cookie", async () => {
    const result = await getStoreByHost("shop.example.com");

    expect(result.storeRef).toBe("abc123");
    expect(sent).toHaveLength(1);
    expect(sent[0]!.url).toBe("/public/stores/domain/shop.example.com");
    expect(sent[0]!.headers.get("x-store-preview")).toBeUndefined();
    // The opt-out reaches the interceptor's config intact.
    expect((sent[0] as { skipStorePreview?: unknown }).skipStorePreview).toBe(
      true
    );
  });

  // The control for the test above: the same request through the same
  // client, without the opt-out, does carry the stamped token. So the plain
  // lookup's missing header is SKIP_STORE_PREVIEW at work in the real
  // interceptor, not an interceptor that sends nothing.
  it("does send the request's token on a call without the opt-out", async () => {
    await publicApiClient.get("/public/stores/domain/shop.example.com");

    expect(sent).toHaveLength(1);
    expect(sent[0]!.headers.get("x-store-preview")).toBe("sp.tok");
  });

  it("sends exactly the given token on a preview lookup", async () => {
    await getStoreByHost("shop.example.com", { previewToken: "tok" });

    expect(sent).toHaveLength(1);
    expect(sent[0]!.headers.get("x-store-preview")).toBe("tok");
  });
});
