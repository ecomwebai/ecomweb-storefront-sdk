import { describe, expect, it } from "vitest";
import {
  isPrivateStorefrontPath,
  matchProxiedRoute,
  PROXIED_STOREFRONT_ROUTES,
} from "./proxy-routes";

describe("PROXIED_STOREFRONT_ROUTES", () => {
  it("lists no public/ route and puts every route under storefront/stores/:storeRef", () => {
    for (const r of PROXIED_STOREFRONT_ROUTES) {
      expect(r.path.startsWith("public/"), r.path).toBe(false);
      expect(r.path.startsWith("storefront/stores/:storeRef/"), r.path).toBe(
        true
      );
    }
  });

  it("does not match the old public/, tenant/ or signed-in cart paths", () => {
    expect(matchProxiedRoute("GET", ["public", "stores", "a", "cart"])).toBeNull();
    expect(matchProxiedRoute("GET", ["stores", "a", "cart"])).toBeNull();
    expect(
      matchProxiedRoute("GET", ["tenant", "stores", "a", "customers", "orders"])
    ).toBeNull();
    expect(
      matchProxiedRoute("GET", ["storefront", "stores", "a", "customers", "cart"])
    ).not.toBeNull();
  });

  it("matches a guest cart line update and returns the path's store", () => {
    expect(
      matchProxiedRoute("PUT", ["storefront", "stores", "a", "cart", "items", "9"])
        ?.storeRef
    ).toBe("a");
  });

  it("refuses public catalog reads, unknown paths, wrong methods and extra segments", () => {
    expect(
      matchProxiedRoute("GET", [
        "storefront",
        "stores",
        "a",
        "products",
        "slug",
        "x",
      ])
    ).toBeNull();
    expect(
      matchProxiedRoute("GET", [
        "storefront",
        "stores",
        "a",
        "payments",
        "initiate",
      ])
    ).toBeNull();
    expect(
      matchProxiedRoute("POST", [
        "storefront",
        "stores",
        "a",
        "cart",
        "items",
        "9",
        "x",
      ])
    ).toBeNull();
    expect(
      matchProxiedRoute("HEAD", ["storefront", "stores", "a", "cart"])
    ).toBeNull();
  });

  it("every entry has exactly one :storeRef", () => {
    for (const r of PROXIED_STOREFRONT_ROUTES) {
      expect(r.path.split("/").filter(s => s === ":storeRef")).toHaveLength(1);
    }
  });

  it("covers orders lookup, payment state, payments initiate, shipping calculate and promotions validate", () => {
    const s = ["storefront", "stores", "a"];
    expect(matchProxiedRoute("GET", [...s, "orders", "lookup"])).not.toBeNull();
    expect(
      matchProxiedRoute("GET", [...s, "orders", "ORD-1", "payment-state"])
    ).not.toBeNull();
    expect(
      matchProxiedRoute("POST", [...s, "payments", "initiate"])
    ).not.toBeNull();
    expect(
      matchProxiedRoute("POST", [...s, "shipping", "calculate"])
    ).not.toBeNull();
    expect(
      matchProxiedRoute("POST", [...s, "promotions", "validate"])
    ).not.toBeNull();
  });

  it("matches customer, review invitation and web vitals routes", () => {
    expect(
      matchProxiedRoute("PATCH", [
        "storefront",
        "stores",
        "a",
        "customers",
        "address",
        "7",
        "set-default",
      ])?.route.access
    ).toBe("private");
    expect(
      matchProxiedRoute("POST", [
        "storefront",
        "stores",
        "a",
        "review-invitations",
        "tok",
        "submit",
      ])
    ).not.toBeNull();
    expect(
      matchProxiedRoute("POST", ["storefront", "stores", "a", "web-vitals"])?.storeRef
    ).toBe("a");
  });

  it("marks the two shopper-read families as shopper-read", () => {
    expect(
      matchProxiedRoute("GET", [
        "storefront",
        "stores",
        "a",
        "metaobjects",
        "t",
        "h",
      ])?.route.access
    ).toBe("shopper-read");
    expect(
      matchProxiedRoute("GET", [
        "storefront",
        "stores",
        "a",
        "blog",
        "posts",
        "1",
        "comments",
      ])?.route.access
    ).toBe("shopper-read");
  });
});

describe("isPrivateStorefrontPath", () => {
  it("ignores the query and shopper-read entries", () => {
    expect(
      isPrivateStorefrontPath(
        "get",
        "/storefront/stores/a/orders/lookup?order_number=1"
      )
    ).toBe(true);
    expect(
      isPrivateStorefrontPath("get", "/storefront/stores/a/blog/posts/1/comments")
    ).toBe(false);
  });

  it("decodes segments and is false for public reads", () => {
    expect(isPrivateStorefrontPath("GET", "/storefront/stores/%61/cart")).toBe(
      true
    );
    expect(isPrivateStorefrontPath("GET", "/storefront/stores/a/products/1")).toBe(
      false
    );
  });
});

describe("matchProxiedRoute rejects unsafe segments", () => {
  const base = ["storefront", "stores", "a", "cart", "items"];
  it.each([
    ["encoded slash", decodeURIComponent("a%2Fb")],
    ["dot-dot", ".."],
    ["dot", "."],
    ["question mark", "a?x=1"],
    ["hash", "a#b"],
    ["backslash", "a\\b"],
    ["slash", "a/b"],
    ["double-encoded", "a%2Fb"],
    ["empty", ""],
  ])("%s in a wildcard segment", (_n, seg) => {
    expect(matchProxiedRoute("PUT", [...base, seg])).toBeNull();
  });

  it("rejects an unsafe segment in the store position or anywhere", () => {
    expect(
      matchProxiedRoute("GET", ["storefront", "stores", "..", "cart"])
    ).toBeNull();
    expect(
      matchProxiedRoute("GET", ["storefront", "stores", "a", "", "cart"])
    ).toBeNull();
  });

  it("segments decoded from %2F, %2E%2E, %3F, %23 and %252F are refused", () => {
    // What Next hands over after one decode.
    for (const raw of ["..%2F..%2Fx", "%2E%2E", "a%3Fb", "a%23b", "a%252Fb"]) {
      const seg = decodeURIComponent(raw);
      expect(matchProxiedRoute("PUT", [...base, seg])).toBeNull();
    }
  });

  it("rejects control characters and whitespace that URL parsing would strip", () => {
    for (const raw of [
      ".\t.",
      ".%0A.",
      "%2E%09%2E",
      "a b",
      "a\u0000b",
      ".\r.",
    ]) {
      const seg = decodeURIComponent(raw);
      expect(matchProxiedRoute("PUT", [...base, seg])).toBeNull();
    }
  });

  it("still matches an ordinary id", () => {
    expect(matchProxiedRoute("PUT", [...base, "item-9"])).not.toBeNull();
  });
});
