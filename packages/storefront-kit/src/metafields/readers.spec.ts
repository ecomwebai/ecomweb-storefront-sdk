import { describe, expect, expectTypeOf, it } from "vitest";
import type {
  ResolvedMetaobjectRef,
  ResolvedMetaobjectStub,
  RichTextRoot,
  WithMetafields,
} from "@ecomweb/sdk";
import { metafield, metaobjectField } from "./readers";

const care: RichTextRoot = {
  type: "root",
  children: [
    { type: "paragraph", children: [{ type: "text", value: "Wash cold" }] },
  ],
};

const product: WithMetafields = {
  metafields: {
    "custom.care_guide": { type: "rich_text", value: care },
    "custom.featured": { type: "boolean", value: false },
    "custom.stock_note": { type: "single_line_text", value: "" },
    "custom.rank": { type: "integer", value: 0 },
    "custom.hidden_ref": { type: "product", value: null },
  },
};

const entry: ResolvedMetaobjectRef = {
  type: "feedbacks",
  handle: "lan-anh",
  display_name: "Lan Anh",
  fields: {
    name: { type: "single_line_text", value: "Lan Anh" },
    verified: { type: "boolean", value: false },
    author: { type: "customer", value: null },
  },
};

describe("metafield", () => {
  it("reads a value by namespace.key", () => {
    expect(metafield(product, "custom.care_guide")).toEqual(care);
  });

  it("is typed by the optional generic", () => {
    const tree = metafield<RichTextRoot>(product, "custom.care_guide");
    expectTypeOf(tree).toEqualTypeOf<RichTextRoot | undefined>();
    expectTypeOf(metafield(product, "x.y")).toEqualTypeOf<unknown>();
  });

  it("keeps false, 0 and the empty string", () => {
    expect(metafield(product, "custom.featured")).toBe(false);
    expect(metafield(product, "custom.rank")).toBe(0);
    expect(metafield(product, "custom.stock_note")).toBe("");
  });

  it("returns undefined for a hidden reference (null)", () => {
    expect(metafield(product, "custom.hidden_ref")).toBeUndefined();
  });

  it("returns undefined for a missing identifier, resource or metafields object", () => {
    expect(metafield(product, "custom.nope")).toBeUndefined();
    expect(metafield(null, "custom.care_guide")).toBeUndefined();
    expect(metafield(undefined, "custom.care_guide")).toBeUndefined();
    expect(metafield({}, "custom.care_guide")).toBeUndefined();
  });

  it("never reads Object.prototype members", () => {
    for (const id of [
      "__proto__",
      "constructor",
      "toString",
      "hasOwnProperty",
    ]) {
      expect(metafield(product, id)).toBeUndefined();
    }
  });
});

describe("metaobjectField", () => {
  it("reads an entry field by key", () => {
    expect(metaobjectField<string>(entry, "name")).toBe("Lan Anh");
    expect(metaobjectField(entry, "verified")).toBe(false);
  });

  it("returns undefined for a hidden reference, a missing key or a stub", () => {
    const stub: ResolvedMetaobjectStub = {
      type: "feedbacks",
      handle: "lan-anh",
    };
    expect(metaobjectField(entry, "author")).toBeUndefined();
    expect(metaobjectField(entry, "nope")).toBeUndefined();
    expect(metaobjectField(stub, "name")).toBeUndefined();
    expect(metaobjectField(null, "name")).toBeUndefined();
  });

  it("never reads Object.prototype members", () => {
    expect(metaobjectField(entry, "__proto__")).toBeUndefined();
    expect(metaobjectField(entry, "constructor")).toBeUndefined();
  });
});

describe("the kit entry", () => {
  it("exports the metafield helpers", async () => {
    const kit = await import("../index");
    expect(typeof kit.metafield).toBe("function");
    expect(typeof kit.metaobjectField).toBe("function");
    expect(typeof kit.getMetaobjects).toBe("function");
    expect(typeof kit.getMetaobject).toBe("function");
    expect(typeof kit.RichText).toBe("function");
    // The first import of the whole entry transforms the entire kit.
  }, 30_000);
});

describe("defensive reads", () => {
  it("returns undefined for a primitive entry without throwing", () => {
    expect(metaobjectField("text" as any, "x")).toBeUndefined();
    expect(metaobjectField(5 as any, "x")).toBeUndefined();
  });

  it("reads a resource and a bare metafield map alike", () => {
    const map = { "custom.n": { type: "number_integer", value: 3 } } as any;
    expect(metafield<number>({ metafields: map } as any, "custom.n")).toBe(3);
    expect(metafield<number>(map, "custom.n")).toBe(3);
    expect(metafield(map, "custom.missing")).toBeUndefined();
    expect(metafield("text" as any, "custom.n")).toBeUndefined();
  });
});
