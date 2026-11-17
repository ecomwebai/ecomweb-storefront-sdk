import { z } from "zod";

/**
 * Theme settings: a theme declares its own settings (spec: schema-driven
 * themes §5.2), merchants fill in values, and the storefront reads them.
 * The types below are the authoring shape; `themeSchemaSchema` checks the same
 * shape at runtime (schemas uploaded by deploys, published by CI).
 */

/** Hex only: theme colors are interpolated into a <style> tag. */
export const THEME_HEX_COLOR =
  /^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

const SETTING_ID = /^[a-z][a-z0-9_]*$/;

type Primitive = string | number | boolean;

export interface ThemeVisibleIf {
  readonly setting: string;
  readonly equals?: Primitive;
  readonly not_equals?: Primitive;
  readonly is_set?: boolean;
}

interface SettingBase<T extends string> {
  readonly type: T;
  readonly id: string;
  readonly label: string;
  readonly info?: string;
  readonly visible_if?: ThemeVisibleIf;
}

export type ThemeSetting =
  | (SettingBase<"text" | "textarea"> & {
      readonly default?: string;
      readonly placeholder?: string;
    })
  | (SettingBase<"richtext" | "url" | "color" | "menu"> & {
      readonly default?: string;
    })
  | SettingBase<
      | "image_picker"
      | "collection"
      | "page"
      | "blog_post"
      | "blog_category"
      | "blog_tag"
      | "product"
    >
  | (SettingBase<"checkbox"> & { readonly default?: boolean })
  | (SettingBase<"number"> & {
      readonly default?: number;
      readonly min?: number;
      readonly max?: number;
    })
  | (SettingBase<"range"> & {
      readonly min: number;
      readonly max: number;
      readonly step: number;
      readonly unit?: string;
      readonly default: number;
    })
  | (SettingBase<"select"> & {
      readonly options: readonly {
        readonly value: string;
        readonly label: string;
      }[];
      readonly default?: string;
    });

export type ThemeSettingType = ThemeSetting["type"];

export interface ThemeDisplayItem {
  readonly type: "header" | "paragraph";
  readonly content: string;
}

export type ThemeSchemaItem = ThemeSetting | ThemeDisplayItem;

export interface ThemeSchemaGroup {
  readonly name: string;
  readonly settings: readonly ThemeSchemaItem[];
}

export type ThemeSchema = readonly ThemeSchemaGroup[];

export type ThemeValue = string | number | boolean;
export type ThemeValues = Record<string, ThemeValue | null>;

export interface ThemeValueError {
  key: string;
  message: string;
}

type ValueOf<T extends ThemeSettingType> = T extends "checkbox"
  ? boolean
  : T extends "number" | "range"
    ? number
    : string;

type SettingsIn<S extends ThemeSchema> = Extract<
  S[number]["settings"][number],
  ThemeSetting
>;

/** The values a schema produces: settings with a default are never null. */
export type ThemeSettingsOf<S extends ThemeSchema> = {
  [K in SettingsIn<S> as K["id"]]: K extends { readonly default: unknown }
    ? ValueOf<K["type"]>
    : ValueOf<K["type"]> | null;
};

// ─── Runtime schema ─────────────────────────────────────────────

const primitive = z.union([z.string(), z.number(), z.boolean()]);

const visibleIfSchema = z
  .object({
    setting: z.string().regex(SETTING_ID),
    equals: primitive.optional(),
    not_equals: primitive.optional(),
    is_set: z.boolean().optional(),
  })
  .refine(
    v =>
      [v.equals, v.not_equals, v.is_set].filter(x => x !== undefined).length ===
      1,
    { message: "visible_if needs exactly one of equals, not_equals, is_set" }
  );

const base = {
  id: z.string().regex(SETTING_ID, "setting ids are snake_case"),
  label: z.string().min(1),
  info: z.string().optional(),
  visible_if: visibleIfSchema.optional(),
};

const itemSchema = z.discriminatedUnion("type", [
  z.object({
    ...base,
    type: z.literal("text"),
    default: z.string().optional(),
    placeholder: z.string().optional(),
  }),
  z.object({
    ...base,
    type: z.literal("textarea"),
    default: z.string().optional(),
    placeholder: z.string().optional(),
  }),
  z.object({
    ...base,
    type: z.literal("richtext"),
    default: z.string().optional(),
  }),
  z.object({ ...base, type: z.literal("url"), default: z.string().optional() }),
  z.object({
    ...base,
    type: z.literal("color"),
    default: z.string().regex(THEME_HEX_COLOR).optional(),
  }),
  z.object({
    ...base,
    type: z.literal("menu"),
    default: z.string().optional(),
  }),
  z.object({ ...base, type: z.literal("image_picker") }),
  z.object({ ...base, type: z.literal("collection") }),
  z.object({ ...base, type: z.literal("page") }),
  z.object({ ...base, type: z.literal("blog_post") }),
  z.object({ ...base, type: z.literal("blog_category") }),
  z.object({ ...base, type: z.literal("blog_tag") }),
  z.object({ ...base, type: z.literal("product") }),
  z.object({
    ...base,
    type: z.literal("checkbox"),
    default: z.boolean().optional(),
  }),
  z.object({
    ...base,
    type: z.literal("number"),
    default: z.number().optional(),
    min: z.number().optional(),
    max: z.number().optional(),
  }),
  z.object({
    ...base,
    type: z.literal("range"),
    min: z.number(),
    max: z.number(),
    step: z.number().positive(),
    unit: z.string().optional(),
    default: z.number(),
  }),
  z.object({
    ...base,
    type: z.literal("select"),
    options: z
      .array(z.object({ value: z.string(), label: z.string().min(1) }))
      .min(1),
    default: z.string().optional(),
  }),
  z.object({ type: z.literal("header"), content: z.string().min(1) }),
  z.object({ type: z.literal("paragraph"), content: z.string().min(1) }),
]);

export const themeSchemaSchema = z
  .array(z.object({ name: z.string().min(1), settings: z.array(itemSchema) }))
  .superRefine((groups, ctx) => {
    const settings = groups.flatMap(g => g.settings).filter(isSetting);
    const ids = new Set<string>();
    for (const s of settings) {
      if (ids.has(s.id)) {
        ctx.addIssue({
          code: "custom",
          message: `duplicate setting id "${s.id}"`,
        });
      }
      ids.add(s.id);
    }
    for (const s of settings) {
      if ("default" in s && s.default !== undefined && s.default !== "") {
        const problem = checkValue(s as ThemeSetting, s.default);
        if (problem) {
          ctx.addIssue({
            code: "custom",
            message: `${s.id}: default ${JSON.stringify(s.default)} ${problem}`,
          });
        }
      }
      if (s.visible_if && !ids.has(s.visible_if.setting)) {
        ctx.addIssue({
          code: "custom",
          message: `${s.id}: visible_if names unknown setting "${s.visible_if.setting}"`,
        });
      }
      if (
        s.type === "select" &&
        s.default !== undefined &&
        !s.options.some(o => o.value === s.default)
      ) {
        ctx.addIssue({
          code: "custom",
          message: `${s.id}: default "${s.default}" is not one of its options`,
        });
      }
      if (s.type === "range") {
        if (s.min >= s.max) {
          ctx.addIssue({
            code: "custom",
            message: `${s.id}: min must be below max`,
          });
        } else if (s.default < s.min || s.default > s.max) {
          ctx.addIssue({
            code: "custom",
            message: `${s.id}: default ${s.default} is outside ${s.min}–${s.max}`,
          });
        }
      }
      if (
        s.type === "number" &&
        s.default !== undefined &&
        ((s.min !== undefined && s.default < s.min) ||
          (s.max !== undefined && s.default > s.max))
      ) {
        ctx.addIssue({
          code: "custom",
          message: `${s.id}: default ${s.default} is outside its bounds`,
        });
      }
    }
  });

function isSetting<T extends { type: string }>(
  item: T
): item is Exclude<T, { type: "header" | "paragraph" }> {
  return item.type !== "header" && item.type !== "paragraph";
}

/**
 * Validates a schema from outside the code (CI upload, deploy upload). Throws
 * an Error whose message lists every problem, readable in a build log.
 */
export function parseThemeSchema(input: unknown): ThemeSchema {
  const result = themeSchemaSchema.safeParse(input);
  if (!result.success) {
    throw new Error(`Invalid theme schema:\n${z.prettifyError(result.error)}`);
  }
  return result.data as ThemeSchema;
}

// ─── Values ─────────────────────────────────────────────────────

/**
 * Lists every setting in a theme schema, across all groups, leaving out headers and other non-setting entries.
 *
 * @param schema - the theme schema
 * @returns The settings in schema order
 */
export function themeSettings(schema: ThemeSchema): ThemeSetting[] {
  return schema.flatMap(g => g.settings.filter(isSetting));
}

/**
 * Builds the default value of every setting in a theme schema.
 *
 * @param schema - the theme schema
 * @returns A map from setting id to its default, or `null` when a setting has none
 */
export function themeDefaults(schema: ThemeSchema): ThemeValues {
  const out: ThemeValues = {};
  for (const s of themeSettings(schema)) {
    out[s.id] = "default" in s && s.default !== undefined ? s.default : null;
  }
  return out;
}

/** Types whose empty string is a real value rather than "unset". */
const TEXT_TYPES = new Set<ThemeSettingType>(["text", "textarea", "richtext"]);

/**
 * An absolute http(s) URL, or a path on this site ("/x", never "//x"). No
 * backslashes anywhere: browsers read "/\\host" as "//host".
 */
const SAFE_URL = /^(?:https?:\/\/[^\s\\]+|\/(?![/\\])[^\s\\]*)$/i;

function checkValue(setting: ThemeSetting, value: unknown): string | null {
  switch (setting.type) {
    case "checkbox":
      return typeof value === "boolean" ? null : "must be true or false";
    case "number":
    case "range": {
      if (typeof value !== "number" || !Number.isFinite(value)) {
        return "must be a number";
      }
      if (setting.min !== undefined && value < setting.min) {
        return `must be at least ${setting.min}`;
      }
      if (setting.max !== undefined && value > setting.max) {
        return `must be at most ${setting.max}`;
      }
      return null;
    }
  }
  if (typeof value !== "string") return "must be text";
  switch (setting.type) {
    case "color":
      return THEME_HEX_COLOR.test(value)
        ? null
        : "must be a hex color such as #1a2b3c";
    case "url":
    case "image_picker":
      return SAFE_URL.test(value)
        ? null
        : "must be an http(s) URL or a path starting with /";
    case "select":
      return setting.options.some(o => o.value === value)
        ? null
        : `must be one of ${setting.options.map(o => o.value).join(", ")}`;
    default:
      return null;
  }
}

/**
 * Checks a set of saved theme values against a theme schema. Settings with no value are skipped.
 *
 * @param schema - the theme schema
 * @param input - the values to check, as an object keyed by setting id
 * @returns The accepted values and a list of per-setting errors
 */
export function validateThemeValues(
  schema: ThemeSchema,
  input: unknown
): { values: Record<string, ThemeValue>; errors: ThemeValueError[] } {
  const raw =
    input && typeof input === "object" && !Array.isArray(input)
      ? (input as Record<string, unknown>)
      : {};
  const values: Record<string, ThemeValue> = {};
  const errors: ThemeValueError[] = [];
  for (const s of themeSettings(schema)) {
    const value = raw[s.id];
    if (value === undefined || value === null) continue;
    // A cleared text field is a value (it can blank out a default); for
    // every other type "" means the merchant left the setting unset.
    if (value === "" && !TEXT_TYPES.has(s.type)) continue;
    const problem = checkValue(s, value);
    if (problem) errors.push({ key: s.id, message: `${s.label} ${problem}` });
    else values[s.id] = value as ThemeValue;
  }
  return { values, errors };
}

/** Defaults under the valid values; invalid values fall back to defaults. */
export function resolveThemeSettings(
  schema: ThemeSchema,
  input: unknown
): { settings: ThemeValues; errors: ThemeValueError[] } {
  const { values, errors } = validateThemeValues(schema, input);
  return { settings: { ...themeDefaults(schema), ...values }, errors };
}

/** "Set" means not null, not "" and not false. */
export function isSettingVisible(
  setting: ThemeSetting,
  values: ThemeValues
): boolean {
  const rule = setting.visible_if;
  if (!rule) return true;
  const value = values[rule.setting] ?? null;
  if (rule.is_set !== undefined) {
    const isSet = value !== null && value !== "" && value !== false;
    return rule.is_set === isSet;
  }
  if (rule.equals !== undefined) return value === rule.equals;
  return value !== rule.not_equals;
}

/** The major of a release version ("1.4.2" → 1); null for anything else. */
export function themeMajor(version: string | null | undefined): number | null {
  const match = /^(\d+)\.\d+\.\d+$/.exec(version ?? "");
  return match ? Number(match[1]) : null;
}

/**
 * How a theme's settings values move to a new major (theme majors spec):
 * declared as data in the new major's manifest, run in order by the API
 * when a merchant upgrades.
 */
export type ThemeMigrationStep =
  | { readonly op: "rename"; readonly from: string; readonly to: string }
  | { readonly op: "remove"; readonly key: string }
  | {
      readonly op: "map";
      readonly key: string;
      readonly values: Readonly<Record<string, ThemeValue>>;
    }
  | { readonly op: "copy"; readonly from: string; readonly to: string }
  | {
      readonly op: "default";
      readonly key: string;
      readonly value: ThemeValue;
    };

export interface ThemeMigration {
  /** The major these steps upgrade from: the new major minus one. */
  readonly from: number;
  readonly steps: readonly ThemeMigrationStep[];
}

export interface ThemeMigrationReport {
  renamed: { from: string; to: string }[];
  removed: string[];
  mapped: { key: string; from: string; to: ThemeValue }[];
  copied: { from: string; to: string }[];
  defaulted: string[];
}

const migrationValue = z.union([z.string(), z.number(), z.boolean()]);
const migrationKey = z.string().regex(SETTING_ID);

export const themeMigrationSchema = z
  .object({
    from: z.number().int().min(1),
    steps: z
      .array(
        z.discriminatedUnion("op", [
          z
            .object({
              op: z.literal("rename"),
              from: migrationKey,
              to: migrationKey,
            })
            .strict(),
          z.object({ op: z.literal("remove"), key: migrationKey }).strict(),
          z
            .object({
              op: z.literal("map"),
              key: migrationKey,
              values: z.record(z.string(), migrationValue),
            })
            .strict(),
          z
            .object({
              op: z.literal("copy"),
              from: migrationKey,
              to: migrationKey,
            })
            .strict(),
          z
            .object({
              op: z.literal("default"),
              key: migrationKey,
              value: migrationValue,
            })
            .strict(),
        ])
      )
      .max(500),
  })
  .strict();

/**
 * Parses and validates a theme migration definition.
 *
 * @param input - the unparsed migration
 * @returns The validated migration; throws an `Error` listing the problems when it is invalid
 */
export function parseThemeMigration(input: unknown): ThemeMigration {
  const result = themeMigrationSchema.safeParse(input);
  if (!result.success) {
    const issues = result.error.issues
      .map(i => `${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("; ");
    throw new Error(`Invalid theme migration: ${issues}`);
  }
  return result.data as ThemeMigration;
}

function present(values: Record<string, unknown>, key: string): boolean {
  return (
    Object.prototype.hasOwnProperty.call(values, key) &&
    values[key] !== undefined
  );
}

/** Runs the steps in order over a copy of `input`. */
export function applyThemeMigration(
  input: Record<string, unknown>,
  migration: ThemeMigration
): { values: Record<string, unknown>; report: ThemeMigrationReport } {
  const values: Record<string, unknown> = { ...input };
  const report: ThemeMigrationReport = {
    renamed: [],
    removed: [],
    mapped: [],
    copied: [],
    defaulted: [],
  };
  for (const step of migration.steps) {
    switch (step.op) {
      case "rename":
        if (step.from === step.to || !present(values, step.from)) break;
        values[step.to] = values[step.from];
        delete values[step.from];
        report.renamed.push({ from: step.from, to: step.to });
        break;
      case "remove":
        if (!present(values, step.key)) break;
        delete values[step.key];
        report.removed.push(step.key);
        break;
      case "map": {
        const value = values[step.key];
        if (
          typeof value === "string" &&
          Object.prototype.hasOwnProperty.call(step.values, value)
        ) {
          values[step.key] = step.values[value];
          report.mapped.push({
            key: step.key,
            from: value,
            to: step.values[value],
          });
        }
        break;
      }
      case "copy":
        if (step.from === step.to || !present(values, step.from)) break;
        values[step.to] = values[step.from];
        report.copied.push({ from: step.from, to: step.to });
        break;
      case "default":
        if (present(values, step.key) && values[step.key] !== null) break;
        values[step.key] = step.value;
        report.defaulted.push(step.key);
        break;
    }
  }
  return { values, report };
}
