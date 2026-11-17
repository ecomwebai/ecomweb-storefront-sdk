import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("../config", () => ({
  publicConfig: () => ({ apiUrl: "http://api.test" }),
}));
vi.mock("../config/server", () => ({
  serverConfig: () => ({
    secretKey: "sk_storefront_test",
    clientIpHeader: "x-forwarded-for",
  }),
}));
const nextHeaders = vi.hoisted(() => ({
  headers: new Headers({ "x-forwarded-for": "198.51.100.7" }),
}));
vi.mock("next/headers", () => ({
  headers: async () => nextHeaders.headers,
  cookies: async () => ({ get: () => undefined, getAll: () => [] }),
}));
vi.mock("../stores/read-store-preview-token", () => ({
  readStorePreviewToken: async () => null,
}));

import { getServerSdk, serverSdkFor } from "./server-sdk";
import { authHttpClient } from "../auth/sdk";

describe("server SDK", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockImplementation(
      async () => new Response(JSON.stringify({}), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("signs private server calls with the secret key and the shopper IP", async () => {
    await serverSdkFor("203.0.113.9", null).reviews.getReviewInvitation(
      "s",
      "tok"
    );
    const [, init] = fetchMock.mock.calls[0];
    expect(new Headers(init.headers).get("x-storefront-api-key")).toBe(
      "sk_storefront_test"
    );
    expect(new Headers(init.headers).get("x-forwarded-for")).toBe(
      "203.0.113.9"
    );
  });

  it("joins the API base and every server-only path with one slash", async () => {
    const sdk = serverSdkFor("203.0.113.9", null);
    await sdk.reviews.getProductReviews("s", 1);
    await sdk.reviews.getReviewInvitation("s", "tok");
    await sdk.reviews.getOrderReviewInvitations("s", 5, "a@b.c");
    await sdk.reviews.getBatchOrderReviewInvitations("s", [5, 6], "a@b.c");
    await sdk.reviews.submitReviewInvitation("s", "tok", { rating: 5 } as any);
    await sdk.shipping.calculate("s", {} as any);
    await sdk.promotions.validate("s", {} as any);
    await sdk.cart.getCart("s", "sess", false);
    await sdk.orders.create("s", {} as any, false);
    await sdk.payments.initiate("s", { order_code: "o", provider_code: "p" });
    await sdk.payments.getPaymentState("s", "o");
    const urls = fetchMock.mock.calls.map(([url]) => String(url).split("?")[0]);
    expect(urls).toEqual([
      "http://api.test/storefront/stores/s/products/1/reviews",
      "http://api.test/storefront/stores/s/review-invitations/tok",
      "http://api.test/storefront/stores/s/review-invitations/by-order",
      "http://api.test/storefront/stores/s/review-invitations/by-orders",
      "http://api.test/storefront/stores/s/review-invitations/tok/submit",
      "http://api.test/storefront/stores/s/shipping/calculate",
      "http://api.test/storefront/stores/s/promotions/validate",
      "http://api.test/storefront/stores/s/cart",
      "http://api.test/storefront/stores/s/orders",
      expect.stringMatching(
        /^http:\/\/api\.test\/storefront\/stores\/s\/payments\//
      ),
      expect.stringMatching(/^http:\/\/api\.test\/storefront\/stores\/s\//),
    ]);
  });

  it("adds the slash itself when a path has none", async () => {
    await authHttpClient().get("storefront/stores/s/x");
    expect(fetchMock.mock.calls[0][0]).toBe(
      "http://api.test/storefront/stores/s/x"
    );
  });

  it("refuses shopper calls on the server without calling the API", async () => {
    await expect(serverSdkFor().addresses.list("s")).rejects.toMatchObject({
      code: "SDK_SHOPPER_CALL_ON_SERVER",
      statusCode: 401,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("getServerSdk reads the shopper IP from the incoming request", async () => {
    const sdk = await getServerSdk();
    await sdk.reviews.getReviewInvitation("s", "tok");
    const [, init] = fetchMock.mock.calls[0];
    expect(new Headers(init.headers).get("x-forwarded-for")).toBe(
      "198.51.100.7"
    );
  });
});
