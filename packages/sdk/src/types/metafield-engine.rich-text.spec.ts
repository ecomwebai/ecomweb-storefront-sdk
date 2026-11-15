import { describe, expect, it } from "vitest";
import {
  richTextLength,
  validateMetafieldValue,
  validateRichText,
  type RichTextRoot,
} from "./metafield-engine";

const paragraph = (...children: unknown[]) => ({ type: "paragraph", children });
const text = (value: string, marks: Record<string, unknown> = {}) => ({ type: "text", value, ...marks });
const root = (...children: unknown[]) => ({ type: "root", children });

function codes(input: unknown) {
  const result = validateRichText(input);
  return result.ok ? [] : result.errors.map(e => `${e.path}:${e.code}`);
}

describe("validateRichText", () => {
  it("accepts the supported grammar and drops false marks", () => {
    const tree = root(
      { type: "heading", level: 2, children: [text("Care")] },
      paragraph(
        text("Wash cold", { bold: true, italic: false }),
        { type: "link", url: "https://shop.vn/guide", title: "Guide", children: [text("guide")] }
      ),
      { type: "list", listType: "unordered", children: [{ type: "list-item", children: [text("No bleach")] }] }
    );
    const result = validateRichText(tree);
    expect(result.ok).toBe(true);
    const value = (result as { value: RichTextRoot }).value;
    expect(value.children[1]).toEqual(
      paragraph(
        text("Wash cold", { bold: true }),
        { type: "link", url: "https://shop.vn/guide", title: "Guide", children: [text("guide")] }
      )
    );
  });

  it("allows mailto links and rejects script and data links", () => {
    const link = (url: string) => root(paragraph({ type: "link", url, children: [text("x")] }));
    expect(codes(link("mailto:lan@shop.vn"))).toEqual([]);
    expect(codes(link("javascript:alert(1)"))).toEqual(["children[0].children[0].url:unsafe_url"]);
    expect(codes(link("data:text/html,<b>x</b>"))).toEqual(["children[0].children[0].url:unsafe_url"]);
  });

  it("rejects unknown node types and unknown keys", () => {
    expect(codes(root({ type: "image", url: "https://x.vn/a.png" }))).toEqual(["children[0].type:invalid_node"]);
    expect(codes(root(paragraph(text("x", { style: "color:red" }))))).toEqual([
      "children[0].children[0].style:unknown_key",
    ]);
  });

  it("rejects a list inside a list item: the grammar is flat", () => {
    const nested = root({
      type: "list",
      listType: "ordered",
      children: [{ type: "list-item", children: [{ type: "list", listType: "ordered", children: [] }] }],
    });
    expect(codes(nested)).toEqual(["children[0].children[0].children[0].type:invalid_node"]);
  });

  it("checks heading levels and list types", () => {
    expect(codes(root({ type: "heading", level: 7, children: [] }))).toEqual(["children[0].level:invalid_format"]);
    expect(codes(root({ type: "list", listType: "dotted", children: [] }))).toEqual([
      "children[0].listType:invalid_format",
    ]);
  });

  it("rejects HTML strings and non-root nodes", () => {
    expect(codes("<p>x</p>")).toEqual([":invalid_node"]);
    expect(codes(paragraph(text("x")))).toEqual([":invalid_node"]);
  });
});

describe("rich_text values", () => {
  it("counts text characters across links and lists", () => {
    const tree = root(
      paragraph(text("ab"), { type: "link", url: "https://a.vn", children: [text("cd")] }),
      { type: "list", listType: "ordered", children: [{ type: "list-item", children: [text("ệ")] }] }
    );
    const result = validateRichText(tree);
    expect(result.ok && richTextLength(result.value)).toBe(5);
  });

  it("applies max_length through validateMetafieldValue", () => {
    const tree = root(paragraph(text("abcd")));
    const result = validateMetafieldValue("rich_text", { max_length: 3 }, tree, { currency_code: "VND" });
    expect(result.ok ? [] : result.errors.map(e => e.code)).toEqual(["too_long"]);
  });
});

describe("rich-text security", () => {
  const link = (url: unknown, extra: Record<string, unknown> = {}) =>
    root(paragraph({ type: "link", url, children: [text("x")], ...extra }));

  it.each([
    " javascript:x",
    "\tjavascript:x",
    "JaVaScRiPt:x",
    "java\nscript:x",
    "mailto:a@b.vn?bcc=x@y.vn",
    "mailto:a@b.vn,c.vn",
    "mailto: a@b.vn",
    5,
  ])("rejects link url %j", url => {
    expect(codes(link(url))).toEqual(["children[0].children[0].url:unsafe_url"]);
  });

  it("accepts a bare mailto address", () => {
    expect(codes(link("mailto:a@b.vn"))).toEqual([]);
  });

  it("rejects malformed fields", () => {
    expect(codes(link("https://a.vn", { title: 5 }))).toEqual(["children[0].children[0].title:invalid_type"]);
    expect(codes(root(paragraph(text("x", { bold: "yes" }))))).toEqual(["children[0].children[0].bold:invalid_type"]);
    expect(codes(root(paragraph({ type: "text", value: 5 })))).toEqual(["children[0].children[0].value:invalid_type"]);
  });

  it("does not allow a link inside a link", () => {
    const inner = { type: "link", url: "https://a.vn", children: [text("x")] };
    const tree = root(paragraph({ type: "link", url: "https://b.vn", children: [inner] }));
    const result = validateRichText(tree);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.map(e => e.code)).toEqual(["invalid_node"]);
      expect(result.errors[0].message).toBe("a link may only contain text");
    }
  });

  it("rejects an own __proto__ key", () => {
    const input = JSON.parse('{"type":"root","children":[],"__proto__":{}}');
    expect(codes(input)).toEqual(["__proto__:unknown_key"]);
  });

  it("truncates an echoed node type", () => {
    const result = validateRichText(root(paragraph({ type: "x".repeat(500), value: "a" })));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0].message.length).toBeLessThan(100);
  });

  it("refuses a huge node list before walking it", () => {
    const result = validateRichText(root(...new Array(2001).fill(paragraph())));
    expect(result.ok ? [] : result.errors.map(e => `${e.path}:${e.code}:${e.message}`)).toEqual([
      ":too_large:has too many nodes",
    ]);
  });
});
