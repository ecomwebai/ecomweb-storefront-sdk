import {
  createElement,
  Fragment,
  type ReactElement,
  type ReactNode,
} from "react";
import type { RichTextRoot } from "@ecomweb/sdk";

/**
 * The engine's link rule (spec 5.3), re-checked at render: the tree was
 * validated on write, but a row written before a validation fix, or edited
 * in the database, must still never become a script URL here. At least as
 * strict as the SDK engine. Commas are legal in http(s) URLs; only the
 * mailto pattern refuses them.
 */
const MAX_URL_LENGTH = 2048;
// eslint-disable-next-line no-control-regex -- matching control characters is the point: they are rejected in URLs
const UNSAFE_URL_CHARS = /[\u0000-\u001f\u007f-\u009f"<>`\\]|\s/;
const MAILTO = /^mailto:[^\s@?&#,]+@[^\s@?&#,]+$/i;

export interface RichTextHref {
  href: string;
  /** http(s) links; they get rel="noopener noreferrer". */
  external: boolean;
}

export function richTextHref(url: unknown): RichTextHref | null {
  if (
    typeof url !== "string" ||
    url.length === 0 ||
    url.length > MAX_URL_LENGTH ||
    UNSAFE_URL_CHARS.test(url)
  ) {
    return null;
  }
  if (MAILTO.test(url)) return { href: url, external: false };
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  return parsed.protocol === "http:" || parsed.protocol === "https:"
    ? { href: url, external: true }
    : null;
}

type Node = Record<string, unknown>;

const isNode = (value: unknown): value is Node =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const childrenOf = (node: Node): unknown[] =>
  Array.isArray(node.children) ? node.children : [];

const HEADINGS: Record<number, "h1" | "h2" | "h3" | "h4" | "h5" | "h6"> = {
  1: "h1",
  2: "h2",
  3: "h3",
  4: "h4",
  5: "h5",
  6: "h6",
};

/** Only the listed keys of a node are ever read; nothing is spread into props. */
function renderText(node: Node, key: number): ReactNode {
  if (typeof node.value !== "string") return null;
  let out: ReactNode = node.value;
  if (node.italic === true) out = <em>{out}</em>;
  if (node.bold === true) out = <strong>{out}</strong>;
  return <Fragment key={key}>{out}</Fragment>;
}

function renderInline(node: unknown, key: number): ReactNode {
  if (!isNode(node)) return null;
  if (node.type === "text") return renderText(node, key);
  if (node.type !== "link") return null;
  const text = childrenOf(node).map((child, index) =>
    isNode(child) && child.type === "text" ? renderText(child, index) : null
  );
  const link = richTextHref(node.url);
  if (!link) return <Fragment key={key}>{text}</Fragment>;
  const title =
    typeof node.title === "string" && node.title !== ""
      ? node.title
      : undefined;
  return (
    <a
      key={key}
      href={link.href}
      rel={link.external ? "noopener noreferrer" : undefined}
      title={title}
    >
      {text}
    </a>
  );
}

const inlines = (node: Node): ReactNode[] => childrenOf(node).map(renderInline);

function renderBlock(node: unknown, key: number): ReactNode {
  if (!isNode(node)) return null;
  switch (node.type) {
    case "paragraph":
      return <p key={key}>{inlines(node)}</p>;
    case "heading": {
      const level = node.level;
      const tag =
        typeof level === "number" &&
        Object.prototype.hasOwnProperty.call(HEADINGS, level)
          ? HEADINGS[level]
          : "p";
      return createElement(tag, { key }, inlines(node));
    }
    case "list": {
      const items = childrenOf(node).map((item, index) =>
        isNode(item) && item.type === "list-item" ? (
          <li key={index}>{inlines(item)}</li>
        ) : null
      );
      return node.listType === "ordered" ? (
        <ol key={key}>{items}</ol>
      ) : (
        <ul key={key}>{items}</ul>
      );
    }
    default:
      return null;
  }
}

export interface RichTextProps {
  /** A rich_text metafield value, e.g. `metafield<RichTextRoot>(product, "custom.care_guide")`. */
  value: RichTextRoot | null | undefined;
}

/**
 * Renders a rich-text metafield as React elements: headings, paragraphs,
 * lists, bold, italic and links. Unknown nodes are skipped. Text is always a
 * text child, so nothing a merchant or shopper typed is ever parsed as
 * markup. Returns bare elements with no wrapper; style them from the parent.
 */
export function RichText({ value }: RichTextProps): ReactElement | null {
  if (!isNode(value) || value.type !== "root") return null;
  return <>{childrenOf(value).map(renderBlock)}</>;
}
