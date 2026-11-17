import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createEcomwebProxiedSdk,
  createEcomwebSdk,
  createEcomwebServerSdk,
} from "./index";
import { withStorefrontKey } from "./core/storefront-key";
import type { IHttpClient, RequestOptions } from "./core/types";

function fake() {
  const urls: string[] = [];
  const options: RequestOptions[] = [];
  const record = async (url: string, ...rest: unknown[]) => {
    urls.push(url);
    options.push((rest[rest.length - 1] ?? {}) as RequestOptions);
    return { success: true, data: {} as any };
  };
  const http = {
    get: (url: string, o?: RequestOptions) => record(url, o),
    post: (url: string, d?: unknown, o?: RequestOptions) => record(url, d, o),
    put: (url: string, d?: unknown, o?: RequestOptions) => record(url, d, o),
    patch: (url: string, d?: unknown, o?: RequestOptions) => record(url, d, o),
    delete: (url: string, o?: RequestOptions) => record(url, o),
  } as unknown as IHttpClient;
  return { http, urls, options };
}

afterEach(() => vi.unstubAllGlobals());

describe("SDK factories", () => {
  it("the public SDK has no private modules, by type and at runtime", () => {
    const { http } = fake();
    const sdk = createEcomwebSdk({ publicHttp: http, authHttp: http });
    // @ts-expect-error cart is server-only
    sdk.cart;
    // @ts-expect-error validate needs a secret key
    sdk.promotions.validate;
    expect("cart" in sdk).toBe(false);
    expect("orders" in sdk).toBe(false);
    expect("payments" in sdk).toBe(false);
    expect("validate" in sdk.promotions).toBe(false);
  });

  it("the server SDK sends the secret on every call and overrides a caller's key", async () => {
    const pub = fake();
    const auth = fake();
    const sdk = createEcomwebServerSdk({
      publicHttp: pub.http,
      authHttp: auth.http,
      secretKey: "sk_storefront_x",
    });
    await sdk.products.getBySlug("s", "p");
    await sdk.cart.getCart("s", "sess", true);
    expect(pub.options).toHaveLength(1);
    expect(auth.options).toHaveLength(1);
    for (const opts of [...pub.options, ...auth.options]) {
      expect(opts.headers!["x-storefront-api-key"]).toBe("sk_storefront_x");
    }
    const f = fake();
    await withStorefrontKey(f.http, "sk_storefront_x").get("/a", {
      headers: { "X-Storefront-Api-Key": "pk_live_caller", other: "1" },
    });
    expect(f.options[0].headers).toEqual({
      other: "1",
      "x-storefront-api-key": "sk_storefront_x",
    });
  });

  it("refuses a blank or publishable secret, and the browser", () => {
    const { http } = fake();
    const make = (secretKey: string) =>
      createEcomwebServerSdk({ publicHttp: http, authHttp: http, secretKey });
    expect(() => make(" ")).toThrow(/secretKey/);
    expect(() => make("pk_live_x")).toThrow(/publishable/);
    expect(() => make("pk_live_x")).not.toThrow(/pk_live_x/);
    vi.stubGlobal("window", {});
    expect(() => make("sk_storefront_x")).toThrow(/server only/);
    expect(() => make("sk_storefront_x")).not.toThrow(/sk_storefront_x/);
  });

  it("the proxied SDK sends private calls to the proxy and public ones direct", async () => {
    const pub = fake();
    const proxy = fake();
    const sdk = createEcomwebProxiedSdk({
      publicHttp: pub.http,
      proxyHttp: proxy.http,
    });
    await sdk.products.getBySlug("s", "p");
    await sdk.cart.getCart("s", "sess", false);
    await sdk.orders.lookupGuest("s", { order_number: 1, customer_email: "a@b.c" });
    await sdk.shipping.calculate("s", {} as any);
    expect(pub.urls).toEqual([expect.stringContaining("/products/slug/p")]);
    expect(proxy.urls).toHaveLength(3);
    expect(JSON.stringify(proxy.options)).not.toContain("x-storefront-api-key");
  });
});
