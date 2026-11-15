import { describe, expect, it } from "vitest";
import {
  compareDecimal,
  isBlankValue,
  normalizeDecimal,
  validateMetafieldValue,
  type MetafieldType,
  type MetafieldValidations,
} from "./metafield-engine";

const ctx = { currency_code: "VND" };

function check(type: MetafieldType, input: unknown, v: MetafieldValidations = {}) {
  return validateMetafieldValue(type, v, input, ctx);
}

function value(type: MetafieldType, input: unknown, v: MetafieldValidations = {}) {
  const result = check(type, input, v);
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.value;
}

function codes(type: MetafieldType, input: unknown, v: MetafieldValidations = {}) {
  const result = check(type, input, v);
  return result.ok ? [] : result.errors.map(e => `${e.path}:${e.code}`);
}

describe("text", () => {
  it("accepts single-line text and rejects newlines and non-strings", () => {
    expect(value("single_line_text", "Hà Nội")).toBe("Hà Nội");
    expect(codes("single_line_text", "a\nb")).toEqual([":invalid_format"]);
    expect(codes("single_line_text", 5)).toEqual([":invalid_type"]);
    expect(value("multi_line_text", "a\nb")).toBe("a\nb");
  });

  it("counts characters, not UTF-16 units or bytes", () => {
    expect(value("single_line_text", "ệệệ", { max_length: 3 })).toBe("ệệệ");
    expect(codes("single_line_text", "ệệệệ", { max_length: 3 })).toEqual([":too_long"]);
    expect(codes("single_line_text", "ab", { min_length: 3 })).toEqual([":too_short"]);
  });

  it("applies regex and choices", () => {
    expect(value("single_line_text", "123", { regex: "^\\d+$" })).toBe("123");
    expect(codes("single_line_text", "abc", { regex: "^\\d+$" })).toEqual([":pattern_mismatch"]);
    expect(value("single_line_text", "12", { regex: "\\d+" })).toBe("12");
    expect(codes("single_line_text", "a1", { regex: "\\d+" })).toEqual([":pattern_mismatch"]);
    expect(codes("single_line_text", "XL", { choices: ["S", "M"] })).toEqual([":not_a_choice"]);
  });

  it("trims and lower-cases email", () => {
    expect(value("email", " Lan@Example.COM ")).toBe("lan@example.com");
    expect(codes("email", "lan@")).toEqual([":invalid_format"]);
  });
});

describe("numbers", () => {
  it("accepts safe integers only", () => {
    expect(value("integer", 42)).toBe(42);
    expect(codes("integer", 4.2)).toEqual([":invalid_type"]);
    expect(codes("integer", "42")).toEqual([":invalid_type"]);
    expect(codes("integer", 6, { min: 1, max: 5 })).toEqual([":too_big"]);
    expect(codes("integer", 0, { min: 1, max: 5 })).toEqual([":too_small"]);
  });

  it("normalises decimals to canonical strings", () => {
    expect(normalizeDecimal("007.500")).toBe("7.5");
    expect(normalizeDecimal("-0.0")).toBe("0");
    expect(normalizeDecimal("+3")).toBe("3");
    expect(normalizeDecimal(0.1 + 0.2)).toBe("0.30000000000000004");
    expect(normalizeDecimal(-0)).toBe("0");
    expect(normalizeDecimal(1e21)).toBeNull();
    expect(normalizeDecimal(Number.NaN)).toBeNull();
    expect(normalizeDecimal("1.")).toBeNull();
    expect(normalizeDecimal("1e3")).toBeNull();
    expect(value("decimal", "10.50")).toBe("10.5");
  });

  it("compares canonical decimals without floats", () => {
    expect(compareDecimal("-2", "-10")).toBe(1);
    expect(compareDecimal("1.05", "1.5")).toBe(-1);
    expect(compareDecimal("10", "9.99")).toBe(1);
    expect(compareDecimal("0", "0")).toBe(0);
    expect(compareDecimal("-0.5", "0")).toBe(-1);
    expect(compareDecimal("-1.5", "-1.5")).toBe(0);
  });

  it("applies decimal precision and bounds", () => {
    expect(codes("decimal", "1.25", { max_precision: 1 })).toEqual([":precision_exceeded"]);
    expect(codes("decimal", "10", { min: "0", max: "9.99" })).toEqual([":too_big"]);
    expect(value("decimal", "9.99", { min: "0", max: "9.99" })).toBe("9.99");
  });
});

describe("dates", () => {
  it("validates calendar dates", () => {
    expect(codes("date", "2026-02-29")).toEqual([":invalid_format"]);
    expect(value("date", "2028-02-29")).toBe("2028-02-29");
    expect(value("date", "0050-01-01")).toBe("0050-01-01");
    expect(codes("date", "2025-12-31", { min: "2026-01-01" })).toEqual([":too_small"]);
  });

  it("converts date-times to UTC seconds", () => {
    expect(value("date_time", "2026-10-05T23:30:00+07:00")).toBe("2026-10-05T16:30:00Z");
    expect(value("date_time", "2026-10-05T00:30+07:00")).toBe("2026-10-04T17:30:00Z");
    expect(value("date_time", "2026-10-05T10:00:00.123Z")).toBe("2026-10-05T10:00:00Z");
    expect(codes("date_time", "2026-10-05 10:00")).toEqual([":invalid_format"]);
    expect(codes("date_time", "2026-10-05T24:00:00Z")).toEqual([":invalid_format"]);
  });

  it("rejects a date-time whose offset overflows past year 9999", () => {
    expect(codes("date_time", "9999-12-31T23:00:00-05:00")).toEqual([":invalid_format"]);
  });
});

describe("links and other scalars", () => {
  it("accepts http(s) URLs only and applies allowed domains", () => {
    expect(value("url", "https://shop.vn/a")).toBe("https://shop.vn/a");
    expect(codes("url", "javascript:alert(1)")).toEqual([":invalid_format"]);
    expect(codes("url", "ftp://x.vn")).toEqual([":invalid_format"]);
    const v = { allowed_domains: ["youtube.com"] };
    expect(value("url", "https://www.youtube.com/watch", v)).toBe("https://www.youtube.com/watch");
    expect(codes("url", "https://evilyoutube.com", v)).toEqual([":domain_not_allowed"]);
  });

  it("validates link objects", () => {
    expect(value("link", { url: "https://a.vn", text: "A" })).toEqual({ url: "https://a.vn", text: "A" });
    expect(value("link", { url: "https://a.vn" })).toEqual({ url: "https://a.vn", text: "" });
    expect(codes("link", { url: "https://a.vn", text: "A", target: "_blank" })).toEqual(["target:unknown_key"]);
    expect(codes("link", { url: "mailto:a@b.vn", text: "A" })).toEqual(["url:invalid_format"]);
  });

  it("normalises colour, boolean and language", () => {
    expect(value("color", "#A1B2C3")).toBe("#a1b2c3");
    expect(codes("color", "#abc")).toEqual([":invalid_format"]);
    expect(value("boolean", false)).toBe(false);
    expect(codes("boolean", "true")).toEqual([":invalid_type"]);
    expect(value("language", "EN-us")).toBe("en-US");
    expect(value("language", "zh-hant-tw")).toBe("zh-Hant-TW");
    expect(codes("language", "english")).toEqual([":invalid_format"]);
  });

  it("round-trips JSON", () => {
    expect(value("json", { a: [1, null] })).toEqual({ a: [1, null] });
    expect(value("json", 0)).toBe(0);
  });
});

describe("blank values and lists", () => {
  it("treats null, undefined, '' and [] as blank, never 0 or false", () => {
    for (const blank of [null, undefined, "", []]) expect(isBlankValue(blank)).toBe(true);
    for (const filled of [0, false]) expect(isBlankValue(filled)).toBe(false);
    for (const filled of [" ", { type: "root", children: [] }]) expect(isBlankValue(filled)).toBe(false);
    expect(codes("single_line_text", "")).toEqual([":blank"]);
    expect(codes("list.integer", [])).toEqual([":blank"]);
  });

  it("validates each list item with its index in the path", () => {
    expect(value("list.integer", [1, 2])).toEqual([1, 2]);
    expect(codes("list.integer", [1, "x", 3])).toEqual(["[1]:invalid_type"]);
    expect(codes("list.integer", [1, null])).toEqual(["[1]:blank"]);
    expect(codes("list.integer", 1)).toEqual([":invalid_type"]);
    expect(codes("list.single_line_text", ["S", "XL"], { choices: ["S", "M"] })).toEqual(["[1]:not_a_choice"]);
  });

  it("applies list bounds and the 128-item cap", () => {
    expect(codes("list.integer", [1, 2, 3], { list_max: 2 })).toEqual([":list_too_long"]);
    expect(codes("list.integer", [1], { list_min: 2 })).toEqual([":list_too_short"]);
    expect(codes("list.integer", Array.from({ length: 129 }, (_, i) => i))).toEqual([":list_too_long"]);
  });

  it("caps the serialised value at 64 KB of UTF-8, not characters", () => {
    expect(check("single_line_text", "ệ".repeat(5_000)).ok).toBe(true);
    const items = Array.from({ length: 20 }, () => "ệ".repeat(2_000));
    expect(codes("list.single_line_text", items)).toEqual([":too_large"]);
  });

  it("puts a caller's path prefix on every issue", () => {
    const result = validateMetafieldValue("list.integer", {}, [1, "x"], ctx, "values[2].value");
    expect(result.ok ? [] : result.errors.map(e => e.path)).toEqual(["values[2].value[1]"]);
  });
});
