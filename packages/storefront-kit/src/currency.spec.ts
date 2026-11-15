import { describe, it, expect } from "vitest";
import {
  formatPrice,
  formatPriceRange,
  formatPriceWithoutSymbol,
  isSupportedCurrency,
  type SupportedCurrency,
} from "./currency";

/**
 * Pins the house currency convention.
 *
 * The same table is implemented in ecomweb-dashboard/lib/currency.ts and in
 * the API's src/common/utils/currency.utils.ts. These expectations are
 * duplicated verbatim in each repo's equivalent spec — if one drifts, exactly
 * one of the three suites goes red, which is the point.
 */
describe("house currency convention", () => {
  it("renders VND with dot groups, symbol after, no space", () => {
    // Close to but NOT the vi-VN currency rendering (136.999 ₫), which adds a
    // space and uses the dong sign rather than the Latin d-stroke.
    expect(formatPrice(10234000, "vi-VN", "VND")).toBe("10.234.000đ");
    expect(formatPrice(136999, "vi-VN", "VND")).toBe("136.999đ");
    expect(formatPrice(1250000, "vi-VN", "VND")).toBe("1.250.000đ");
  });

  it("renders VND with no decimal places", () => {
    expect(formatPrice(136999.4, "vi-VN", "VND")).toBe("136.999đ");
  });

  it("renders USD with symbol first and two decimals", () => {
    expect(formatPrice(1234.5, "en-US", "USD")).toBe("$1.234,50");
    expect(formatPrice(19.99, "en-US", "USD")).toBe("$19,99");
  });

  it("renders EUR and SGD", () => {
    expect(formatPrice(1234.5, "en-US", "EUR")).toBe("€1.234,50");
    expect(formatPrice(1234.5, "en-US", "SGD")).toBe("S$1.234,50");
  });

  it("keeps the sign outermost", () => {
    expect(formatPrice(-136999, "vi-VN", "VND")).toBe("-136.999đ");
    expect(formatPrice(-19.99, "en-US", "USD")).toBe("-$19,99");
  });

  it("renders zero", () => {
    expect(formatPrice(0, "vi-VN", "VND")).toBe("0đ");
    expect(formatPrice(0, "en-US", "USD")).toBe("$0,00");
  });

  it("ignores locale — the convention is uniform", () => {
    expect(formatPrice(136999, "en-US", "VND")).toBe(
      formatPrice(136999, "vi-VN", "VND"),
    );
  });

  it("falls back to VND for an unknown currency", () => {
    expect(formatPrice(136999, "vi-VN", "GBP")).toBe("136.999đ");
  });

  it("formats a range", () => {
    expect(formatPriceRange(100000, 250000, "vi-VN", "VND")).toBe(
      "100.000đ - 250.000đ",
    );
    expect(formatPriceRange(100000, 100000, "vi-VN", "VND")).toBe("100.000đ");
  });

  it("formats without a symbol for inputs", () => {
    expect(formatPriceWithoutSymbol(136999, "vi-VN", "VND")).toBe("136.999");
    expect(formatPriceWithoutSymbol(1234.5, "en-US", "USD")).toBe("1.234,50");
  });

  it("narrows supported currency codes", () => {
    expect(isSupportedCurrency("VND")).toBe(true);
    expect(isSupportedCurrency("SGD")).toBe(true);
    expect(isSupportedCurrency("GBP")).toBe(false);
    expect(isSupportedCurrency(null)).toBe(false);
  });

  it("covers every currency in the union", () => {
    const all: SupportedCurrency[] = ["VND", "USD", "EUR", "SGD"];
    for (const code of all) {
      expect(isSupportedCurrency(code)).toBe(true);
    }
  });
});
