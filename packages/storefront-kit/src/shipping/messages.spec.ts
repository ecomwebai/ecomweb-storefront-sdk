import { describe, it, expect } from "vitest";
import { SHIPPING_MESSAGES, formatShippingEstimate } from "./messages";

describe("SHIPPING_MESSAGES", () => {
  it("is frozen so a call site cannot mutate the shared strings", () => {
    expect(Object.isFrozen(SHIPPING_MESSAGES)).toBe(true);
  });

  it("carries the free label used by the free-rendering rule", () => {
    expect(SHIPPING_MESSAGES.free).toBe("Miễn phí");
  });

  it("has no em dash in any string", () => {
    for (const value of Object.values(SHIPPING_MESSAGES)) {
      expect(value).not.toContain("—");
    }
  });
});

describe("formatShippingEstimate", () => {
  it("interpolates min and max into the template", () => {
    expect(formatShippingEstimate(2, 4)).toBe("Dự kiến giao: 2 đến 4 ngày");
  });

  it("handles a single-day estimate (min === max)", () => {
    expect(formatShippingEstimate(1, 1)).toBe("Dự kiến giao: 1 đến 1 ngày");
  });
});
