import { describe, expect, it } from "vitest";
import { getPaymentMethod } from "./utils";

describe("getPaymentMethod", () => {
  it("passes through a code this storefront has never seen before", () => {
    // The store is the sole authority on its payment method vocabulary; the
    // API validates against the store's own enabled list, not a hardcoded
    // switch here. A gateway code the storefront doesn't recognize must
    // survive unchanged rather than being coerced to a default.
    expect(getPaymentMethod("onepay")).toBe("onepay");
  });

  it("does not turn 'ewallet' (the onboarding-seeded code, no underscore) into 'cod'", () => {
    expect(getPaymentMethod("ewallet")).toBe("ewallet");
    expect(getPaymentMethod("ewallet")).not.toBe("cod");
  });

  it("still passes through the known method codes unchanged", () => {
    expect(getPaymentMethod("cod")).toBe("cod");
    expect(getPaymentMethod("bank_transfer")).toBe("bank_transfer");
    expect(getPaymentMethod("e_wallet")).toBe("e_wallet");
    expect(getPaymentMethod("credit_card")).toBe("credit_card");
  });

  it("trims incidental whitespace", () => {
    expect(getPaymentMethod("  momo  ")).toBe("momo");
  });
});
