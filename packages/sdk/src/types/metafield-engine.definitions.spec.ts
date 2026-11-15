import { describe, expect, it } from "vitest";
import {
  checkMetaobjectFieldChanges,
  entryDisplayName,
  validateMetafieldDefinition,
  validateMetaobjectDefinition,
  validateMetaobjectEntry,
  parseMetafieldIdentifier,
  type MetaobjectFieldShape,
} from "./metafield-engine";

function codes(result: { ok: boolean; errors?: { path: string; code: string }[] }) {
  return result.ok ? [] : (result.errors ?? []).map(e => `${e.path}:${e.code}`);
}

const careGuide = { owner_type: "product", key: "care_guide", name: "Care guide", type: "rich_text" };

describe("validateMetafieldDefinition", () => {
  it("fills defaults", () => {
    expect(validateMetafieldDefinition(careGuide)).toEqual({
      ok: true,
      value: {
        owner_type: "product",
        namespace: "custom",
        key: "care_guide",
        name: "Care guide",
        description: null,
        type: "rich_text",
        validations: {},
        storefront_access: false,
        customer_access: "none",
      },
    });
  });

  it("refuses storefront access for customer, order and location owners", () => {
    for (const owner of ["customer", "order", "location"]) {
      expect(codes(validateMetafieldDefinition({ ...careGuide, owner_type: owner, storefront_access: true }))).toEqual([
        "storefront_access:not_allowed",
      ]);
    }
    expect(validateMetafieldDefinition({ ...careGuide, storefront_access: true }).ok).toBe(true);
  });

  it("allows customer access only where the spec does", () => {
    expect(validateMetafieldDefinition({ ...careGuide, owner_type: "customer", customer_access: "read_write" }).ok).toBe(true);
    expect(validateMetafieldDefinition({ ...careGuide, owner_type: "order", customer_access: "read" }).ok).toBe(true);
    expect(codes(validateMetafieldDefinition({ ...careGuide, owner_type: "order", customer_access: "read_write" }))).toEqual([
      "customer_access:not_allowed",
    ]);
    expect(codes(validateMetafieldDefinition({ ...careGuide, customer_access: "read" }))).toEqual(["customer_access:not_allowed"]);
  });

  it("checks key, namespace, name, type and unknown keys", () => {
    expect(codes(validateMetafieldDefinition({ ...careGuide, key: "Care Guide" }))).toEqual(["key:invalid_format"]);
    expect(codes(validateMetafieldDefinition({ ...careGuide, namespace: "x" }))).toEqual(["namespace:invalid_format"]);
    expect(codes(validateMetafieldDefinition({ ...careGuide, name: "  " }))).toEqual(["name:invalid_format"]);
    expect(codes(validateMetafieldDefinition({ ...careGuide, type: "money_list" }))).toEqual(["type:invalid_format"]);
    expect(codes(validateMetafieldDefinition({ ...careGuide, pinned_position: 1 }))).toEqual(["pinned_position:unknown_key"]);
    expect(codes(validateMetafieldDefinition({ ...careGuide, owner_type: "market" }))).toEqual(["owner_type:invalid_format"]);
  });

  it("passes validation errors through with their path", () => {
    expect(codes(validateMetafieldDefinition({ ...careGuide, type: "decimal", validations: { min: "x" } }))).toEqual([
      "validations.min:invalid_validation",
    ]);
  });
});

const feedbacks = {
  type: "feedbacks",
  name: "Feedbacks",
  fields: [
    { key: "name", name: "name", type: "single_line_text", required: true },
    { key: "content", name: "content", type: "multi_line_text", required: true },
  ],
  storefront_access: true,
};

describe("validateMetaobjectDefinition", () => {
  it("fills defaults, picking the first single-line text field as display name", () => {
    const result = validateMetaobjectDefinition(feedbacks);
    expect(result.ok && result.value).toMatchObject({
      type: "feedbacks",
      description: null,
      display_name_key: "name",
      filter_keys: [],
      has_status: true,
      storefront_access: true,
      customer_access: "none",
    });
    expect(result.ok && result.value.fields[1]).toEqual({
      key: "content",
      name: "content",
      description: null,
      type: "multi_line_text",
      required: true,
      validations: {},
    });
  });

  it("needs 1 to 40 fields with distinct keys", () => {
    expect(codes(validateMetaobjectDefinition({ ...feedbacks, fields: [] }))).toEqual(["fields:too_short"]);
    const many = Array.from({ length: 41 }, (_, i) => ({ key: `f_${i}`, name: `f ${i}`, type: "integer" }));
    expect(codes(validateMetaobjectDefinition({ ...feedbacks, fields: many }))).toEqual(["fields:too_long"]);
    const twice = [feedbacks.fields[0], { ...feedbacks.fields[0] }];
    expect(codes(validateMetaobjectDefinition({ ...feedbacks, fields: twice }))).toEqual(["fields[1].key:duplicate"]);
    expect(codes(validateMetaobjectDefinition({ ...feedbacks, fields: [{ key: "x1", name: "x", type: "nope" }] }))).toEqual([
      "fields[0].type:invalid_format",
    ]);
  });

  it("checks the display name and filter keys", () => {
    expect(codes(validateMetaobjectDefinition({ ...feedbacks, display_name_key: "content" }))).toEqual([
      "display_name_key:invalid_format",
    ]);
    const noDisplay = validateMetaobjectDefinition({ ...feedbacks, display_name_key: null });
    expect(noDisplay.ok && noDisplay.value.display_name_key).toBeNull();
    expect(codes(validateMetaobjectDefinition({ ...feedbacks, filter_keys: ["content"] }))).toEqual([
      "filter_keys[0]:not_allowed",
    ]);
    expect(codes(validateMetaobjectDefinition({ ...feedbacks, filter_keys: ["x"] }))).toEqual(["filter_keys[0]:invalid_format"]);
    expect(codes(validateMetaobjectDefinition({ ...feedbacks, filter_keys: ["name", "name"] }))).toEqual([
      "filter_keys[1]:duplicate",
    ]);
  });

  it("refuses read_write customer access and a bad type handle", () => {
    expect(codes(validateMetaobjectDefinition({ ...feedbacks, customer_access: "read_write" }))).toEqual([
      "customer_access:not_allowed",
    ]);
    expect(codes(validateMetaobjectDefinition({ ...feedbacks, type: "Feedbacks" }))).toEqual(["type:invalid_format"]);
  });
});

const fields: MetaobjectFieldShape[] = [
  { key: "name", name: "Name", description: null, type: "single_line_text", required: true, validations: {} },
  { key: "email", name: "Email", description: null, type: "email", required: false, validations: {} },
];
const ctx = { currency_code: "VND" };

describe("validateMetaobjectEntry", () => {
  it("canonicalises values and omits blank optional fields", () => {
    expect(validateMetaobjectEntry(fields, { name: "Lan", email: " Lan@Shop.VN " }, ctx)).toEqual({
      ok: true,
      value: { name: "Lan", email: "lan@shop.vn" },
    });
    expect(validateMetaobjectEntry(fields, { name: "Lan", email: "" }, ctx)).toEqual({ ok: true, value: { name: "Lan" } });
  });

  it("reports missing required fields, unknown keys and bad values by key", () => {
    expect(codes(validateMetaobjectEntry(fields, { email: "x" }, ctx))).toEqual(["name:required", "email:invalid_format"]);
    expect(codes(validateMetaobjectEntry(fields, { name: "Lan", rating: 5 }, ctx))).toEqual(["rating:unknown_key"]);
    const proto = JSON.parse('{"name":"Lan","__proto__":{"x":1}}');
    expect(codes(validateMetaobjectEntry(fields, proto, ctx))).toEqual(["__proto__:unknown_key"]);
    expect(codes(validateMetaobjectEntry(fields, "Lan", ctx))).toEqual([":invalid_type"]);
  });

  it("derives the display name from the display field, else the handle", () => {
    expect(entryDisplayName({ display_name_key: "name" }, { name: "  Lan  " }, "lan")).toBe("Lan");
    expect(entryDisplayName({ display_name_key: "name" }, {}, "lan-2")).toBe("lan-2");
    expect(entryDisplayName({ display_name_key: null }, { name: "Lan" }, "lan")).toBe("lan");
  });
});

describe("checkMetaobjectFieldChanges", () => {
  it("refuses a type change and lists removed and added keys", () => {
    const after: MetaobjectFieldShape[] = [
      { ...fields[0], type: "multi_line_text" },
      { key: "photo", name: "Photo", description: null, type: "image", required: false, validations: {} },
    ];
    expect(codes(checkMetaobjectFieldChanges(fields, after))).toEqual(["fields[0].type:immutable"]);
    expect(checkMetaobjectFieldChanges(fields, [fields[0], after[1]])).toEqual({
      ok: true,
      value: { removed: ["email"], added: ["photo"] },
    });
  });
});

describe("reserved keys and edge cases", () => {
  it("rejects prototype names as keys", () => {
    const bad = { ...feedbacks, fields: [{ key: "__proto__", name: "x", type: "single_line_text" }] };
    expect(codes(validateMetaobjectDefinition(bad))).toEqual(["fields[0].key:invalid_format"]);
    expect(codes(validateMetafieldDefinition({ ...careGuide, key: "constructor" }))).toEqual(["key:invalid_format"]);
    expect(codes(validateMetafieldDefinition({ ...careGuide, namespace: "prototype" }))).toEqual(["namespace:invalid_format"]);
    expect(parseMetafieldIdentifier("custom.__proto__")).toBeNull();
    expect(parseMetafieldIdentifier("custom.care_guide")).toEqual({ namespace: "custom", key: "care_guide" });
  });

  it("cuts display names by code point", () => {
    const name = "a".repeat(254) + "\u{1F600}" + "b";
    expect(entryDisplayName({ display_name_key: "name" }, { name }, "h")).toBe("a".repeat(254) + "\u{1F600}");
  });

  it("does not default the display name to a list field, nor allow list filters", () => {
    const list = { key: "tags_x", name: "t", type: "list.single_line_text" };
    const r = validateMetaobjectDefinition({ ...feedbacks, fields: [list] });
    expect(r.ok && r.value.display_name_key).toBeNull();
    expect(codes(validateMetaobjectDefinition({ ...feedbacks, fields: [list], filter_keys: ["tags_x"] }))).toEqual([
      "filter_keys[0]:not_allowed",
    ]);
  });

  it("caps the whole entry", () => {
    const two: MetaobjectFieldShape[] = ["a_1", "b_1"].map(key => ({
      key, name: key, description: null, type: "multi_line_text", required: false, validations: {},
    }));
    const big = "x".repeat(40_000);
    expect(codes(validateMetaobjectEntry(two, { a_1: big, b_1: big }, ctx))).toEqual([":too_large"]);
  });
});
