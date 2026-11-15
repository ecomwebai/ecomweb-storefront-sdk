import { describe, expect, it } from "vitest";
import {
  isBlankValueFor,
  isValidEntryHandle,
  toEntryHandle,
  validateMetafieldDefinition,
  validateMetafieldValue,
  validateMetaobjectDefinition,
  validateMetaobjectEntry,
  validateRichText,
  validateValidations,
  type MetafieldType,
  type MetafieldValidations,
  type MetaobjectFieldShape,
} from "./metafield-engine";

const ctx = { currency_code: "VND" };

function codes(result: { ok: boolean; errors?: { path: string; code: string }[] }) {
  return result.ok ? [] : (result.errors ?? []).map(e => `${e.path}:${e.code}`);
}

function check(type: MetafieldType, input: unknown, v: MetafieldValidations = {}) {
  return validateMetafieldValue(type, v, input, ctx);
}

describe("blank roots and whitespace (I1)", () => {
  it("treats an empty rich-text root and whitespace-only text as blank, per type", () => {
    const empty = { type: "root", children: [] };
    expect(isBlankValueFor("rich_text", empty)).toBe(true);
    expect(isBlankValueFor("single_line_text", "   ")).toBe(true);
    expect(isBlankValueFor("json", "   ")).toBe(false);
    expect(isBlankValueFor("json", empty)).toBe(false);
    expect(isBlankValueFor("single_line_text", empty)).toBe(false);
    expect(isBlankValueFor("rich_text", { type: "root", children: [{ type: "paragraph", children: [] }] })).toBe(false);
    expect(codes(check("rich_text", empty))).toEqual([":blank"]);
    expect(codes(check("single_line_text", "   "))).toEqual([":blank"]);
    expect(check("json", "   ")).toEqual({ ok: true, value: "   " });
    expect(check("json", empty)).toEqual({ ok: true, value: empty });
    expect(codes(check("list.rich_text", [empty]))).toEqual(["[0]:blank"]);
    expect(codes(check("list.single_line_text", ["  "]))).toEqual(["[0]:blank"]);
  });

  it("tests choice length before running the regex", () => {
    const choices = Array.from({ length: 128 }, (_, i) => `${i}`.padEnd(5000, "a"));
    const started = performance.now();
    const result = validateValidations("single_line_text", { choices, regex: "a+" });
    expect(codes(result).length).toBe(1);
    expect(performance.now() - started).toBeLessThan(100);
  });

  it("makes a required rich_text entry field with an empty root count as missing", () => {
    const fields: MetaobjectFieldShape[] = [
      { key: "body", name: "Body", description: null, type: "rich_text", required: true, validations: {} },
    ];
    expect(codes(validateMetaobjectEntry(fields, { body: { type: "root", children: [] } }, ctx))).toEqual([
      "body:required",
    ]);
  });
});

describe("storable definitions (I2)", () => {
  it("rejects NUL in a metafield definition name and lone surrogates in choices", () => {
    const base = { owner_type: "product", key: "care_guide", name: "Care", type: "single_line_text" };
    expect(codes(validateMetafieldDefinition({ ...base, name: "Care\u0000" }))).toEqual([":invalid_format"]);
    expect(codes(validateMetafieldDefinition({ ...base, validations: { choices: ["\ud800"] } }))).toEqual([
      ":invalid_format",
    ]);
  });

  it("rejects the same in a metaobject definition", () => {
    const field = { key: "title", name: "Title", type: "single_line_text" };
    expect(codes(validateMetaobjectDefinition({ type: "lookbook", name: "Look\u0000", fields: [field] }))).toEqual([
      ":invalid_format",
    ]);
    expect(
      codes(
        validateMetaobjectDefinition({
          type: "lookbook",
          name: "Look",
          fields: [{ ...field, validations: { choices: ["\ud800"] } }],
        })
      )
    ).toEqual([":invalid_format"]);
  });
});

describe("total functions (M1)", () => {
  it("never throws on a bad type, bad validations or bad fields", () => {
    expect(codes(validateMetafieldValue(123 as never, {}, "x", ctx))).toEqual([":invalid_type"]);
    expect(codes(validateMetafieldValue(null as never, {}, "x", ctx))).toEqual([":invalid_type"]);
    expect(codes(validateMetafieldValue("toString" as never, {}, "x", ctx))).toEqual([":invalid_type"]);
    expect(codes(validateValidations("toString" as never, {}))).toEqual(["validations:invalid_type"]);
    expect(codes(validateValidations(null as never, {}))).toEqual(["validations:invalid_type"]);
    expect(codes(validateMetaobjectEntry(null as never, {}, ctx))).toEqual([":invalid_type"]);
  });

  it("treats missing or non-object validations as none", () => {
    expect(validateMetafieldValue("single_line_text", undefined as never, "x", ctx)).toEqual({ ok: true, value: "x" });
    expect(validateMetafieldValue("single_line_text", "oops" as never, "x", ctx)).toEqual({ ok: true, value: "x" });
  });
});

describe("validation cross-checks (M2)", () => {
  it("compares min_length with the max_length a regex implies", () => {
    expect(codes(validateValidations("single_line_text", { min_length: 600, regex: "a+" }))).toEqual([
      "validations.min_length:invalid_validation",
    ]);
  });

  it("requires every choice to satisfy the length and pattern rules", () => {
    expect(codes(validateValidations("single_line_text", { choices: ["S", "XL"], max_length: 1 }))).toEqual([
      "validations.choices:invalid_validation",
    ]);
    expect(codes(validateValidations("single_line_text", { choices: ["S", "XL"], regex: "[A-Z]" }))).toEqual([
      "validations.choices:invalid_validation",
    ]);
    expect(validateValidations("single_line_text", { choices: ["S", "M"], max_length: 1 }).ok).toBe(true);
  });
});

describe("regex value cap (M3)", () => {
  it("caps the value at regex_value_length even without max_length", () => {
    expect(codes(check("single_line_text", "a".repeat(501), { regex: "a+" }))).toEqual([":too_long"]);
    expect(check("single_line_text", "a".repeat(500), { regex: "a+" }).ok).toBe(true);
  });
});

describe("url safety (M4)", () => {
  const rejected = ["\u0000", "\u0001", "\u001f", "\u007f", "\u0085", "\u009f", '"', "<", ">", "`", "\\"];

  it("rejects control and markup characters in url and link values", () => {
    for (const char of rejected) {
      const url = `https://shop.vn/a${char}b`;
      expect(codes(check("url", url)), JSON.stringify(char)).toEqual([":invalid_format"]);
      expect(codes(check("link", { url, text: "x" })), JSON.stringify(char)).toEqual(["url:invalid_format"]);
    }
  });

  it("rejects them in rich-text links as unsafe_url", () => {
    const link = (url: string) => ({
      type: "root",
      children: [
        { type: "paragraph", children: [{ type: "link", url, children: [{ type: "text", value: "x" }] }] },
      ],
    });
    for (const char of rejected) {
      expect(codes(validateRichText(link(`https://shop.vn/a${char}b`))), JSON.stringify(char)).toEqual([
        "children[0].children[0].url:unsafe_url",
      ]);
    }
    expect(codes(validateRichText(link('mailto:a"b@x.vn')))).toEqual(["children[0].children[0].url:unsafe_url"]);
    expect(validateRichText(link("mailto:a@x.vn")).ok).toBe(true);
  });

  it("keeps the raw value and accepts non-ASCII paths", () => {
    expect(check("url", "https://shop.vn/áo")).toEqual({ ok: true, value: "https://shop.vn/áo" });
    expect(check("url", "https://shop.vn")).toEqual({ ok: true, value: "https://shop.vn" });
  });
});

describe("reserved names (M5)", () => {
  it("rejects reserved metaobject types", () => {
    const field = { key: "title", name: "Title", type: "single_line_text" };
    for (const type of ["__proto__", "constructor", "prototype"]) {
      const result = validateMetaobjectDefinition({ type, name: "X", fields: [field] });
      expect(codes(result).filter(c => c.startsWith("type:"))).toEqual(["type:invalid_format"]);
    }
    expect(validateMetaobjectDefinition({ type: "lookbook", name: "X", fields: [field] }).ok).toBe(true);
  });

  it("rejects reserved entry handles", () => {
    expect(isValidEntryHandle("constructor")).toBe(false);
    expect(isValidEntryHandle("prototype")).toBe(false);
    expect(isValidEntryHandle("__proto__")).toBe(false);
    expect(isValidEntryHandle("summer-look")).toBe(true);
    expect(toEntryHandle("constructor")).toBe("");
    expect(toEntryHandle("Prototype")).toBe("");
    expect(toEntryHandle("Summer Look")).toBe("summer-look");
  });
});

describe("rich-text error cap (M6)", () => {
  it("reports at most 100 problems", () => {
    const bad = Array.from({ length: 300 }, () => ({ type: "image" }));
    const result = validateRichText({ type: "root", children: [{ type: "paragraph", children: bad }] });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toHaveLength(100);
  });
});
