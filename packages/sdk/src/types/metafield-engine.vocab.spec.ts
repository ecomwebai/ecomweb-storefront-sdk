import { describe, expect, it } from "vitest";
import {
  METAFIELD_BASE_TYPES,
  METAFIELD_TYPE_GROUPS,
  baseTypeOf,
  isListType,
  isMetafieldType,
  metafieldIdentifier,
  parseMetafieldIdentifier,
  toEntryHandle,
  toMetafieldKey,
} from "./metafield-engine";

describe("metafield types", () => {
  it("accepts base types and their list forms only", () => {
    expect(isMetafieldType("product")).toBe(true);
    expect(isMetafieldType("list.product")).toBe(true);
    expect(isMetafieldType("list.list.product")).toBe(false);
    expect(isMetafieldType("text")).toBe(false);
    expect(isMetafieldType(5)).toBe(false);
    expect(isMetafieldType("list.")).toBe(false);
    expect(isMetafieldType("constructor")).toBe(false);
  });

  it("splits list types into their base type", () => {
    expect(isListType("list.money")).toBe(true);
    expect(isListType("money")).toBe(false);
    expect(baseTypeOf("list.money")).toBe("money");
    expect(baseTypeOf("money")).toBe("money");
  });

  it("puts every base type in exactly one picker group", () => {
    const grouped = METAFIELD_TYPE_GROUPS.flatMap(g => g.types);
    expect([...grouped].sort()).toEqual([...METAFIELD_BASE_TYPES].sort());
    expect(new Set(grouped).size).toBe(grouped.length);
  });
});

describe("key derivation", () => {
  it("derives snake_case keys from names, folding Vietnamese", () => {
    expect(toMetafieldKey("Feedbacks")).toBe("feedbacks");
    expect(toMetafieldKey("Đánh giá khách hàng")).toBe("danh_gia_khach_hang");
    expect(toMetafieldKey("  Care guide!! ")).toBe("care_guide");
    expect(toMetafieldKey("Ưu đãi")).toBe("uu_dai");
  });

  it("folds decomposed input too", () => {
    expect(toMetafieldKey("Ca\u0301")).toBe("ca");
    expect(toMetafieldKey("\u0110a\u0323i")).toBe("dai");
    expect(toMetafieldKey("\u0110\u1ea1i")).toBe("dai");
  });

  it("derives an empty key from a name with no letters or digits", () => {
    expect(toMetafieldKey("🔥🔥")).toBe("");
    expect(toMetafieldKey("---")).toBe("");
  });

  it("caps keys at 64 characters without a trailing underscore", () => {
    const key = toMetafieldKey(`${"a".repeat(63)} b`);
    expect(key).toBe("a".repeat(63));
  });

  it("derives kebab-case entry handles", () => {
    expect(toEntryHandle("Lan Anh – Hà Nội")).toBe("lan-anh-ha-noi");
    expect(toEntryHandle("Đặng Thu Thảo")).toBe("dang-thu-thao");
  });
});

describe("identifiers", () => {
  it("joins and splits namespace.key", () => {
    expect(metafieldIdentifier("custom", "care_guide")).toBe("custom.care_guide");
    expect(parseMetafieldIdentifier("custom.care_guide")).toEqual({
      namespace: "custom",
      key: "care_guide",
    });
    expect(parseMetafieldIdentifier("care_guide")).toBeNull();
    expect(parseMetafieldIdentifier("custom.Care")).toBeNull();
    expect(parseMetafieldIdentifier("a.b.c")).toBeNull();
  });
});
