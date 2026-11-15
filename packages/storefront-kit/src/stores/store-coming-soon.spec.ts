import { describe, expect, it } from "vitest";
import { ApiClientError } from "@ecomweb/sdk";
import {
  comingSoonStoreNameOf,
  isStoreComingSoonError,
  isStoreComingSoonResponseBody,
  STORE_COMING_SOON_REDIRECT_PATH,
} from "./store-coming-soon";

const comingSoon = () =>
  new ApiClientError("Coming soon", 403, "STORE_COMING_SOON", {
    name: "Tiệm Hoa",
  });

describe("isStoreComingSoonError", () => {
  it("is true for a STORE_COMING_SOON ApiClientError", () => {
    expect(isStoreComingSoonError(comingSoon())).toBe(true);
  });

  it("is false for other errors and non-errors", () => {
    expect(
      isStoreComingSoonError(new ApiClientError("s", 403, "STORE_SUSPENDED"))
    ).toBe(false);
    expect(
      isStoreComingSoonError(new ApiClientError("u", 404, "STORE_UNAVAILABLE"))
    ).toBe(false);
    expect(isStoreComingSoonError(new Error("x"))).toBe(false);
    expect(isStoreComingSoonError(null)).toBe(false);
    expect(isStoreComingSoonError(undefined)).toBe(false);
  });
});

describe("comingSoonStoreNameOf", () => {
  it("returns the store name from details", () => {
    expect(comingSoonStoreNameOf(comingSoon())).toBe("Tiệm Hoa");
  });

  it("returns null when details have no usable name", () => {
    const make = (details?: Record<string, unknown>) =>
      new ApiClientError("c", 403, "STORE_COMING_SOON", details);
    expect(comingSoonStoreNameOf(make(undefined))).toBeNull();
    expect(comingSoonStoreNameOf(make({}))).toBeNull();
    expect(comingSoonStoreNameOf(make({ name: "" }))).toBeNull();
    expect(comingSoonStoreNameOf(make({ name: 42 }))).toBeNull();
  });

  it("returns null for a non coming soon error even with a name", () => {
    const suspended = new ApiClientError("s", 403, "STORE_SUSPENDED", {
      name: "X",
    });
    expect(comingSoonStoreNameOf(suspended)).toBeNull();
  });
});

describe("isStoreComingSoonResponseBody", () => {
  it("is true for a STORE_COMING_SOON body", () => {
    expect(
      isStoreComingSoonResponseBody({
        code: "STORE_COMING_SOON",
        message: "Coming soon",
        details: { name: "Tiệm Hoa" },
      })
    ).toBe(true);
  });

  it("is false for anything else", () => {
    expect(isStoreComingSoonResponseBody({ code: "STORE_SUSPENDED" })).toBe(
      false
    );
    expect(isStoreComingSoonResponseBody({})).toBe(false);
    expect(isStoreComingSoonResponseBody(null)).toBe(false);
    expect(isStoreComingSoonResponseBody("STORE_COMING_SOON")).toBe(false);
  });
});

describe("STORE_COMING_SOON_REDIRECT_PATH", () => {
  it("is /coming-soon", () => {
    expect(STORE_COMING_SOON_REDIRECT_PATH).toBe("/coming-soon");
  });
});
