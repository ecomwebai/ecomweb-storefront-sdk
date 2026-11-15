import { describe, expect, it } from "vitest";
import {
  externalStorefrontUrl,
  externalThemeRedirectFor,
  isSameHost,
} from "./external-storefront";

describe("externalStorefrontUrl", () => {
  it("keeps the path and query exactly", () => {
    expect(
      externalStorefrontUrl(
        "https://shop.example.com",
        "/products/ao-thun",
        "?color=den"
      )?.toString()
    ).toBe("https://shop.example.com/products/ao-thun?color=den");
  });

  it("keeps an encoded path as it came", () => {
    expect(
      externalStorefrontUrl(
        "https://shop.example.com",
        "/search/%C3%A1o%20thun",
        ""
      )?.toString()
    ).toBe("https://shop.example.com/search/%C3%A1o%20thun");
  });

  it("puts the path under the external URL's own path", () => {
    expect(
      externalStorefrontUrl(
        "https://example.com/shop",
        "/products/x",
        ""
      )?.toString()
    ).toBe("https://example.com/shop/products/x");
    expect(
      externalStorefrontUrl(
        "https://example.com/shop/",
        "/",
        "?a=1"
      )?.toString()
    ).toBe("https://example.com/shop?a=1");
    expect(
      externalStorefrontUrl("https://example.com", "/", "")?.toString()
    ).toBe("https://example.com/");
  });

  it("drops a hash the stored URL should not have", () => {
    expect(
      externalStorefrontUrl("https://example.com#x", "/a", "")?.toString()
    ).toBe("https://example.com/a");
  });

  it("is null without a usable https URL (fail open)", () => {
    expect(externalStorefrontUrl(undefined, "/", "")).toBeNull();
    expect(externalStorefrontUrl(null, "/", "")).toBeNull();
    expect(externalStorefrontUrl("", "/", "")).toBeNull();
    expect(externalStorefrontUrl("not a url", "/", "")).toBeNull();
    expect(externalStorefrontUrl("http://example.com", "/", "")).toBeNull();
    expect(externalStorefrontUrl("javascript:alert(1)", "/", "")).toBeNull();
  });
});

describe("isSameHost", () => {
  it("compares host names, ignoring case and port", () => {
    expect(isSameHost("Shop.Example.com:443", "shop.example.com")).toBe(true);
    expect(isSameHost("shop.example.com", "www.shop.example.com")).toBe(false);
    expect(isSameHost("", "shop.example.com")).toBe(false);
  });
});

describe("externalThemeRedirectFor (store layout backstop)", () => {
  const external = {
    kind: "external" as const,
    external_url: "https://shop.example.com",
  };
  const req = (h: Record<string, string>) => ({ headers: new Headers(h) });
  const pathBased = (path: string) =>
    req({
      host: "ecomsite.app",
      "x-ecomweb-host-mapped": "0",
      "x-ecomweb-request-path": path,
    });

  it("sends path-based access to the external site without /store/<ref>", () => {
    expect(
      externalThemeRedirectFor(
        pathBased("/store/abc/products/ao-thun?color=den"),
        "abc",
        external,
        false
      )
    ).toBe("https://shop.example.com/products/ao-thun?color=den");
    expect(
      externalThemeRedirectFor(pathBased("/store/abc"), "abc", external, false)
    ).toBe("https://shop.example.com/");
  });

  it("matches an encoded store ref in the path", () => {
    expect(
      externalThemeRedirectFor(
        pathBased("/store/c%C3%A0-ph%C3%AA/x"),
        "cà-phê",
        external,
        false
      )
    ).toBe("https://shop.example.com/x");
  });

  it("goes to the store root when the middleware left no path", () => {
    expect(
      externalThemeRedirectFor(
        req({ host: "ecomsite.app", "x-ecomweb-host-mapped": "0" }),
        "abc",
        external,
        false
      )
    ).toBe("https://shop.example.com/");
  });

  it("is null for an Ecomweb theme, a preview, or no usable URL", () => {
    const r = pathBased("/store/abc/x");
    expect(
      externalThemeRedirectFor(r, "abc", { kind: "hosted" }, false)
    ).toBeNull();
    expect(externalThemeRedirectFor(r, "abc", undefined, false)).toBeNull();
    expect(externalThemeRedirectFor(r, "abc", external, true)).toBeNull();
    expect(
      externalThemeRedirectFor(
        r,
        "abc",
        { kind: "external", external_url: null },
        false
      )
    ).toBeNull();
  });

  it("leaves host-mapped requests to the middleware (absent stamp counts as host-mapped)", () => {
    expect(
      externalThemeRedirectFor(
        req({ host: "abc.ecomsite.app", "x-ecomweb-host-mapped": "1" }),
        "abc",
        external,
        false
      )
    ).toBeNull();
    expect(
      externalThemeRedirectFor(req({ host: "x" }), "abc", external, false)
    ).toBeNull();
  });

  it("never redirects to the request's own host", () => {
    expect(
      externalThemeRedirectFor(
        req({
          host: "shop.example.com",
          "x-ecomweb-host-mapped": "0",
          "x-ecomweb-request-path": "/store/abc/x",
        }),
        "abc",
        external,
        false
      )
    ).toBeNull();
  });
});
