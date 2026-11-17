import { beforeEach, describe, expect, it } from "vitest";
import type { IHttpClient } from "../core/types";
import { BlogApi, BlogServerApi } from "./blog/api";
import { ReviewsApi, ReviewsServerApi } from "./reviews/api";
import { ShippingApi, ShippingServerApi } from "./shipping/api";
import { PromotionsApi, PromotionsServerApi } from "./promotions/api";
import { CartApi } from "./cart/api";
import { OrdersApi } from "./orders/api";
import { PaymentsApi } from "./payments/api";

type Call = [string, string];

function recorder(calls: Call[]): IHttpClient {
  const record = (method: string) => async (url: string) => {
    calls.push([method, url]);
    return { success: true, data: {} };
  };
  return {
    get: record("get"),
    post: record("post"),
    put: record("put"),
    patch: record("patch"),
    delete: record("delete"),
  } as unknown as IHttpClient;
}

// Every path starts with "/": the server SDK's fetch client joins base + path
// as plain strings, so a missing slash yields ".../api/v1public/...".
const urls = (calls: Call[]) => calls.map((c) => c[1]);

describe("server-only classes", () => {
  let publicCalls: Call[];
  let privateCalls: Call[];
  let shopperCalls: Call[];
  let publicHttp: IHttpClient;
  let privateHttp: IHttpClient;
  let shopperHttp: IHttpClient;

  beforeEach(() => {
    publicCalls = [];
    privateCalls = [];
    shopperCalls = [];
    publicHttp = recorder(publicCalls);
    privateHttp = recorder(privateCalls);
    shopperHttp = recorder(shopperCalls);
  });

  it("keeps private review calls off the public client", async () => {
    const reviews = new ReviewsServerApi(publicHttp, privateHttp);
    await reviews.getProductReviews("s", 1);
    await reviews.getReviewInvitation("s", "tok");
    await reviews.getOrderReviewInvitations("s", 5, "a@b.c");
    await reviews.getBatchOrderReviewInvitations("s", [5, 6], "a@b.c");
    await reviews.submitReviewInvitation("s", "tok", { rating: 5 } as any);
    expect(publicCalls.map((c) => c[0])).toEqual(["get"]);
    expect(urls(publicCalls)[0]).toMatch(/^\/storefront\/stores\/s\/products\/1\/reviews/);
    expect(urls(privateCalls).map((u) => u.split("?")[0])).toEqual([
      "/storefront/stores/s/review-invitations/tok",
      "/storefront/stores/s/review-invitations/by-order",
      "/storefront/stores/s/review-invitations/by-orders",
      "/storefront/stores/s/review-invitations/tok/submit",
    ]);
  });

  it("public classes have no private methods at runtime", () => {
    expect("submitReviewInvitation" in new ReviewsApi(publicHttp)).toBe(false);
    expect("getReviewInvitation" in new ReviewsApi(publicHttp)).toBe(false);
    expect("calculate" in new ShippingApi(publicHttp)).toBe(false);
    expect("validate" in new PromotionsApi(publicHttp)).toBe(false);
    expect("submitComment" in new BlogApi(publicHttp, publicHttp)).toBe(false);
  });

  it("sends a guest cart call on the private client", async () => {
    await new CartApi(privateHttp, shopperHttp).getCart("s", "sess", false);
    expect(privateCalls).toEqual([["get", "/storefront/stores/s/cart"]]);
    expect(shopperCalls).toEqual([]);
  });

  it("sends a guest order on the private client", async () => {
    await new OrdersApi(privateHttp, shopperHttp).create("s", {} as any, false);
    expect(privateCalls).toEqual([["post", "/storefront/stores/s/orders"]]);
    expect(shopperCalls).toEqual([]);
  });

  it("sends shipping calculate on the private client", async () => {
    const shipping = new ShippingServerApi(publicHttp, privateHttp);
    await shipping.calculate("s", {} as any);
    await shipping.listLocationAreas("s");
    expect(privateCalls).toEqual([["post", "/storefront/stores/s/shipping/calculate"]]);
    expect(publicCalls).toEqual([["get", "/storefront/stores/s/shipping/locations"]]);
  });

  it("sends promotions validate on the private client", async () => {
    const promotions = new PromotionsServerApi(publicHttp, privateHttp);
    await promotions.validate("s", {} as any);
    await promotions.getSuggestions("s");
    expect(privateCalls).toEqual([["post", "/storefront/stores/s/promotions/validate"]]);
    expect(publicCalls.map((c) => c[0])).toEqual(["get"]);
  });

  it("sends a blog comment on the auth client", async () => {
    const blog = new BlogServerApi(publicHttp, privateHttp);
    await blog.submitComment("s", 3, { author_name: "a", content: "c" });
    await blog.getPosts("s");
    expect(privateCalls).toEqual([["post", "/storefront/stores/s/blog/posts/3/comments"]]);
    expect(publicCalls.map((c) => c[0])).toEqual(["get"]);
  });

  it("payments use their one client", async () => {
    const payments = new PaymentsApi(privateHttp);
    await payments.initiate("s", { order_code: "o", provider_code: "p" });
    await payments.getPaymentState("s", "o");
    expect(privateCalls.map((c) => c[0])).toEqual(["post", "get"]);
    expect(publicCalls).toEqual([]);
  });
});
