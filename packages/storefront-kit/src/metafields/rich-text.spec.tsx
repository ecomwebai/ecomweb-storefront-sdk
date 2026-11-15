import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { RichTextRoot } from "@ecomweb/sdk";
import { RichText, richTextHref } from "./rich-text";

const html = (value: unknown) =>
  renderToStaticMarkup(<RichText value={value as RichTextRoot} />);

const linkTo = (url: string): RichTextRoot => ({
  type: "root",
  children: [
    {
      type: "paragraph",
      children: [
        { type: "link", url, children: [{ type: "text", value: "click" }] },
      ],
    },
  ],
});

describe("<RichText>", () => {
  it("renders the spec 5.3 example as elements", () => {
    const tree: RichTextRoot = {
      type: "root",
      children: [
        {
          type: "heading",
          level: 2,
          children: [{ type: "text", value: "Care" }],
        },
        {
          type: "paragraph",
          children: [
            { type: "text", value: "Wash cold", bold: true },
            {
              type: "link",
              url: "https://example.test/guide",
              title: "Guide",
              children: [{ type: "text", value: "guide" }],
            },
          ],
        },
        {
          type: "list",
          listType: "unordered",
          children: [
            {
              type: "list-item",
              children: [{ type: "text", value: "No bleach" }],
            },
          ],
        },
      ],
    };
    expect(html(tree)).toBe(
      '<h2>Care</h2><p><strong>Wash cold</strong><a href="https://example.test/guide" rel="noopener noreferrer" title="Guide">guide</a></p><ul><li>No bleach</li></ul>'
    );
  });

  it("renders ordered lists, every heading level, and bold with italic", () => {
    const tree: RichTextRoot = {
      type: "root",
      children: [
        ...([1, 2, 3, 4, 5, 6] as const).map(level => ({
          type: "heading" as const,
          level,
          children: [{ type: "text" as const, value: `H${level}` }],
        })),
        {
          type: "list",
          listType: "ordered",
          children: [
            {
              type: "list-item",
              children: [
                { type: "text", value: "a", bold: true, italic: true },
              ],
            },
          ],
        },
      ],
    };
    expect(html(tree)).toBe(
      "<h1>H1</h1><h2>H2</h2><h3>H3</h3><h4>H4</h4><h5>H5</h5><h6>H6</h6><ol><li><strong><em>a</em></strong></li></ol>"
    );
  });

  it("renders a bare mailto link without rel", () => {
    expect(html(linkTo("mailto:hi@example.test"))).toBe(
      '<p><a href="mailto:hi@example.test">click</a></p>'
    );
  });

  it("escapes text instead of interpreting it", () => {
    const tree = {
      type: "root",
      children: [
        {
          type: "paragraph",
          children: [{ type: "text", value: "<img src=x onerror=alert(1)>" }],
        },
      ],
    };
    expect(html(tree)).toBe("<p>&lt;img src=x onerror=alert(1)&gt;</p>");
  });

  it.each([
    "javascript:alert(1)",
    "JavaScript:alert(1)",
    " javascript:alert(1)",
    "\tjavascript:alert(1)",
    "\u0001javascript:alert(1)",
    "java\u0000script:alert(1)",
    "https://example.test/\u0085x",
    "data:text/html,<script>alert(1)</script>",
    "vbscript:msgbox(1)",
    'https://example.test/"onmouseover="alert(1)',
    "https://example.test/<x>",
    "https://example.test/`x",
    "https://example.test/a\\b",
    "//evil.test/x",
    "/relative/path",
    "mailto:a@b.test?bcc=c@d.test",
    "mailto:a@b.test,c@d.test",
    "mailto:Name <a@b.test>",
    "",
  ])("renders the text of a link to %j without an anchor", url => {
    expect(html(linkTo(url))).toBe("<p>click</p>");
  });

  it("refuses an over-long href", () => {
    expect(html(linkTo(`https://example.test/${"a".repeat(2100)}`))).toBe(
      "<p>click</p>"
    );
  });

  it("ignores unknown nodes, unknown keys and nested lists", () => {
    const tree = {
      type: "root",
      children: [
        { type: "html", value: "<b>x</b>" },
        {
          type: "paragraph",
          dangerouslySetInnerHTML: { __html: "<script>alert(1)</script>" },
          className: "evil",
          children: [
            { type: "raw", value: "<i>" },
            { type: "text", value: "ok", bold: "true", onClick: "alert(1)" },
          ],
        },
        {
          type: "list",
          listType: "unordered",
          children: [
            {
              type: "list-item",
              children: [
                { type: "text", value: "one" },
                {
                  type: "list",
                  listType: "ordered",
                  children: [
                    {
                      type: "list-item",
                      children: [{ type: "text", value: "deep" }],
                    },
                  ],
                },
              ],
            },
            {
              type: "paragraph",
              children: [{ type: "text", value: "not an item" }],
            },
          ],
        },
        {
          type: "paragraph",
          children: [
            {
              type: "link",
              url: "https://example.test",
              children: [
                { type: "text", value: "a" },
                { type: "link", url: "https://evil.test", children: [] },
              ],
            },
          ],
        },
      ],
    };
    expect(html(tree)).toBe(
      '<p>ok</p><ul><li>one</li></ul><p><a href="https://example.test" rel="noopener noreferrer">a</a></p>'
    );
  });

  it("renders a heading with a bad level as a paragraph", () => {
    for (const level of [0, 7, 2.5, "2", null]) {
      const tree = {
        type: "root",
        children: [
          { type: "heading", level, children: [{ type: "text", value: "T" }] },
        ],
      };
      expect(html(tree)).toBe("<p>T</p>");
    }
  });

  it("renders nothing for an empty or malformed value", () => {
    for (const value of [
      null,
      undefined,
      "text",
      [],
      { type: "paragraph", children: [] },
      { type: "root", children: [] },
      { type: "root", children: "x" },
      { type: "root" },
      { type: "root", children: [null, 5, "x", { type: "paragraph" }] },
    ]) {
      expect(() => html(value)).not.toThrow();
    }
    expect(html(null)).toBe("");
    expect(html({ type: "root", children: [] })).toBe("");
    expect(html({ type: "root", children: "x" })).toBe("");
    expect(
      html({ type: "root", children: [null, { type: "paragraph" }] })
    ).toBe("<p></p>");
  });

  it("never uses a raw-HTML escape hatch", () => {
    const source = readFileSync(
      new URL("./rich-text.tsx", import.meta.url),
      "utf8"
    );
    expect(source).not.toMatch(/dangerouslySetInnerHTML|innerHTML/);
  });
});

describe("richTextHref", () => {
  it("accepts http, https and bare mailto", () => {
    expect(richTextHref("https://example.test/a?b=1#c")).toEqual({
      href: "https://example.test/a?b=1#c",
      external: true,
    });
    expect(richTextHref("http://example.test")).toEqual({
      href: "http://example.test",
      external: true,
    });
    expect(richTextHref("MAILTO:hi@example.test")).toEqual({
      href: "MAILTO:hi@example.test",
      external: false,
    });
  });

  it("accepts commas in http(s) urls", () => {
    expect(richTextHref("https://example.test/a,b")).toEqual({
      href: "https://example.test/a,b",
      external: true,
    });
  });

  it("refuses non-strings", () => {
    for (const value of [undefined, null, 5, {}, ["https://example.test"]]) {
      expect(richTextHref(value)).toBeNull();
    }
  });
});
