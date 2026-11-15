/**
 * Metafields and metaobjects: the type engine (spec 2026-10-05
 * metafields-metaobjects §5). Plain TypeScript with no imports and no I/O, so
 * it runs unchanged in the API, the dashboard and storefronts.
 *
 * ecomweb-api (src/modules/metafields/domain/metafield-engine.ts) and
 * ecomweb-dashboard (lib/metafields/engine.ts) keep VERBATIM copies of
 * everything below the marker line. To change the engine: edit it here, update
 * ENGINE_BODY_SHA256 in metafield-engine.body-hash.spec.ts, then re-copy the
 * body into both repos with the new hash in their headers.
 */
// The body below is a verbatim, hash-checked copy, so lint exceptions live here:
// UNSAFE_URL_CHARS matches control characters on purpose, to reject them in URLs.
/* eslint-disable no-control-regex */
// @engine-body

// ─── Vocabulary ─────────────────────────────────────────────────

export const METAFIELD_OWNER_TYPES = [
  "product",
  "variant",
  "collection",
  "customer",
  "order",
  "page",
  "blog_post",
  "location",
  "shop",
] as const;
export type MetafieldOwnerType = (typeof METAFIELD_OWNER_TYPES)[number];

export const METAFIELD_BASE_TYPES = [
  "single_line_text",
  "multi_line_text",
  "rich_text",
  "email",
  "integer",
  "decimal",
  "date",
  "date_time",
  "url",
  "link",
  "weight",
  "volume",
  "dimension",
  "boolean",
  "color",
  "rating",
  "money",
  "language",
  "json",
  "file",
  "image",
  "video",
  "product",
  "variant",
  "collection",
  "page",
  "blog_post",
  "customer",
  "order",
  "metaobject_reference",
  "mixed_reference",
] as const;
export type MetafieldBaseType = (typeof METAFIELD_BASE_TYPES)[number];
export type MetafieldListType = `list.${MetafieldBaseType}`;
export type MetafieldType = MetafieldBaseType | MetafieldListType;

const BASE_TYPE_SET: ReadonlySet<string> = new Set(METAFIELD_BASE_TYPES);

export function isMetafieldType(value: unknown): value is MetafieldType {
  if (typeof value !== "string") return false;
  const base = value.startsWith("list.") ? value.slice(5) : value;
  return BASE_TYPE_SET.has(base);
}

export function isListType(type: MetafieldType): type is MetafieldListType {
  return type.startsWith("list.");
}

export function baseTypeOf(type: MetafieldType): MetafieldBaseType {
  return (isListType(type) ? type.slice(5) : type) as MetafieldBaseType;
}

export type MetafieldTypeGroup =
  | "text"
  | "media"
  | "reference"
  | "link"
  | "date_time"
  | "number"
  | "measurement"
  | "other"
  | "advanced";

/** Type picker groups in display order (spec §7.2). Labels are the consumer's. */
export const METAFIELD_TYPE_GROUPS: readonly {
  readonly group: MetafieldTypeGroup;
  readonly types: readonly MetafieldBaseType[];
}[] = [
  {
    group: "text",
    types: ["single_line_text", "multi_line_text", "rich_text", "email"],
  },
  { group: "media", types: ["file", "image", "video"] },
  {
    group: "reference",
    types: [
      "blog_post",
      "collection",
      "customer",
      "metaobject_reference",
      "order",
      "page",
      "product",
      "variant",
    ],
  },
  { group: "link", types: ["link", "url"] },
  { group: "date_time", types: ["date", "date_time"] },
  { group: "number", types: ["integer", "decimal", "rating", "money"] },
  { group: "measurement", types: ["weight", "volume", "dimension"] },
  { group: "other", types: ["boolean", "color", "language"] },
  { group: "advanced", types: ["json", "mixed_reference"] },
];

export const RESOURCE_REFERENCE_TYPES = [
  "product",
  "variant",
  "collection",
  "page",
  "blog_post",
  "customer",
  "order",
] as const;
export const METAOBJECT_REFERENCE_TYPES = [
  "metaobject_reference",
  "mixed_reference",
] as const;
export const MEDIA_TYPES = ["file", "image", "video"] as const;
/** Never resolved outside the admin (spec §6.5). */
export const PRIVATE_REFERENCE_TYPES = ["customer", "order"] as const;

export const METAFIELD_LIMITS = {
  definitions_per_owner_type: 100,
  pinned_per_owner_type: 20,
  metaobject_definitions: 100,
  fields_per_metaobject: 40,
  filter_keys: 5,
  value_bytes: 65_536,
  list_items: 128,
  choices: 128,
  allowed_domains: 20,
  regex_length: 200,
  regex_value_length: 500,
  single_line_text_length: 5_000,
  multi_line_text_length: 65_000,
  link_text_length: 255,
  email_length: 254,
  name_length: 255,
  description_length: 5_000,
  mixed_reference_definitions_min: 2,
  mixed_reference_definitions_max: 10,
} as const;

// ─── Issues and results ─────────────────────────────────────────

export type MetafieldIssueCode =
  | "blank"
  | "required"
  | "unknown_key"
  | "duplicate"
  | "immutable"
  | "not_allowed"
  | "invalid_type"
  | "invalid_format"
  | "too_short"
  | "too_long"
  | "too_small"
  | "too_big"
  | "too_large"
  | "pattern_mismatch"
  | "not_a_choice"
  | "precision_exceeded"
  | "domain_not_allowed"
  | "invalid_unit"
  | "scale_mismatch"
  | "currency_mismatch"
  | "list_too_short"
  | "list_too_long"
  | "invalid_node"
  | "unsafe_url"
  | "invalid_validation"
  | "unsafe_regex";

/** `path` is relative to the validated input: "", "[2]", "[2].amount", "fields[0].type". */
export interface MetafieldIssue {
  path: string;
  code: MetafieldIssueCode;
  message: string;
}

/** `errors` and `value` are optional-undefined on the other arm so both read cleanly without strictNullChecks. */
export type EngineResult<T> =
  | { ok: true; value: T; errors?: undefined }
  | { ok: false; errors: MetafieldIssue[]; value?: undefined };

function issue(
  path: string,
  code: MetafieldIssueCode,
  message: string
): MetafieldIssue {
  return { path, code, message };
}

function ok<T>(value: T): EngineResult<T> {
  return { ok: true, value };
}

function fail<T = never>(
  path: string,
  code: MetafieldIssueCode,
  message: string
): EngineResult<T> {
  return { ok: false, errors: [issue(path, code, message)] };
}

function joinPath(base: string, segment: string | number): string {
  if (typeof segment === "number") return `${base}[${segment}]`;
  return base ? `${base}.${segment}` : segment;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOwn(object: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function unknownKeys(
  object: Record<string, unknown>,
  allowed: readonly string[],
  path: string
): MetafieldIssue[] {
  return Object.keys(object)
    .filter(key => !allowed.includes(key))
    .map(key => issue(joinPath(path, key), "unknown_key", `unknown key "${key}"`));
}

function codePoints(text: string): number {
  return [...text].length;
}

// ─── Value shapes and validations ───────────────────────────────

export type FileKind = "image" | "video" | "document";

export interface MeasurementValue {
  value: string;
  unit: string;
}

export interface LinkValue {
  url: string;
  text: string;
}

export interface RatingValue {
  value: string;
  scale_min: string;
  scale_max: string;
}

export interface MoneyValue {
  amount: string;
  currency_code: string;
}

/** integer: number; decimal: decimal string; date/date_time: canonical string; measurements: MeasurementValue. */
export type MetafieldBound = number | string | MeasurementValue;

/** Canonical validations, as validateValidations returns them (spec §5.2). */
export interface MetafieldValidations {
  min_length?: number;
  max_length?: number;
  regex?: string;
  choices?: string[];
  min?: MetafieldBound;
  max?: MetafieldBound;
  max_precision?: number;
  allowed_domains?: string[];
  scale_min?: string;
  scale_max?: string;
  file_types?: FileKind[];
  metaobject_definition_id?: string;
  metaobject_definition_ids?: string[];
  list_min?: number;
  list_max?: number;
}

/** Store facts a value check needs. The engine never looks anything up. */
export interface MetafieldContext {
  currency_code: string;
}

// ─── Keys, handles and identifiers ──────────────────────────────

export const METAFIELD_KEY_PATTERN = /^[a-z0-9_]{2,64}$/;
export const METAOBJECT_TYPE_PATTERN = /^[a-z0-9_-]{2,64}$/;
export const ENTRY_HANDLE_PATTERN = /^[a-z0-9-]{1,255}$/;

/** Strips accents; NFD does not decompose đ, so it is mapped by hand. */
function asciiFold(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\u0111/g, "d")
    .replace(/\u0110/g, "D");
}

function slugify(text: string, separator: string, max: number): string {
  const edge = new RegExp(`^${separator}+|${separator}+$`, "g");
  return asciiFold(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, separator)
    .replace(edge, "")
    .slice(0, max)
    .replace(edge, "");
}

/** "Đánh giá khách hàng" → "danh_gia_khach_hang". "" when nothing usable remains. */
export function toMetafieldKey(text: string): string {
  return slugify(text, "_", 64);
}

/** "Lan Anh – Hà Nội" → "lan-anh-ha-noi". "" when nothing usable remains. */
export function toEntryHandle(text: string): string {
  const handle = slugify(text, "-", 255);
  return RESERVED_KEYS.includes(handle) ? "" : handle;
}

/** True for a well-formed entry handle that is not a reserved name. */
export function isValidEntryHandle(handle: string): boolean {
  return ENTRY_HANDLE_PATTERN.test(handle) && !RESERVED_KEYS.includes(handle);
}

export function metafieldIdentifier(namespace: string, key: string): string {
  return `${namespace}.${key}`;
}

/** Names that collide with Object.prototype members; never valid as a key. */
const RESERVED_KEYS: readonly string[] = ["__proto__", "constructor", "prototype"];

export function parseMetafieldIdentifier(
  identifier: string
): { namespace: string; key: string } | null {
  const parts = identifier.split(".");
  if (parts.length !== 2) return null;
  const [namespace, key] = parts;
  if (!METAFIELD_KEY_PATTERN.test(namespace) || !METAFIELD_KEY_PATTERN.test(key)) {
    return null;
  }
  if (RESERVED_KEYS.includes(namespace) || RESERVED_KEYS.includes(key)) return null;
  return { namespace, key };
}

// ─── Values: scalars ────────────────────────────────────────────

type Checker = (
  value: unknown,
  validations: MetafieldValidations,
  ctx: MetafieldContext,
  path: string
) => EngineResult<unknown>;

function matchesPattern(pattern: string, text: string): boolean {
  try {
    return new RegExp("^(?:" + pattern + ")$", "u").test(text);
  } catch {
    return false;
  }
}

function textChecker(limit: number, singleLine: boolean): Checker {
  return (value, v, _ctx, path) => {
    if (typeof value !== "string") return fail(path, "invalid_type", "must be text");
    if (singleLine && /[\r\n]/.test(value)) {
      return fail(path, "invalid_format", "must be a single line");
    }
    const length = codePoints(value);
    const cap = v.regex !== undefined ? Math.min(limit, METAFIELD_LIMITS.regex_value_length) : limit;
    const max = Math.min(cap, v.max_length ?? cap);
    if (length > max) return fail(path, "too_long", `must be at most ${max} characters`);
    if (v.min_length !== undefined && length < v.min_length) {
      return fail(path, "too_short", `must be at least ${v.min_length} characters`);
    }
    if (v.regex !== undefined && !matchesPattern(v.regex, value)) {
      return fail(path, "pattern_mismatch", "does not match the required pattern");
    }
    if (v.choices !== undefined && !v.choices.includes(value)) {
      return fail(path, "not_a_choice", `must be one of: ${v.choices.join(", ")}`);
    }
    return ok(value);
  };
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const checkEmail: Checker = (value, _v, _ctx, path) => {
  if (typeof value !== "string") return fail(path, "invalid_type", "must be text");
  const email = value.trim().toLowerCase();
  if (email.length > METAFIELD_LIMITS.email_length || !EMAIL.test(email)) {
    return fail(path, "invalid_format", "must be an email address");
  }
  return ok(email);
};

const checkInteger: Checker = (value, v, _ctx, path) => {
  if (typeof value !== "number" || !Number.isSafeInteger(value)) {
    return fail(path, "invalid_type", "must be a whole number");
  }
  if (typeof v.min === "number" && value < v.min) {
    return fail(path, "too_small", `must be at least ${v.min}`);
  }
  if (typeof v.max === "number" && value > v.max) {
    return fail(path, "too_big", `must be at most ${v.max}`);
  }
  return ok(value === 0 ? 0 : value);
};

const DECIMAL_INPUT = /^[+-]?\d+(\.\d+)?$/;

/**
 * A canonical decimal string ("7.5", "-0.25", "0"), or null when the input is not a plain decimal.
 * Numbers JS prints in exponent form (1e-7, 1e21) are rejected; send them as decimal strings.
 */
export function normalizeDecimal(input: unknown): string | null {
  let text: string;
  if (typeof input === "number") {
    if (!Number.isFinite(input)) return null;
    text = String(input);
  } else if (typeof input === "string") {
    text = input.trim();
  } else {
    return null;
  }
  if (text.length > 40 || !DECIMAL_INPUT.test(text)) return null;
  const negative = text.startsWith("-");
  if (text[0] === "-" || text[0] === "+") text = text.slice(1);
  const [whole, fraction = ""] = text.split(".");
  const integer = whole.replace(/^0+(?=\d)/, "");
  const decimals = fraction.replace(/0+$/, "");
  const magnitude = decimals ? `${integer}.${decimals}` : integer;
  return magnitude === "0" ? "0" : `${negative ? "-" : ""}${magnitude}`;
}

/** Compares two canonical decimal strings exactly. */
export function compareDecimal(a: string, b: string): -1 | 0 | 1 {
  const aNegative = a.startsWith("-");
  const bNegative = b.startsWith("-");
  if (aNegative !== bNegative) return aNegative ? -1 : 1;
  const sign = aNegative ? -1 : 1;
  const [aWhole, aFraction = ""] = (aNegative ? a.slice(1) : a).split(".");
  const [bWhole, bFraction = ""] = (bNegative ? b.slice(1) : b).split(".");
  let order: number;
  if (aWhole.length !== bWhole.length) {
    order = aWhole.length > bWhole.length ? 1 : -1;
  } else if (aWhole !== bWhole) {
    order = aWhole > bWhole ? 1 : -1;
  } else {
    const width = Math.max(aFraction.length, bFraction.length);
    const aPadded = aFraction.padEnd(width, "0");
    const bPadded = bFraction.padEnd(width, "0");
    order = aPadded === bPadded ? 0 : aPadded > bPadded ? 1 : -1;
  }
  // order * sign would give -0 for two equal negatives; return a clean 0.
  return order === 0 ? 0 : ((order * sign) as -1 | 1);
}

const checkDecimal: Checker = (value, v, _ctx, path) => {
  const decimal = normalizeDecimal(value);
  if (decimal === null) return fail(path, "invalid_type", "must be a decimal number");
  const fraction = decimal.split(".")[1] ?? "";
  if (v.max_precision !== undefined && fraction.length > v.max_precision) {
    return fail(path, "precision_exceeded", `must have at most ${v.max_precision} decimal places`);
  }
  if (typeof v.min === "string" && compareDecimal(decimal, v.min) < 0) {
    return fail(path, "too_small", `must be at least ${v.min}`);
  }
  if (typeof v.max === "string" && compareDecimal(decimal, v.max) > 0) {
    return fail(path, "too_big", `must be at most ${v.max}`);
  }
  return ok(decimal);
};

const checkBoolean: Checker = (value, _v, _ctx, path) =>
  typeof value === "boolean" ? ok(value) : fail(path, "invalid_type", "must be true or false");

const COLOR = /^#[0-9a-fA-F]{6}$/;

const checkColor: Checker = (value, _v, _ctx, path) =>
  typeof value === "string" && COLOR.test(value)
    ? ok(value.toLowerCase())
    : fail(path, "invalid_format", "must be a hex color such as #1a2b3c");

/** setUTCFullYear, unlike Date.UTC, does not map years 0–99 to 1900–1999. */
function isCalendarDate(year: number, month: number, day: number): boolean {
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** "YYYY-MM-DD" when the input is a real calendar date, else null. */
export function normalizeDate(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const match = DATE.exec(input);
  if (!match || !isCalendarDate(+match[1], +match[2], +match[3])) return null;
  return input;
}

const DATE_TIME =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?(Z|[+-](\d{2}):(\d{2}))$/;

/** "YYYY-MM-DDTHH:mm:ssZ" in UTC, or null. Milliseconds are dropped. */
export function normalizeDateTime(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const match = DATE_TIME.exec(input);
  if (!match || !isCalendarDate(+match[1], +match[2], +match[3])) return null;
  if (+match[4] > 23 || +match[5] > 59 || +(match[6] ?? "0") > 59) return null;
  if (match[8] !== undefined && (+match[8] > 23 || +match[9] > 59)) return null;
  const ms = Date.parse(input);
  if (Number.isNaN(ms)) return null;
  const iso = new Date(ms).toISOString();
  return /^\d{4}-/.test(iso) ? `${iso.slice(0, 19)}Z` : null;
}

function dateChecker(normalize: (input: unknown) => string | null, format: string): Checker {
  return (value, v, _ctx, path) => {
    const normalized = normalize(value);
    if (normalized === null) return fail(path, "invalid_format", `must be ${format}`);
    if (typeof v.min === "string" && normalized < v.min) {
      return fail(path, "too_small", `must be on or after ${v.min}`);
    }
    if (typeof v.max === "string" && normalized > v.max) {
      return fail(path, "too_big", `must be on or before ${v.max}`);
    }
    return ok(normalized);
  };
}

const MAX_URL_LENGTH = 2048;

/** Control characters and the quote, angle, backtick and backslash characters never belong in a stored URL. */
const UNSAFE_URL_CHARS = /[\u0000-\u001f\u007f-\u009f"<>`\\]/;

function parseHttpUrl(value: unknown): URL | null {
  if (
    typeof value !== "string" ||
    value.length > MAX_URL_LENGTH ||
    /\s/.test(value) ||
    UNSAFE_URL_CHARS.test(value)
  ) {
    return null;
  }
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

function hostAllowed(url: URL, domains: readonly string[] | undefined): boolean {
  if (!domains) return true;
  const host = url.hostname.toLowerCase();
  return domains.some(domain => host === domain || host.endsWith(`.${domain}`));
}

const checkUrl: Checker = (value, v, _ctx, path) => {
  const url = parseHttpUrl(value);
  if (!url) return fail(path, "invalid_format", "must be an http(s) URL");
  if (!hostAllowed(url, v.allowed_domains)) {
    return fail(path, "domain_not_allowed", `must be on ${(v.allowed_domains ?? []).join(", ")}`);
  }
  return ok(value as string);
};

const checkLink: Checker = (value, v, ctx, path) => {
  if (!isPlainObject(value)) {
    return fail(path, "invalid_type", "must be an object with url and text");
  }
  const extra = unknownKeys(value, ["url", "text"], path);
  if (extra.length) return { ok: false, errors: extra };
  const url = checkUrl(value.url, v, ctx, joinPath(path, "url"));
  if (!url.ok) return url;
  const text = value.text ?? "";
  if (typeof text !== "string") return fail(joinPath(path, "text"), "invalid_type", "must be text");
  if (codePoints(text) > METAFIELD_LIMITS.link_text_length) {
    return fail(
      joinPath(path, "text"),
      "too_long",
      `must be at most ${METAFIELD_LIMITS.link_text_length} characters`
    );
  }
  return ok({ url: url.value as string, text });
};

const LANGUAGE = /^([a-zA-Z]{2,3})(?:-([a-zA-Z]{4}))?(?:-([a-zA-Z]{2}|\d{3}))?$/;

const checkLanguage: Checker = (value, _v, _ctx, path) => {
  const match = typeof value === "string" ? LANGUAGE.exec(value) : null;
  if (!match) {
    return fail(path, "invalid_format", "must be a language tag such as vi or en-US");
  }
  const script = match[2]
    ? match[2][0].toUpperCase() + match[2].slice(1).toLowerCase()
    : undefined;
  return ok([match[1].toLowerCase(), script, match[3]?.toUpperCase()].filter(Boolean).join("-"));
};

const checkJson: Checker = (value, _v, _ctx, path) => {
  let text: string | undefined;
  let nonFinite = false;
  try {
    text = JSON.stringify(value, (_key, item) => {
      if (typeof item === "number" && !Number.isFinite(item)) nonFinite = true;
      return item;
    });
  } catch {
    text = undefined;
  }
  if (nonFinite) return fail(path, "invalid_format", "must not contain NaN or Infinity");
  return text === undefined ? fail(path, "invalid_type", "must be JSON") : ok(JSON.parse(text));
};

// ─── Values: rich text ──────────────────────────────────────────

export interface RichTextText {
  type: "text";
  value: string;
  bold?: boolean;
  italic?: boolean;
}

export interface RichTextLink {
  type: "link";
  url: string;
  title?: string;
  children: RichTextText[];
}

export type RichTextInline = RichTextText | RichTextLink;

export interface RichTextParagraph {
  type: "paragraph";
  children: RichTextInline[];
}

export interface RichTextHeading {
  type: "heading";
  level: 1 | 2 | 3 | 4 | 5 | 6;
  children: RichTextInline[];
}

export interface RichTextListItem {
  type: "list-item";
  children: RichTextInline[];
}

export interface RichTextList {
  type: "list";
  listType: "ordered" | "unordered";
  children: RichTextListItem[];
}

export type RichTextBlock = RichTextParagraph | RichTextHeading | RichTextList;

export interface RichTextRoot {
  type: "root";
  children: RichTextBlock[];
}

export type RichTextNode =
  | RichTextRoot
  | RichTextBlock
  | RichTextListItem
  | RichTextInline;

/** A malformed document reports its first 100 problems, not thousands. */
const MAX_RICH_ERRORS = 100;

const MAILTO = /^mailto:[^\s@?&#,]+@[^\s@?&#,]+$/i;

function richChildren<T>(
  children: unknown,
  path: string,
  errors: MetafieldIssue[],
  each: (child: unknown, path: string) => T | null
): T[] {
  if (!Array.isArray(children)) {
    errors.push(issue(path, "invalid_type", "must be a list of nodes"));
    return [];
  }
  const out: T[] = [];
  for (let index = 0; index < children.length; index++) {
    if (errors.length >= MAX_RICH_ERRORS) break;
    const node = each(children[index], joinPath(path, index));
    if (node) out.push(node);
  }
  return out;
}

function richText(node: Record<string, unknown>, path: string, errors: MetafieldIssue[]): RichTextText | null {
  errors.push(...unknownKeys(node, ["type", "value", "bold", "italic"], path));
  if (typeof node.value !== "string") {
    errors.push(issue(joinPath(path, "value"), "invalid_type", "must be text"));
    return null;
  }
  for (const mark of ["bold", "italic"] as const) {
    if (node[mark] !== undefined && typeof node[mark] !== "boolean") {
      errors.push(issue(joinPath(path, mark), "invalid_type", "must be true or false"));
    }
  }
  const out: RichTextText = { type: "text", value: node.value };
  if (node.bold === true) out.bold = true;
  if (node.italic === true) out.italic = true;
  return out;
}

function richInline(
  node: unknown,
  path: string,
  errors: MetafieldIssue[]
): RichTextInline | null {
  if (!isPlainObject(node)) {
    errors.push(issue(path, "invalid_node", "must be a text or link node"));
    return null;
  }
  if (node.type === "text") return richText(node, path, errors);
  if (node.type === "link") {
    errors.push(...unknownKeys(node, ["type", "url", "title", "children"], path));
    const url = typeof node.url === "string" ? node.url : "";
    if (!parseHttpUrl(url) && !(url.length <= MAX_URL_LENGTH && MAILTO.test(url) && !UNSAFE_URL_CHARS.test(url))) {
      errors.push(issue(joinPath(path, "url"), "unsafe_url", "must be an http(s) or mailto link"));
    }
    if (node.title !== undefined && typeof node.title !== "string") {
      errors.push(issue(joinPath(path, "title"), "invalid_type", "must be text"));
    }
    const children = richChildren(node.children, joinPath(path, "children"), errors, (child, at) => {
      if (isPlainObject(child) && child.type === "text") return richText(child, at, errors);
      errors.push(issue(joinPath(at, "type"), "invalid_node", "a link may only contain text"));
      return null;
    });
    const out: RichTextLink = { type: "link", url, children };
    if (typeof node.title === "string") out.title = node.title;
    return out;
  }
  errors.push(
    issue(joinPath(path, "type"), "invalid_node", `unexpected node type ${JSON.stringify(String(node.type).slice(0, 40))}`)
  );
  return null;
}

function richBlock(node: unknown, path: string, errors: MetafieldIssue[]): RichTextBlock | null {
  if (!isPlainObject(node)) {
    errors.push(issue(path, "invalid_node", "must be a paragraph, heading or list node"));
    return null;
  }
  const inline = (child: unknown, at: string) => richInline(child, at, errors);
  const children = (at: string, from: unknown) => richChildren(from, joinPath(at, "children"), errors, inline);
  switch (node.type) {
    case "paragraph":
      errors.push(...unknownKeys(node, ["type", "children"], path));
      return { type: "paragraph", children: children(path, node.children) };
    case "heading": {
      errors.push(...unknownKeys(node, ["type", "level", "children"], path));
      const level = node.level;
      if (typeof level !== "number" || !Number.isInteger(level) || level < 1 || level > 6) {
        errors.push(issue(joinPath(path, "level"), "invalid_format", "must be 1 to 6"));
      }
      return { type: "heading", level: level as RichTextHeading["level"], children: children(path, node.children) };
    }
    case "list": {
      errors.push(...unknownKeys(node, ["type", "listType", "children"], path));
      if (node.listType !== "ordered" && node.listType !== "unordered") {
        errors.push(issue(joinPath(path, "listType"), "invalid_format", "must be ordered or unordered"));
      }
      const items = richChildren(node.children, joinPath(path, "children"), errors, (child, at) => {
        if (!isPlainObject(child) || child.type !== "list-item") {
          errors.push(issue(at, "invalid_node", "must be a list-item node"));
          return null;
        }
        errors.push(...unknownKeys(child, ["type", "children"], at));
        return { type: "list-item" as const, children: children(at, child.children) };
      });
      return { type: "list", listType: node.listType as RichTextList["listType"], children: items };
    }
    default:
      errors.push(
        issue(joinPath(path, "type"), "invalid_node", `unexpected node type ${JSON.stringify(String(node.type).slice(0, 40))}`)
      );
      return null;
  }
}

const MAX_RICH_TOP_NODES = 2000;

/** Validates a rich-text tree (spec §5.3). There is no HTML anywhere in it. */
export function validateRichText(input: unknown, path = ""): EngineResult<RichTextRoot> {
  if (!isPlainObject(input) || input.type !== "root") {
    return fail(path, "invalid_node", "must be a rich-text root node");
  }
  if (Array.isArray(input.children) && input.children.length > MAX_RICH_TOP_NODES) {
    return fail(path, "too_large", "has too many nodes");
  }
  const errors = unknownKeys(input, ["type", "children"], path);
  const children = richChildren(input.children, joinPath(path, "children"), errors, (child, at) =>
    richBlock(child, at, errors)
  );
  return errors.length
    ? { ok: false, errors: errors.slice(0, MAX_RICH_ERRORS) }
    : ok({ type: "root", children });
}

/** Characters of text in the tree, links and list items included. */
export function richTextLength(root: RichTextRoot): number {
  let count = 0;
  const visit = (node: RichTextInline) => {
    if (node.type === "text") count += codePoints(node.value);
    else node.children.forEach(visit);
  };
  for (const block of root.children) {
    if (block.type === "list") block.children.forEach(item => item.children.forEach(visit));
    else block.children.forEach(visit);
  }
  return count;
}

const checkRichText: Checker = (value, v, _ctx, path) => {
  const tree = validateRichText(value, path);
  if (!tree.ok) return tree;
  if (v.max_length !== undefined && richTextLength(tree.value) > v.max_length) {
    return fail(path, "too_long", `must be at most ${v.max_length} characters`);
  }
  return tree;
};

// ─── Values: measurements, money, media, references ─────────────

/** Conversion factors to the first unit of each type (g, ml, mm). */
export const MEASUREMENT_UNITS = {
  weight: { g: 1, kg: 1000, oz: 28.349523125, lb: 453.59237 },
  volume: {
    ml: 1,
    cl: 10,
    l: 1000,
    m3: 1_000_000,
    fl_oz: 29.5735295625,
    pt: 473.176473,
    qt: 946.352946,
    gal: 3785.411784,
  },
  dimension: { mm: 1, cm: 10, m: 1000, in: 25.4, ft: 304.8, yd: 914.4 },
} as const;
export type MeasurementType = keyof typeof MEASUREMENT_UNITS;

/** The value in g, ml or mm, or null for an unknown unit. For bounds only: it uses floats. */
export function measurementInBaseUnit(
  measurement: MeasurementValue,
  type: MeasurementType
): number | null {
  const units = MEASUREMENT_UNITS[type] as Record<string, number>;
  return hasOwn(units, measurement.unit) ? Number(measurement.value) * units[measurement.unit] : null;
}

function measurementChecker(type: MeasurementType): Checker {
  const unitList = Object.keys(MEASUREMENT_UNITS[type]).join(", ");
  return (value, v, _ctx, path) => {
    if (!isPlainObject(value)) return fail(path, "invalid_type", "must be an object with value and unit");
    const extra = unknownKeys(value, ["value", "unit"], path);
    if (extra.length) return { ok: false, errors: extra };
    const amount = normalizeDecimal(value.value);
    if (amount === null) return fail(joinPath(path, "value"), "invalid_type", "must be a decimal number");
    if (typeof value.unit !== "string" || !hasOwn(MEASUREMENT_UNITS[type], value.unit)) {
      return fail(joinPath(path, "unit"), "invalid_unit", `must be one of: ${unitList}`);
    }
    const measurement = { value: amount, unit: value.unit };
    const base = measurementInBaseUnit(measurement, type) as number;
    if (typeof v.min === "object" && v.min !== null) {
      const min = measurementInBaseUnit(v.min, type);
      if (min !== null && base < min) {
        return fail(path, "too_small", `must be at least ${v.min.value} ${v.min.unit}`);
      }
    }
    if (typeof v.max === "object" && v.max !== null) {
      const max = measurementInBaseUnit(v.max, type);
      if (max !== null && base > max) {
        return fail(path, "too_big", `must be at most ${v.max.value} ${v.max.unit}`);
      }
    }
    return ok(measurement);
  };
}

const checkRating: Checker = (value, v, _ctx, path) => {
  if (!isPlainObject(value)) {
    return fail(path, "invalid_type", "must be an object with value, scale_min and scale_max");
  }
  const extra = unknownKeys(value, ["value", "scale_min", "scale_max"], path);
  if (extra.length) return { ok: false, errors: extra };
  const parts: Record<"value" | "scale_min" | "scale_max", string> = { value: "", scale_min: "", scale_max: "" };
  for (const key of ["value", "scale_min", "scale_max"] as const) {
    const decimal = normalizeDecimal(value[key]);
    if (decimal === null) return fail(joinPath(path, key), "invalid_type", "must be a decimal number");
    parts[key] = decimal;
  }
  if (
    (v.scale_min !== undefined && compareDecimal(parts.scale_min, v.scale_min) !== 0) ||
    (v.scale_max !== undefined && compareDecimal(parts.scale_max, v.scale_max) !== 0)
  ) {
    return fail(path, "scale_mismatch", `must use the scale ${v.scale_min} to ${v.scale_max}`);
  }
  if (compareDecimal(parts.value, parts.scale_min) < 0) {
    return fail(joinPath(path, "value"), "too_small", `must be at least ${parts.scale_min}`);
  }
  if (compareDecimal(parts.value, parts.scale_max) > 0) {
    return fail(joinPath(path, "value"), "too_big", `must be at most ${parts.scale_max}`);
  }
  return ok(parts);
};

const checkMoney: Checker = (value, _v, ctx, path) => {
  if (!isPlainObject(value)) return fail(path, "invalid_type", "must be an object with amount and currency_code");
  const extra = unknownKeys(value, ["amount", "currency_code"], path);
  if (extra.length) return { ok: false, errors: extra };
  const amount = normalizeDecimal(value.amount);
  if (amount === null) return fail(joinPath(path, "amount"), "invalid_type", "must be a decimal number");
  const currency = typeof value.currency_code === "string" ? value.currency_code.toUpperCase() : "";
  const expected = ctx.currency_code.toUpperCase();
  if (currency !== expected) {
    return fail(joinPath(path, "currency_code"), "currency_mismatch", `must be ${expected}`);
  }
  return ok({ amount, currency_code: currency });
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const checkAsset: Checker = (value, _v, _ctx, path) =>
  typeof value === "string" && UUID.test(value)
    ? ok(value.toLowerCase())
    : fail(path, "invalid_format", "must be an asset id");

/** File kinds a media value may point at; null means any kind (or not a media type). */
export function allowedFileKinds(
  type: MetafieldType,
  validations: MetafieldValidations
): readonly FileKind[] | null {
  switch (baseTypeOf(type)) {
    case "image":
      return ["image"];
    case "video":
      return ["video"];
    case "file":
      return validations.file_types ?? null;
    default:
      return null;
  }
}

const ID = /^[1-9]\d{0,18}$/;
const MAX_BIGINT = "9223372036854775807";

/** A positive bigint id as a string, or null. */
export function normalizeId(input: unknown): string | null {
  if (typeof input === "number") {
    return Number.isSafeInteger(input) && input > 0 ? String(input) : null;
  }
  if (typeof input !== "string" || !ID.test(input)) return null;
  if (input.length === MAX_BIGINT.length && input > MAX_BIGINT) return null;
  return input;
}

const checkId: Checker = (value, _v, _ctx, path) => {
  const id = normalizeId(value);
  return id === null ? fail(path, "invalid_format", "must be a record id") : ok(id);
};

// ─── Values: dispatch ───────────────────────────────────────────
// Keep this section last: CHECKERS reads the checker constants above it.

const CHECKERS: Record<MetafieldBaseType, Checker> = {
  single_line_text: textChecker(METAFIELD_LIMITS.single_line_text_length, true),
  multi_line_text: textChecker(METAFIELD_LIMITS.multi_line_text_length, false),
  rich_text: checkRichText,
  email: checkEmail,
  integer: checkInteger,
  decimal: checkDecimal,
  date: dateChecker(normalizeDate, "a date (YYYY-MM-DD)"),
  date_time: dateChecker(normalizeDateTime, "a date and time (YYYY-MM-DDTHH:mm:ssZ)"),
  url: checkUrl,
  link: checkLink,
  weight: measurementChecker("weight"),
  volume: measurementChecker("volume"),
  dimension: measurementChecker("dimension"),
  boolean: checkBoolean,
  color: checkColor,
  rating: checkRating,
  money: checkMoney,
  language: checkLanguage,
  json: checkJson,
  file: checkAsset,
  image: checkAsset,
  video: checkAsset,
  product: checkId,
  variant: checkId,
  collection: checkId,
  page: checkId,
  blog_post: checkId,
  customer: checkId,
  order: checkId,
  metaobject_reference: checkId,
  mixed_reference: checkId,
};

/**
 * Values a caller without a type should treat as "clear this field": null,
 * undefined, "" and []. Use isBlankValueFor when the field's type is known.
 */
export function isBlankValue(value: unknown): boolean {
  return (
    value === null ||
    value === undefined ||
    value === "" ||
    (Array.isArray(value) && value.length === 0)
  );
}

const TEXT_BASE_TYPES: readonly MetafieldBaseType[] = ["single_line_text", "multi_line_text", "email", "url"];

/** One value (a list item, for list types) of the given base type. */
function isBlankScalar(base: MetafieldBaseType, value: unknown): boolean {
  if (isBlankValue(value)) return true;
  if (typeof value === "string") return TEXT_BASE_TYPES.includes(base) && value.trim() === "";
  return (
    base === "rich_text" &&
    isPlainObject(value) &&
    value.type === "root" &&
    Array.isArray(value.children) &&
    value.children.length === 0
  );
}

/**
 * Type-aware blank check: whitespace-only text is blank for text types, an
 * empty root is blank for rich_text, and neither is blank for json.
 */
export function isBlankValueFor(type: MetafieldType, value: unknown): boolean {
  if (!isMetafieldType(type)) return isBlankValue(value);
  if (isListType(type)) return isBlankValue(value);
  return isBlankScalar(baseTypeOf(type), value);
}

function checkList(
  base: MetafieldBaseType,
  checker: Checker,
  value: unknown,
  v: MetafieldValidations,
  ctx: MetafieldContext,
  path: string
): EngineResult<unknown[]> {
  if (!Array.isArray(value)) return fail(path, "invalid_type", "must be a list");
  const max = Math.min(METAFIELD_LIMITS.list_items, v.list_max ?? METAFIELD_LIMITS.list_items);
  if (value.length > max) return fail(path, "list_too_long", `must have at most ${max} items`);
  if (v.list_min !== undefined && value.length < v.list_min) {
    return fail(path, "list_too_short", `must have at least ${v.list_min} items`);
  }
  const items: unknown[] = [];
  const errors: MetafieldIssue[] = [];
  for (let index = 0; index < value.length; index++) {
    const item: unknown = value[index];
    const at = joinPath(path, index);
    const result = isBlankScalar(base, item) ? fail(at, "blank", "is empty") : checker(item, v, ctx, at);
    if (result.ok) items.push(result.value);
    else errors.push(...result.errors);
  }
  return errors.length ? { ok: false, errors } : ok(items);
}

/** Postgres jsonb rejects NUL and lone surrogates; JSON.stringify escapes both as \\uXXXX. */
function isStorableJson(json: string): boolean {
  for (const match of json.matchAll(/\\(?:u([0-9a-f]{4})|[^u])/g)) {
    const code = match[1] === undefined ? -1 : parseInt(match[1], 16);
    if (code === 0 || (code >= 0xd800 && code <= 0xdfff)) return false;
  }
  return true;
}

function byteLength(text: string): number {
  return new TextEncoder().encode(text).length;
}

/**
 * Validates one value against its type and its definition's (already
 * validated) validations, returning the canonical value. Blank values fail
 * with "blank": callers decide whether blank means "delete" or "required".
 */
export function validateMetafieldValue(
  type: MetafieldType,
  validations: MetafieldValidations,
  value: unknown,
  ctx: MetafieldContext,
  path = ""
): EngineResult<unknown> {
  if (!isMetafieldType(type)) return fail(path, "invalid_type", "is not a metafield type");
  if (!isPlainObject(validations)) validations = {};
  if (isBlankValueFor(type, value)) return fail(path, "blank", "is empty; send null to clear it");
  if (isListType(type) && Array.isArray(value) && value.length > 4 * METAFIELD_LIMITS.list_items) {
    return fail(path, "list_too_long", `must have at most ${METAFIELD_LIMITS.list_items} items`);
  }
  const base = baseTypeOf(type);
  const checker = hasOwn(CHECKERS, base) ? CHECKERS[base] : undefined;
  if (!checker) return fail(path, "invalid_type", `type ${String(type).slice(0, 40)} is not supported`);
  const result = isListType(type)
    ? checkList(base, checker, value, validations, ctx, path)
    : checker(value, validations, ctx, path);
  if (!result.ok) return result;
  const json = JSON.stringify(result.value);
  if (!isStorableJson(json)) {
    return fail(path, "invalid_format", "contains characters that cannot be stored");
  }
  if (byteLength(json) > METAFIELD_LIMITS.value_bytes) {
    return fail(path, "too_large", `must be at most ${METAFIELD_LIMITS.value_bytes} bytes`);
  }
  return result;
}

// ─── Definitions: validations ───────────────────────────────────

export type MetafieldValidationKey = keyof MetafieldValidations;

export const VALIDATION_KEYS: Readonly<Record<MetafieldBaseType, readonly MetafieldValidationKey[]>> = {
  single_line_text: ["min_length", "max_length", "regex", "choices"],
  multi_line_text: ["min_length", "max_length"],
  rich_text: ["max_length"],
  email: [],
  integer: ["min", "max"],
  decimal: ["min", "max", "max_precision"],
  date: ["min", "max"],
  date_time: ["min", "max"],
  url: ["allowed_domains"],
  link: ["allowed_domains"],
  weight: ["min", "max"],
  volume: ["min", "max"],
  dimension: ["min", "max"],
  boolean: [],
  color: [],
  rating: ["scale_min", "scale_max"],
  money: [],
  language: [],
  json: [],
  file: ["file_types"],
  image: [],
  video: [],
  product: [],
  variant: [],
  collection: [],
  page: [],
  blog_post: [],
  customer: [],
  order: [],
  metaobject_reference: ["metaobject_definition_id"],
  mixed_reference: ["metaobject_definition_ids"],
};

/**
 * Restricts merchant regexes to a dialect whose work is bounded: no
 * backreferences or lookaround, nothing but "?" after a group, at most two
 * quantifiers (*, +, ?, {n,}, {n,m}; a lazy "?" is part of its quantifier,
 * exact {n} is free) and at most four alternatives. Deliberately conservative.
 */
export function isSafeRegex(pattern: string): boolean {
  if (/\\[1-9]|\\k</.test(pattern)) return false;
  if (/\(\?<?[=!]/.test(pattern)) return false;
  let quantifiers = 0;
  let bars = 0;
  let afterQuantifier = false;
  for (let i = 0; i < pattern.length; i++) {
    const char = pattern[i];
    const wasQuantifier = afterQuantifier;
    afterQuantifier = false;
    if (char === "\\") {
      const escaped = pattern[i + 1];
      i++;
      if ((escaped === "u" || escaped === "p" || escaped === "P") && pattern[i + 1] === "{") {
        const close = pattern.indexOf("}", i + 1);
        i = close === -1 ? pattern.length : close;
      }
      continue;
    }
    if (char === "[") {
      i++;
      while (i < pattern.length && pattern[i] !== "]") {
        if (pattern[i] === "\\") i++;
        i++;
      }
      continue;
    }
    if (char === "(") {
      if (pattern[i + 1] === "?") i++;
      continue;
    }
    if (char === ")") {
      const next = pattern[i + 1];
      if (next === "*" || next === "+") return false;
      if (next === "{" && /^\{\d+(,\d*)?\}/.test(pattern.slice(i + 1))) return false;
      continue;
    }
    if (char === "|") {
      bars++;
    } else if (char === "*" || char === "+" || char === "?") {
      if (!(char === "?" && wasQuantifier)) {
        quantifiers++;
        afterQuantifier = true;
      }
    } else if (char === "{") {
      const match = /^\{\d+(,\d*)?\}/.exec(pattern.slice(i));
      if (match) {
        if (match[1] !== undefined) quantifiers++;
        afterQuantifier = true;
        i += match[0].length - 1;
      }
    }
  }
  return quantifiers <= 2 && bars <= 4;
}

const HOSTNAME = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;
const FILE_KINDS: readonly FileKind[] = ["image", "video", "document"];

function normalizeBound(base: MetafieldBaseType, input: unknown): MetafieldBound | null {
  switch (base) {
    case "integer":
      return typeof input === "number" && Number.isSafeInteger(input) ? input : null;
    case "decimal":
      return normalizeDecimal(input);
    case "date":
      return normalizeDate(input);
    case "date_time":
      return normalizeDateTime(input);
    case "weight":
    case "volume":
    case "dimension": {
      if (!isPlainObject(input) || Object.keys(input).some(k => k !== "value" && k !== "unit")) return null;
      const amount = normalizeDecimal(input.value);
      if (amount === null || typeof input.unit !== "string" || !hasOwn(MEASUREMENT_UNITS[base], input.unit)) {
        return null;
      }
      return { value: amount, unit: input.unit };
    }
    default:
      return null;
  }
}

function compareBound(base: MetafieldBaseType, a: MetafieldBound, b: MetafieldBound): number {
  if (typeof a === "number" && typeof b === "number") return a - b;
  if (typeof a === "object" && typeof b === "object") {
    const type = base as MeasurementType;
    return (measurementInBaseUnit(a, type) ?? 0) - (measurementInBaseUnit(b, type) ?? 0);
  }
  if (base === "decimal") return compareDecimal(a as string, b as string);
  return (a as string) < (b as string) ? -1 : (a as string) > (b as string) ? 1 : 0;
}

function isWholeNumber(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;
}

/**
 * Validates and canonicalises a definition's `validations` for its type
 * (spec §5.2). Unknown keys, unsafe regexes and contradictory bounds fail.
 */
export function validateValidations(
  type: MetafieldType,
  input: unknown,
  path = "validations"
): EngineResult<MetafieldValidations> {
  if (!isMetafieldType(type)) return fail(path, "invalid_type", "is not a metafield type");
  const raw = input === undefined || input === null ? {} : input;
  if (!isPlainObject(raw)) return fail(path, "invalid_type", "must be an object");
  const base = baseTypeOf(type);
  const allowed: MetafieldValidationKey[] = [
    ...VALIDATION_KEYS[base],
    ...(isListType(type) ? (["list_min", "list_max"] as const) : []),
  ];
  const errors = unknownKeys(raw, allowed, path);
  const out: MetafieldValidations = {};
  const has = (key: MetafieldValidationKey) => allowed.includes(key) && raw[key] !== undefined;
  const bad = (key: MetafieldValidationKey, message: string, code: MetafieldIssueCode = "invalid_validation") =>
    errors.push(issue(joinPath(path, key), code, message));

  for (const key of ["min_length", "max_length"] as const) {
    if (!has(key)) continue;
    const cap =
      base === "single_line_text" ? METAFIELD_LIMITS.single_line_text_length : METAFIELD_LIMITS.multi_line_text_length;
    if (isWholeNumber(raw[key], 0, cap)) out[key] = raw[key] as number;
    else bad(key, "must be a whole number of 0 or more");
  }

  if (has("regex")) {
    const pattern = raw.regex;
    if (typeof pattern !== "string" || pattern.length === 0 || pattern.length > METAFIELD_LIMITS.regex_length) {
      bad("regex", `must be 1 to ${METAFIELD_LIMITS.regex_length} characters`);
    } else if (!isSafeRegex(pattern)) {
      bad("regex", "is too complex: no backreferences or lookaround, no repetition after a group, at most 2 optional or repeated parts and 4 alternatives", "unsafe_regex");
    } else {
      try {
        new RegExp(pattern, "u");
        out.regex = pattern;
      } catch {
        bad("regex", "is not a valid pattern");
      }
    }
  }

  if (has("regex")) {
    const limit = METAFIELD_LIMITS.regex_value_length;
    if (out.max_length !== undefined && out.max_length > limit) {
      bad("max_length", `must be at most ${limit} when a pattern applies`);
    } else if (out.regex !== undefined && out.max_length === undefined) {
      out.max_length = limit;
    }
  }

  if (out.min_length !== undefined && out.max_length !== undefined && out.min_length > out.max_length) {
    bad("min_length", "must not exceed max_length");
  }

  if (has("choices")) {
    const choices = raw.choices;
    if (!Array.isArray(choices) || choices.length === 0 || choices.length > METAFIELD_LIMITS.choices) {
      bad("choices", `must list 1 to ${METAFIELD_LIMITS.choices} values`);
    } else if (
      choices.some(
        c =>
          typeof c !== "string" ||
          c === "" ||
          /[\r\n]/.test(c) ||
          codePoints(c) > METAFIELD_LIMITS.single_line_text_length
      )
    ) {
      bad("choices", "must be non-empty single-line text");
    } else if (new Set(choices).size !== choices.length) {
      bad("choices", "must not repeat a value");
    } else if (
      (choices as string[]).some(c => {
        // Length first, so the regex never runs on an oversized choice.
        const length = codePoints(c);
        if (length > METAFIELD_LIMITS.regex_value_length && out.regex !== undefined) return true;
        if (out.max_length !== undefined && length > out.max_length) return true;
        if (out.min_length !== undefined && length < out.min_length) return true;
        return out.regex !== undefined && !matchesPattern(out.regex, c);
      })
    ) {
      bad("choices", "includes a value the pattern or length rules reject");
    } else {
      out.choices = [...(choices as string[])];
    }
  }

  for (const key of ["min", "max"] as const) {
    if (!has(key)) continue;
    const bound = normalizeBound(base, raw[key]);
    if (bound === null) bad(key, `is not a valid ${base} bound`);
    else out[key] = bound;
  }
  if (out.min !== undefined && out.max !== undefined && compareBound(base, out.min, out.max) > 0) {
    bad("min", "must not exceed max");
  }

  if (has("max_precision")) {
    if (isWholeNumber(raw.max_precision, 0, 9)) out.max_precision = raw.max_precision as number;
    else bad("max_precision", "must be a whole number from 0 to 9");
  }

  if (has("allowed_domains")) {
    const domains = raw.allowed_domains;
    const lowered = Array.isArray(domains)
      ? domains.map(d => (typeof d === "string" ? d.toLowerCase() : ""))
      : [];
    if (
      !Array.isArray(domains) ||
      domains.length === 0 ||
      domains.length > METAFIELD_LIMITS.allowed_domains ||
      lowered.some(d => !HOSTNAME.test(d))
    ) {
      bad("allowed_domains", `must list 1 to ${METAFIELD_LIMITS.allowed_domains} domains such as youtube.com`);
    } else {
      out.allowed_domains = [...new Set(lowered)];
    }
  }

  if (base === "rating") {
    for (const key of ["scale_min", "scale_max"] as const) {
      if (raw[key] === undefined) {
        bad(key, "is required for a rating", "required");
        continue;
      }
      const decimal = normalizeDecimal(raw[key]);
      if (decimal === null) bad(key, "must be a decimal number");
      else out[key] = decimal;
    }
    if (out.scale_min !== undefined && out.scale_max !== undefined && compareDecimal(out.scale_min, out.scale_max) >= 0) {
      bad("scale_min", "must be below scale_max");
    }
  }

  if (has("file_types")) {
    const kinds = raw.file_types;
    if (
      !Array.isArray(kinds) ||
      kinds.length === 0 ||
      kinds.some(k => !FILE_KINDS.includes(k as FileKind)) ||
      new Set(kinds).size !== kinds.length
    ) {
      bad("file_types", "must list image, video and/or document");
    } else {
      out.file_types = [...(kinds as FileKind[])];
    }
  }

  if (base === "metaobject_reference") {
    const id = normalizeId(raw.metaobject_definition_id);
    if (raw.metaobject_definition_id === undefined) {
      bad("metaobject_definition_id", "is required", "required");
    } else if (id === null) {
      bad("metaobject_definition_id", "must be a metaobject definition id");
    } else {
      out.metaobject_definition_id = id;
    }
  }

  if (base === "mixed_reference") {
    const ids = Array.isArray(raw.metaobject_definition_ids)
      ? raw.metaobject_definition_ids.map(normalizeId)
      : null;
    if (raw.metaobject_definition_ids === undefined) {
      bad("metaobject_definition_ids", "is required", "required");
    } else if (
      !ids ||
      ids.length < METAFIELD_LIMITS.mixed_reference_definitions_min ||
      ids.length > METAFIELD_LIMITS.mixed_reference_definitions_max ||
      ids.some(id => id === null) ||
      new Set(ids).size !== ids.length
    ) {
      bad(
        "metaobject_definition_ids",
        `must list ${METAFIELD_LIMITS.mixed_reference_definitions_min} to ${METAFIELD_LIMITS.mixed_reference_definitions_max} different definition ids`
      );
    } else {
      out.metaobject_definition_ids = ids as string[];
    }
  }

  for (const key of ["list_min", "list_max"] as const) {
    if (!has(key)) continue;
    if (isWholeNumber(raw[key], 0, METAFIELD_LIMITS.list_items)) out[key] = raw[key] as number;
    else bad(key, `must be a whole number from 0 to ${METAFIELD_LIMITS.list_items}`);
  }
  if (out.list_min !== undefined && out.list_max !== undefined && out.list_min > out.list_max) {
    bad("list_min", "must not exceed list_max");
  }

  return errors.length ? { ok: false, errors } : ok(out);
}

// --- Definitions: metafields, metaobjects, entries ---

export type CustomerAccess = "none" | "read" | "read_write";

/** Customer, order and location data never reaches the public storefront (spec s.4.1). */
export function storefrontAccessAllowed(owner: MetafieldOwnerType): boolean {
  return owner !== "customer" && owner !== "order" && owner !== "location";
}

export function allowedCustomerAccess(owner: MetafieldOwnerType): readonly CustomerAccess[] {
  if (owner === "customer") return ["none", "read", "read_write"];
  if (owner === "order") return ["none", "read"];
  return ["none"];
}

export interface MetafieldDefinitionShape {
  owner_type: MetafieldOwnerType;
  namespace: string;
  key: string;
  name: string;
  description: string | null;
  type: MetafieldType;
  validations: MetafieldValidations;
  storefront_access: boolean;
  customer_access: CustomerAccess;
}

const METAFIELD_DEFINITION_KEYS = [
  "owner_type",
  "namespace",
  "key",
  "name",
  "description",
  "type",
  "validations",
  "storefront_access",
  "customer_access",
] as const;

function readName(value: unknown, path: string, errors: MetafieldIssue[]): string {
  const name = typeof value === "string" ? value.trim() : "";
  if (!name || codePoints(name) > METAFIELD_LIMITS.name_length) {
    errors.push(issue(path, "invalid_format", `must be 1 to ${METAFIELD_LIMITS.name_length} characters`));
  }
  return name;
}

function readDescription(value: unknown, path: string, errors: MetafieldIssue[]): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string" || codePoints(value) > METAFIELD_LIMITS.description_length) {
    errors.push(issue(path, "invalid_format", `must be text of at most ${METAFIELD_LIMITS.description_length} characters`));
    return null;
  }
  return value.trim() || null;
}

function readKey(value: unknown, path: string, errors: MetafieldIssue[], pattern = METAFIELD_KEY_PATTERN): string {
  if (typeof value !== "string" || !pattern.test(value)) {
    errors.push(issue(path, "invalid_format", "must be 2 to 64 lowercase letters, digits or underscores"));
    return "";
  }
  if (RESERVED_KEYS.includes(value)) {
    errors.push(issue(path, "invalid_format", "is a reserved name"));
    return "";
  }
  return value;
}

function readBoolean(value: unknown, fallback: boolean, path: string, errors: MetafieldIssue[]): boolean {
  if (value === undefined) return fallback;
  if (typeof value !== "boolean") {
    errors.push(issue(path, "invalid_type", "must be true or false"));
    return fallback;
  }
  return value;
}

function readTypeAndValidations(
  input: Record<string, unknown>,
  path: string,
  errors: MetafieldIssue[]
): { type: MetafieldType; validations: MetafieldValidations } | null {
  if (!isMetafieldType(input.type)) {
    errors.push(issue(joinPath(path, "type"), "invalid_format", "is not a metafield type"));
    return null;
  }
  const validations = validateValidations(input.type, input.validations, joinPath(path, "validations"));
  if (!validations.ok) {
    errors.push(...validations.errors);
    return null;
  }
  return { type: input.type, validations: validations.value };
}

/** Validates a full metafield definition; the API merges a PATCH into the stored row first. */
export function validateMetafieldDefinition(input: unknown): EngineResult<MetafieldDefinitionShape> {
  if (!isPlainObject(input)) return fail("", "invalid_type", "must be an object");
  const errors = unknownKeys(input, METAFIELD_DEFINITION_KEYS, "");
  const owner = input.owner_type as MetafieldOwnerType;
  if (!METAFIELD_OWNER_TYPES.includes(owner)) {
    errors.push(issue("owner_type", "invalid_format", `must be one of: ${METAFIELD_OWNER_TYPES.join(", ")}`));
  }
  const namespace = readKey(input.namespace ?? "custom", "namespace", errors);
  const key = readKey(input.key, "key", errors);
  const name = readName(input.name, "name", errors);
  const description = readDescription(input.description, "description", errors);
  const typed = readTypeAndValidations(input, "", errors);
  const storefront = readBoolean(input.storefront_access, false, "storefront_access", errors);
  if (storefront && METAFIELD_OWNER_TYPES.includes(owner) && !storefrontAccessAllowed(owner)) {
    errors.push(issue("storefront_access", "not_allowed", `is not available for ${owner} metafields`));
  }
  const customer = (input.customer_access ?? "none") as CustomerAccess;
  if (!allowedCustomerAccess(owner).includes(customer)) {
    errors.push(issue("customer_access", "not_allowed", `must be one of: ${allowedCustomerAccess(owner).join(", ")}`));
  }
  if (errors.length || !typed) return { ok: false, errors };
  const out: MetafieldDefinitionShape = {
    owner_type: owner,
    namespace,
    key,
    name,
    description,
    type: typed.type,
    validations: typed.validations,
    storefront_access: storefront,
    customer_access: customer,
  };
  return storable(out);
}

/** Definitions persist as jsonb too: refuse NUL and lone surrogates anywhere in them. */
function storable<T>(out: T): EngineResult<T> {
  if (!isStorableJson(JSON.stringify(out))) {
    return fail("", "invalid_format", "contains characters that cannot be stored");
  }
  return ok(out);
}

export interface MetaobjectFieldShape {
  key: string;
  name: string;
  description: string | null;
  type: MetafieldType;
  required: boolean;
  validations: MetafieldValidations;
}

/** Field types usable as filter keys (spec s.4.3). List types never are. */
export const FILTERABLE_TYPES: readonly MetafieldBaseType[] = ["single_line_text", "boolean", "integer", "date"];

export interface MetaobjectDefinitionShape {
  type: string;
  name: string;
  description: string | null;
  fields: MetaobjectFieldShape[];
  display_name_key: string | null;
  filter_keys: string[];
  has_status: boolean;
  storefront_access: boolean;
  customer_access: "none" | "read";
}

const METAOBJECT_DEFINITION_KEYS = [
  "type",
  "name",
  "description",
  "fields",
  "display_name_key",
  "filter_keys",
  "has_status",
  "storefront_access",
  "customer_access",
] as const;

const FIELD_KEYS = ["key", "name", "description", "type", "required", "validations"] as const;

function readField(input: unknown, path: string, errors: MetafieldIssue[]): MetaobjectFieldShape | null {
  if (!isPlainObject(input)) {
    errors.push(issue(path, "invalid_type", "must be an object"));
    return null;
  }
  errors.push(...unknownKeys(input, FIELD_KEYS, path));
  const key = readKey(input.key, joinPath(path, "key"), errors);
  const name = readName(input.name, joinPath(path, "name"), errors);
  const description = readDescription(input.description, joinPath(path, "description"), errors);
  const required = readBoolean(input.required, false, joinPath(path, "required"), errors);
  const typed = readTypeAndValidations(input, path, errors);
  return typed ? { key, name, description, type: typed.type, required, validations: typed.validations } : null;
}

/** Validates a full metaobject definition; the API merges a PATCH into the stored row first. */
export function validateMetaobjectDefinition(input: unknown): EngineResult<MetaobjectDefinitionShape> {
  if (!isPlainObject(input)) return fail("", "invalid_type", "must be an object");
  const errors = unknownKeys(input, METAOBJECT_DEFINITION_KEYS, "");
  const type = typeof input.type === "string" && METAOBJECT_TYPE_PATTERN.test(input.type) ? input.type : "";
  if (!type) {
    errors.push(issue("type", "invalid_format", "must be 2 to 64 lowercase letters, digits, underscores or hyphens"));
  } else if (RESERVED_KEYS.includes(type)) {
    errors.push(issue("type", "invalid_format", "is a reserved name"));
  }
  const name = readName(input.name, "name", errors);
  const description = readDescription(input.description, "description", errors);

  const fields: MetaobjectFieldShape[] = [];
  if (!Array.isArray(input.fields)) {
    errors.push(issue("fields", "invalid_type", "must be a list of fields"));
  } else if (input.fields.length === 0) {
    errors.push(issue("fields", "too_short", "must have at least 1 field"));
  } else if (input.fields.length > METAFIELD_LIMITS.fields_per_metaobject) {
    errors.push(issue("fields", "too_long", `must have at most ${METAFIELD_LIMITS.fields_per_metaobject} fields`));
  } else {
    const seen = new Set<string>();
    input.fields.forEach((raw, index) => {
      const path = joinPath("fields", index);
      const field = readField(raw, path, errors);
      if (!field) return;
      if (seen.has(field.key)) errors.push(issue(joinPath(path, "key"), "duplicate", `"${field.key}" is used twice`));
      seen.add(field.key);
      fields.push(field);
    });
  }
  const byKey = new Map(fields.map(field => [field.key, field]));
  const isSingleLine = (key: string) => byKey.get(key)?.type === "single_line_text";

  let displayNameKey: string | null;
  if (input.display_name_key === undefined) {
    displayNameKey = fields.find(field => field.type === "single_line_text")?.key ?? null;
  } else if (input.display_name_key === null) {
    displayNameKey = null;
  } else if (typeof input.display_name_key === "string" && isSingleLine(input.display_name_key)) {
    displayNameKey = input.display_name_key;
  } else {
    displayNameKey = null;
    errors.push(issue("display_name_key", "invalid_format", "must name a single line text field"));
  }

  const filterKeys: string[] = [];
  const rawFilters = input.filter_keys ?? [];
  if (!Array.isArray(rawFilters)) {
    errors.push(issue("filter_keys", "invalid_type", "must be a list of field keys"));
  } else if (rawFilters.length > METAFIELD_LIMITS.filter_keys) {
    errors.push(issue("filter_keys", "too_long", `must have at most ${METAFIELD_LIMITS.filter_keys} keys`));
  } else {
    rawFilters.forEach((key, index) => {
      const path = joinPath("filter_keys", index);
      const field = typeof key === "string" ? byKey.get(key) : undefined;
      if (!field) errors.push(issue(path, "invalid_format", "must name a field of this definition"));
      else if (!FILTERABLE_TYPES.includes(field.type as MetafieldBaseType)) {
        errors.push(issue(path, "not_allowed", "only single line text, true or false, integer and date fields can be filters"));
      } else if (filterKeys.includes(field.key)) errors.push(issue(path, "duplicate", `"${field.key}" is listed twice`));
      else filterKeys.push(field.key);
    });
  }

  const hasStatus = readBoolean(input.has_status, true, "has_status", errors);
  const storefront = readBoolean(input.storefront_access, false, "storefront_access", errors);
  const customer = input.customer_access ?? "none";
  if (customer !== "none" && customer !== "read") {
    errors.push(issue("customer_access", "not_allowed", "must be none or read"));
  }

  if (errors.length) return { ok: false, errors };
  return storable<MetaobjectDefinitionShape>({
    type,
    name,
    description,
    fields,
    display_name_key: displayNameKey,
    filter_keys: filterKeys,
    has_status: hasStatus,
    storefront_access: storefront,
    customer_access: customer as "none" | "read",
  });
}

/** Validates an entry's field values against its definition; blank optional fields are omitted. */
export function validateMetaobjectEntry(
  fields: readonly MetaobjectFieldShape[],
  input: unknown,
  ctx: MetafieldContext
): EngineResult<Record<string, unknown>> {
  if (!Array.isArray(fields)) return fail("", "invalid_type", "fields must be a list");
  if (!isPlainObject(input)) return fail("", "invalid_type", "must be an object of field values");
  const errors = unknownKeys(input, fields.map(field => field.key), "");
  const out: Record<string, unknown> = {};
  for (const field of fields) {
    const raw = hasOwn(input, field.key) ? input[field.key] : undefined;
    if (isBlankValueFor(field.type, raw)) {
      if (field.required) errors.push(issue(field.key, "required", "is required"));
      continue;
    }
    const result = validateMetafieldValue(field.type, field.validations, raw, ctx, field.key);
    if (result.ok) {
      Object.defineProperty(out, field.key, { value: result.value, enumerable: true, writable: true, configurable: true });
    }
    else errors.push(...result.errors);
  }
  if (!errors.length && byteLength(JSON.stringify(out)) > METAFIELD_LIMITS.value_bytes) {
    return fail("", "too_large", `must be at most ${METAFIELD_LIMITS.value_bytes} bytes`);
  }
  return errors.length ? { ok: false, errors } : ok(out);
}

/** The display-name field's text, else the handle (spec s.4.4). */
export function entryDisplayName(
  definition: Pick<MetaobjectDefinitionShape, "display_name_key">,
  fields: Record<string, unknown>,
  handle: string
): string {
  const value = definition.display_name_key ? fields[definition.display_name_key] : undefined;
  return typeof value === "string" && value.trim() ? [...value.trim()].slice(0, METAFIELD_LIMITS.name_length).join("") : handle;
}

/**
 * A field's type is fixed once saved (spec s.4.5). Reports removed keys so the
 * API can strip them from entries. Assumes `after` already passed
 * validateMetaobjectDefinition (unique keys).
 */
export function checkMetaobjectFieldChanges(
  before: readonly MetaobjectFieldShape[],
  after: readonly MetaobjectFieldShape[]
): EngineResult<{ removed: string[]; added: string[] }> {
  const prior = new Map(before.map(field => [field.key, field]));
  const errors = after.flatMap((field, index) => {
    const old = prior.get(field.key);
    return old && old.type !== field.type
      ? [issue(joinPath(joinPath("fields", index), "type"), "immutable", `cannot change the type of "${field.key}"`)]
      : [];
  });
  if (errors.length) return { ok: false, errors };
  const kept = new Set(after.map(field => field.key));
  return ok({
    removed: before.filter(field => !kept.has(field.key)).map(field => field.key),
    added: after.filter(field => !prior.has(field.key)).map(field => field.key),
  });
}
