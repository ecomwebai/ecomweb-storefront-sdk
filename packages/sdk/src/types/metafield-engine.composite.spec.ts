import { describe, expect, it } from "vitest";
import {
  METAFIELD_BASE_TYPES,
  allowedFileKinds,
  normalizeId,
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

describe("measurements", () => {
  it("normalises value and checks the unit against the type", () => {
    expect(value("weight", { value: "1.50", unit: "kg" })).toEqual({ value: "1.5", unit: "kg" });
    expect(codes("weight", { value: "1", unit: "stone" })).toEqual(["unit:invalid_unit"]);
    expect(codes("weight", { value: "1", unit: "ml" })).toEqual(["unit:invalid_unit"]);
    expect(value("volume", { value: "330", unit: "ml" })).toEqual({ value: "330", unit: "ml" });
    expect(value("dimension", { value: "2.5", unit: "cm" })).toEqual({ value: "2.5", unit: "cm" });
  });

  it("never treats prototype names as units", () => {
    expect(codes("weight", { value: "1", unit: "toString" })).toEqual(["unit:invalid_unit"]);
    expect(codes("dimension", { value: "1", unit: "constructor" })).toEqual(["unit:invalid_unit"]);
  });

  it("compares bounds across units", () => {
    const v = { min: { value: "400", unit: "g" }, max: { value: "0.5", unit: "kg" } };
    expect(codes("weight", { value: "0.3", unit: "kg" }, v)).toEqual([":too_small"]);
    expect(value("weight", { value: "1", unit: "lb" }, v)).toEqual({ value: "1", unit: "lb" });
    expect(codes("weight", { value: "2", unit: "lb" }, v)).toEqual([":too_big"]);
  });
});

describe("rating and money", () => {
  const scale = { scale_min: "1", scale_max: "5" };

  it("requires the definition's scale and a value inside it", () => {
    expect(value("rating", { value: "4.50", scale_min: "1", scale_max: "5" }, scale)).toEqual({
      value: "4.5",
      scale_min: "1",
      scale_max: "5",
    });
    expect(codes("rating", { value: "4", scale_min: "1", scale_max: "10" }, scale)).toEqual([":scale_mismatch"]);
    expect(codes("rating", { value: "6", scale_min: "1", scale_max: "5" }, scale)).toEqual(["value:too_big"]);
    expect(codes("rating", { value: "0", scale_min: "1", scale_max: "5" }, scale)).toEqual(["value:too_small"]);
  });

  it("requires the store currency", () => {
    expect(value("money", { amount: "150000.00", currency_code: "vnd" })).toEqual({
      amount: "150000",
      currency_code: "VND",
    });
    expect(codes("money", { amount: "10", currency_code: "USD" })).toEqual(["currency_code:currency_mismatch"]);
    expect(codes("money", { amount: "ten", currency_code: "VND" })).toEqual(["amount:invalid_type"]);
  });
});

describe("media", () => {
  it("accepts asset UUIDs, lower-cased", () => {
    expect(value("image", "8F14E45F-CEEA-4F7A-9C3E-2B0C1D2E3F40")).toBe("8f14e45f-ceea-4f7a-9c3e-2b0c1d2e3f40");
    expect(codes("file", "abc")).toEqual([":invalid_format"]);
  });

  it("reports which file kinds a type allows", () => {
    expect(allowedFileKinds("list.image", {})).toEqual(["image"]);
    expect(allowedFileKinds("video", {})).toEqual(["video"]);
    expect(allowedFileKinds("file", { file_types: ["document"] })).toEqual(["document"]);
    expect(allowedFileKinds("file", {})).toBeNull();
    expect(allowedFileKinds("product", {})).toBeNull();
  });
});

describe("references", () => {
  it("stores ids as strings within the bigint range", () => {
    expect(normalizeId(123)).toBe("123");
    expect(normalizeId("9223372036854775807")).toBe("9223372036854775807");
    expect(normalizeId("9223372036854775808")).toBeNull();
    expect(normalizeId(0)).toBeNull();
    expect(normalizeId(-1)).toBeNull();
    expect(normalizeId(1.5)).toBeNull();
    expect(normalizeId("012")).toBeNull();
    expect(value("product", 123)).toBe("123");
    expect(value("list.metaobject_reference", ["42", 7])).toEqual(["42", "7"]);
    expect(codes("variant", "x")).toEqual([":invalid_format"]);
  });
});

describe("object inputs", () => {
  it("rejects an own __proto__ key as unknown", () => {
    const input = JSON.parse('{"url":"https://a.vn","text":"A","__proto__":{"x":1}}');
    expect(codes("link", input)).toEqual(["__proto__:unknown_key"]);
  });
});

describe("dispatch", () => {
  it.each(METAFIELD_BASE_TYPES)("%s has a checker", type => {
    const result = check(type, Symbol("not a value"));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0].message).not.toMatch(/not supported/);
  });
});

describe("hardening", () => {
  it("never looks a type up on the prototype chain", () => {
    for (const type of ["__proto__", "constructor", "toString"]) {
      const result = validateMetafieldValue(type as never, {}, "x", ctx);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.errors[0].code).toBe("invalid_type");
    }
  });

  it("validates array holes as blank", () => {
    // eslint-disable-next-line no-sparse-arrays
    expect(codes("list.integer", [1, , 3])).toEqual(["[1]:blank"]);
  });

  it("turns -0 into 0", () => {
    expect(Object.is(value("integer", -0), 0)).toBe(true);
  });

  it("rejects NaN and Infinity anywhere in json", () => {
    expect(codes("json", { a: NaN })).toEqual([":invalid_format"]);
    expect(codes("json", [1, { b: [Infinity] }])).toEqual([":invalid_format"]);
    expect(value("json", { a: 1 })).toEqual({ a: 1 });
  });

  it("rejects NUL and lone surrogates, accepts a valid pair", () => {
    expect(codes("single_line_text", "a\u0000b")).toEqual([":invalid_format"]);
    expect(codes("single_line_text", "\ud800")).toEqual([":invalid_format"]);
    expect(codes("single_line_text", "\udc00x")).toEqual([":invalid_format"]);
    expect(codes("json", { k: "a\u0000b" })).toEqual([":invalid_format"]);
    expect(value("single_line_text", "\ud83d\ude00")).toBe("\ud83d\ude00");
    expect(value("single_line_text", "back\\u0000slash")).toBe("back\\u0000slash");
  });

  it("refuses oversized arrays before iterating", () => {
    const huge = new Array(513).fill("a");
    expect(codes("list.single_line_text", huge)).toEqual([":list_too_long"]);
    expect(codes("list.integer", Array.from({ length: 600 }, (_, i) => i))).toEqual([":list_too_long"]);
  });

  it("accepts a large json array that fits in 64 KB", () => {
    expect(codes("json", Array.from({ length: 600 }, (_, i) => i))).toEqual([]);
  });
});
