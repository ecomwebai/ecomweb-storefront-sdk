import { describe, expect, it } from "vitest";
import { ApiClientError } from "@ecomweb/sdk";
import { quoteChangedOptionsFrom } from "./quote-changed";

const options = [
  { rate_id: 41, option_id: "41:a", carrier_service_id: "a", amount: 33000 },
];

describe("quoteChangedOptionsFrom", () => {
  it("returns the new options from SHIPPING_QUOTE_CHANGED", () => {
    const error = new ApiClientError(
      "English prose",
      409,
      "SHIPPING_QUOTE_CHANGED",
      { options }
    );
    expect(quoteChangedOptionsFrom(error)).toEqual(options);
  });

  it("ignores other codes", () => {
    const error = new ApiClientError("x", 409, "INSUFFICIENT_INVENTORY", {
      options,
    });
    expect(quoteChangedOptionsFrom(error)).toBeNull();
    expect(quoteChangedOptionsFrom(null)).toBeNull();
    expect(quoteChangedOptionsFrom("boom")).toBeNull();
  });

  it("ignores a missing, empty or malformed options list", () => {
    const of = (details: unknown) =>
      quoteChangedOptionsFrom({ code: "SHIPPING_QUOTE_CHANGED", details });
    expect(of(undefined)).toBeNull();
    expect(of({})).toBeNull();
    expect(of({ options: [] })).toBeNull();
    expect(of({ options: [{ rate_id: "x" }] })).toBeNull();
    expect(of({ options: [{ rate_id: 1, amount: "5" }] })).toBeNull();
    expect(of({ options: [options[0], { rate_id: 2 }] })).toBeNull();
  });
});
