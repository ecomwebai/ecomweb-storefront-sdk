import { describe, it, expect } from "vitest";
import { refFromPathname } from "./store-path";

describe("refFromPathname", () => {
  it("reads the ref from a store path", () => {
    expect(refFromPathname("/store/1319c804")).toBe("1319c804");
    expect(refFromPathname("/store/1319c804/checkout")).toBe("1319c804");
    expect(refFromPathname("/store/1319c804/products/some-slug")).toBe(
      "1319c804"
    );
  });

  it("stops at a query string or hash", () => {
    expect(refFromPathname("/store/1319c804?utm=x")).toBe("1319c804");
    expect(refFromPathname("/store/1319c804#top")).toBe("1319c804");
  });

  it("returns null off the platform store path", () => {
    // A custom domain serves the store at the root, where there is no ref to
    // read — and callers on such a host want the bare path anyway.
    expect(refFromPathname("/")).toBeNull();
    expect(refFromPathname("/checkout")).toBeNull();
    expect(refFromPathname("/products/some-slug")).toBeNull();
  });

  it("does not match a path that merely starts with the word store", () => {
    expect(refFromPathname("/storefront/x")).toBeNull();
    expect(refFromPathname("/stores/1319c804")).toBeNull();
  });

  it("returns null rather than throwing on junk", () => {
    expect(refFromPathname("")).toBeNull();
    expect(refFromPathname("/store/")).toBeNull();
    expect(refFromPathname(undefined as unknown as string)).toBeNull();
  });
});
