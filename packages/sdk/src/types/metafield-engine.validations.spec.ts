import { describe, expect, it } from "vitest";
import { isSafeRegex, validateValidations, type MetafieldType } from "./metafield-engine";

function codes(type: MetafieldType, input: unknown) {
  const result = validateValidations(type, input);
  return result.ok ? [] : result.errors.map(e => `${e.path}:${e.code}`);
}
function value(type: MetafieldType, input: unknown) {
  const result = validateValidations(type, input);
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.value;
}

describe("isSafeRegex", () => {
  it.each([
    ["^\\d{4}$", true],
    ["^[a-z]+$", true],
    ["(?<year>\\d{4})", true],
    ["[(a+)+]", true],
    ["(a+)?", true],
    ["^\\p{L}+$", true],
    ["^\\u{61}{3}$", true],
    ["^[\\p{L}\\d]{2,10}$", true],
    ["^(S|M|L|XL)$", true],
    ["[(a+)+?*]", true],
    ["^[A-Z]{2,3}-\\d{3,6}$", true],
    ["^a{2}b{3}c{4}$", true],
    ["^\\d+\\.\\d+$", true],
    ["(a+)+", false],
    ["\\u{61}?".repeat(25) + "a".repeat(25), false],
    ["\\p{L}?".repeat(3), false],
    ["(?:a|a?)(?:a|a?)(?:a|a?)c", false],
    ["(a??)(a??)(a??)c", false],
    ["^\\d+\\.?\\d*$", false],
    ["^(?:a|b|c|d|e|f)$", false],
    ["a*a*a*a", false],
    ["a?a?a?a", false],
    ["(a|b)*", false],
    ["(a|a)*", false],
    ["^(\\w|\\d)+$", false],
    ["(?:a|aa)+", false],
    ["(ab){2,5}", false],
    ["a*a*a*b", false],
    ["^[a-z]+(-[a-z]+)*$", false],
    ["(a)\\1", false],
    ["(?<y>a)\\k<y>", false],
    ["(?=a)", false],
    ["(?<!a)b", false],
  ])("%s → %s", (pattern, safe) => {
    expect(isSafeRegex(pattern)).toBe(safe);
  });
});

describe("accepted patterns stay bounded", () => {
  it("each safe pattern finishes on 500 adversarial characters", () => {
    const safe = ["^\\d{4}$", "^[a-z]+$", "(a+)?", "^[A-Z]{2,3}-\\d{3,6}$", "^\\d+\\.\\d+$", "^(S|M|L|XL)$"];
    const started = Date.now();
    for (const pattern of safe) {
      expect(isSafeRegex(pattern)).toBe(true);
      for (const input of ["a".repeat(499) + "!", "1".repeat(499) + "!"]) {
        new RegExp(`^(?:${pattern})$`, "u").test(input);
      }
    }
    expect(Date.now() - started).toBeLessThan(1000);
  });
});

describe("unsafe regex list", () => {
  it.each(["(a+)+", "(a|b)*", "(a|a)*", "^(\\w|\\d)+$", "(?:a|aa)+", "(ab){2,5}", "a*a*a*b", "^[a-z]+(-[a-z]+)*$"])(
    "rejects %s without running it",
    pattern => {
      expect(codes("single_line_text", { regex: pattern })).toEqual(["validations.regex:unsafe_regex"]);
    }
  );
});

describe("validateValidations", () => {
  it("bounds value length when a pattern applies", () => {
    expect(value("single_line_text", { regex: "^\\d+$" })).toEqual({ regex: "^\\d+$", max_length: 500 });
    expect(codes("single_line_text", { regex: "^\\d+$", max_length: 501 })).toEqual([
      "validations.max_length:invalid_validation",
    ]);
    expect(value("single_line_text", { regex: "^\\d+$", max_length: 20 })).toEqual({ regex: "^\\d+$", max_length: 20 });
  });

  it("allows regex only on single_line_text and caps its lengths", () => {
    expect(codes("multi_line_text", { regex: "^a$" })).toEqual(["validations.regex:unknown_key"]);
    expect(codes("single_line_text", { max_length: 6000 })).toEqual(["validations.max_length:invalid_validation"]);
    expect(value("multi_line_text", { max_length: 6000 })).toEqual({ max_length: 6000 });
  });

  it("treats null and undefined as no validations", () => {
    expect(value("integer", null)).toEqual({});
    expect(value("integer", undefined)).toEqual({});
    expect(codes("integer", "min=1")).toEqual(["validations:invalid_type"]);
  });

  it("rejects keys that do not belong to the type", () => {
    expect(codes("integer", { min_length: 1 })).toEqual(["validations.min_length:unknown_key"]);
    expect(codes("integer", { list_max: 2 })).toEqual(["validations.list_max:unknown_key"]);
    expect(value("list.integer", { list_max: 2 })).toEqual({ list_max: 2 });
  });

  it("checks lengths, regex and choices for text", () => {
    expect(codes("single_line_text", { min_length: 5, max_length: 2 })).toEqual(["validations.min_length:invalid_validation"]);
    expect(codes("single_line_text", { regex: "(a+)+" })).toEqual(["validations.regex:unsafe_regex"]);
    expect(codes("single_line_text", { regex: "[" })).toEqual(["validations.regex:invalid_validation"]);
    expect(codes("single_line_text", { regex: "a".repeat(201) })).toEqual(["validations.regex:invalid_validation"]);
    expect(codes("single_line_text", { choices: ["S", "S"] })).toEqual(["validations.choices:invalid_validation"]);
    expect(codes("single_line_text", { choices: [] })).toEqual(["validations.choices:invalid_validation"]);
    expect(value("list.single_line_text", { choices: ["S", "M"] })).toEqual({ choices: ["S", "M"] });
  });

  it("canonicalises bounds per type", () => {
    expect(value("decimal", { min: "0.10", max: 5 })).toEqual({ min: "0.1", max: "5" });
    expect(codes("decimal", { min: "1.50", max: "1" })).toEqual(["validations.min:invalid_validation"]);
    expect(value("integer", { min: 1, max: 1 })).toEqual({ min: 1, max: 1 });
    expect(codes("integer", { min: 1.5 })).toEqual(["validations.min:invalid_validation"]);
    expect(codes("date", { min: "2026-13-01" })).toEqual(["validations.min:invalid_validation"]);
    expect(value("date_time", { min: "2026-10-05T07:00:00+07:00" })).toEqual({ min: "2026-10-05T00:00:00Z" });
    expect(value("weight", { max: { value: "2.0", unit: "kg" } })).toEqual({ max: { value: "2", unit: "kg" } });
    expect(codes("weight", { max: { value: "2", unit: "ml" } })).toEqual(["validations.max:invalid_validation"]);
    expect(codes("weight", { min: { value: "1", unit: "kg" }, max: { value: "500", unit: "g" } })).toEqual([
      "validations.min:invalid_validation",
    ]);
  });

  it("requires a rating scale and reference targets", () => {
    expect(codes("rating", {})).toEqual(["validations.scale_min:required", "validations.scale_max:required"]);
    expect(value("rating", { scale_min: "1", scale_max: "5.0" })).toEqual({ scale_min: "1", scale_max: "5" });
    expect(codes("rating", { scale_min: "5", scale_max: "1" })).toEqual(["validations.scale_min:invalid_validation"]);
    expect(codes("metaobject_reference", {})).toEqual(["validations.metaobject_definition_id:required"]);
    expect(value("metaobject_reference", { metaobject_definition_id: 7 })).toEqual({ metaobject_definition_id: "7" });
    expect(codes("mixed_reference", { metaobject_definition_ids: ["1"] })).toEqual([
      "validations.metaobject_definition_ids:invalid_validation",
    ]);
    expect(value("mixed_reference", { metaobject_definition_ids: ["1", 2] })).toEqual({
      metaobject_definition_ids: ["1", "2"],
    });
  });

  it("checks domains, file types, precision and list bounds", () => {
    expect(value("url", { allowed_domains: ["YouTube.com"] })).toEqual({ allowed_domains: ["youtube.com"] });
    expect(codes("url", { allowed_domains: ["https://x.com"] })).toEqual(["validations.allowed_domains:invalid_validation"]);
    expect(codes("file", { file_types: ["image", "pdf"] })).toEqual(["validations.file_types:invalid_validation"]);
    expect(codes("decimal", { max_precision: 10 })).toEqual(["validations.max_precision:invalid_validation"]);
    expect(codes("list.integer", { list_min: 3, list_max: 2 })).toEqual(["validations.list_min:invalid_validation"]);
    expect(codes("list.integer", { list_max: 129 })).toEqual(["validations.list_max:invalid_validation"]);
  });
});
