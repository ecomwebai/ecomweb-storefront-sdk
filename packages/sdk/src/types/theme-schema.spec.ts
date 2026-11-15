import { describe, expect, expectTypeOf, it } from "vitest";
import {
  isSettingVisible,
  parseThemeSchema,
  resolveThemeSettings,
  themeDefaults,
  validateThemeValues,
  type ThemeSchema,
  type ThemeSettingsOf,
} from "./theme-schema";

const schema = [
  {
    name: "Colors",
    settings: [
      { type: "header", content: "Brand" },
      { type: "color", id: "primary", label: "Primary", default: "#000000" },
      { type: "color", id: "accent", label: "Accent" },
    ],
  },
  {
    name: "Layout",
    settings: [
      {
        type: "range",
        id: "radius",
        label: "Radius",
        min: 0,
        max: 32,
        step: 1,
        unit: "px",
        default: 8,
      },
      { type: "number", id: "columns", label: "Columns", min: 2, max: 6 },
      {
        type: "select",
        id: "cart_type",
        label: "Cart",
        options: [
          { value: "page", label: "Page" },
          { value: "drawer", label: "Drawer" },
        ],
        default: "page",
      },
      {
        type: "checkbox",
        id: "auto_open",
        label: "Auto open",
        default: false,
        visible_if: { setting: "cart_type", equals: "drawer" },
      },
      { type: "url", id: "empty_link", label: "Empty cart link" },
      { type: "image_picker", id: "logo_inverse", label: "Inverse logo" },
      { type: "text", id: "topbar", label: "Top bar" },
      { type: "menu", id: "main_menu", label: "Main menu" },
      { type: "collection", id: "home_collection", label: "Home collection" },
      { type: "page", id: "about_page", label: "About page" },
      { type: "blog_post", id: "featured_post", label: "Featured post" },
      { type: "blog_category", id: "news", label: "News" },
      { type: "blog_tag", id: "sale_tag", label: "Sale tag" },
      { type: "product", id: "hero_product", label: "Hero product" },
    ],
  },
] as const satisfies ThemeSchema;

describe("parseThemeSchema", () => {
  it("accepts every setting type", () => {
    expect(parseThemeSchema(schema)).toEqual(schema);
  });

  it("rejects a duplicate setting id", () => {
    const bad = [
      { name: "A", settings: [{ type: "text", id: "x", label: "X" }] },
      {
        name: "B",
        settings: [{ type: "checkbox", id: "x", label: "X again" }],
      },
    ];
    expect(() => parseThemeSchema(bad)).toThrow(/duplicate setting id "x"/);
  });

  it("rejects visible_if naming a missing setting", () => {
    const bad = [
      {
        name: "A",
        settings: [
          {
            type: "text",
            id: "x",
            label: "X",
            visible_if: { setting: "nope", equals: "y" },
          },
        ],
      },
    ];
    expect(() => parseThemeSchema(bad)).toThrow(
      /visible_if names unknown setting "nope"/
    );
  });

  it("rejects visible_if with no operator or two operators", () => {
    const none = [
      {
        name: "A",
        settings: [
          { type: "text", id: "x", label: "X" },
          { type: "text", id: "y", label: "Y", visible_if: { setting: "x" } },
        ],
      },
    ];
    const two = [
      {
        name: "A",
        settings: [
          { type: "text", id: "x", label: "X" },
          {
            type: "text",
            id: "y",
            label: "Y",
            visible_if: { setting: "x", equals: "a", is_set: true },
          },
        ],
      },
    ];
    expect(() => parseThemeSchema(none)).toThrow(
      /exactly one of equals, not_equals, is_set/
    );
    expect(() => parseThemeSchema(two)).toThrow(
      /exactly one of equals, not_equals, is_set/
    );
  });

  it("rejects a select default outside its options and a range default outside its bounds", () => {
    const select = [
      {
        name: "A",
        settings: [
          {
            type: "select",
            id: "s",
            label: "S",
            options: [{ value: "a", label: "A" }],
            default: "b",
          },
        ],
      },
    ];
    const range = [
      {
        name: "A",
        settings: [
          {
            type: "range",
            id: "r",
            label: "R",
            min: 0,
            max: 10,
            step: 1,
            default: 11,
          },
        ],
      },
    ];
    expect(() => parseThemeSchema(select)).toThrow(
      /default "b" is not one of its options/
    );
    expect(() => parseThemeSchema(range)).toThrow(/default 11 is outside 0–10/);
  });

  it("rejects a non-hex color default and an id that is not snake_case", () => {
    expect(() =>
      parseThemeSchema([
        {
          name: "A",
          settings: [{ type: "color", id: "c", label: "C", default: "red" }],
        },
      ])
    ).toThrow();
    expect(() =>
      parseThemeSchema([
        { name: "A", settings: [{ type: "text", id: "Bad-Id", label: "B" }] },
      ])
    ).toThrow();
  });
});

describe("validateThemeValues", () => {
  it("keeps valid values and drops unknown keys", () => {
    const r = validateThemeValues(schema, {
      primary: "#112233",
      radius: 4,
      cart_type: "drawer",
      auto_open: true,
      empty_link: "/collections/all",
      stray: "x",
    });
    expect(r.values).toEqual({
      primary: "#112233",
      radius: 4,
      cart_type: "drawer",
      auto_open: true,
      empty_link: "/collections/all",
    });
    expect(r.errors).toEqual([]);
  });

  it("reports values of the wrong type with their key", () => {
    const r = validateThemeValues(schema, {
      primary: 12,
      radius: "4",
      auto_open: "yes",
      topbar: false,
    });
    expect(r.values).toEqual({});
    expect(r.errors.map(e => e.key)).toEqual([
      "primary",
      "radius",
      "auto_open",
      "topbar",
    ]);
  });

  it("rejects colors that could break out of a style tag", () => {
    for (const bad of [
      "red",
      "red;}body{display:none",
      "#12345g",
      "</style><script>",
    ]) {
      expect(validateThemeValues(schema, { accent: bad }).errors).toHaveLength(
        1
      );
    }
  });

  it("accepts only http(s) URLs and site paths", () => {
    expect(
      validateThemeValues(schema, { empty_link: "https://shop.example/a" })
        .errors
    ).toEqual([]);
    expect(
      validateThemeValues(schema, { logo_inverse: "/storage/v1/logo.png" })
        .errors
    ).toEqual([]);
    for (const bad of [
      "javascript:alert(1)",
      "//evil.example",
      "data:text/html,x",
      "shop",
    ]) {
      expect(
        validateThemeValues(schema, { empty_link: bad }).errors
      ).toHaveLength(1);
    }
  });

  it("enforces range and number bounds and select options", () => {
    const r = validateThemeValues(schema, {
      radius: 40,
      columns: 1,
      cart_type: "modal",
    });
    expect(r.errors.map(e => e.key)).toEqual([
      "radius",
      "columns",
      "cart_type",
    ]);
  });

  it("treats null, undefined, and empty strings outside text types, as unset", () => {
    expect(
      validateThemeValues(schema, {
        topbar: "",
        accent: null,
        main_menu: undefined,
        empty_link: "",
      })
    ).toEqual({ values: { topbar: "" }, errors: [] });
  });

  it("treats a non-object input as no values", () => {
    expect(validateThemeValues(schema, "nope")).toEqual({
      values: {},
      errors: [],
    });
    expect(validateThemeValues(schema, [1, 2])).toEqual({
      values: {},
      errors: [],
    });
  });
});

describe("review fixes", () => {
  it("rejects backslash forms that browsers read as //host", () => {
    for (const bad of [
      "/\\evil.example",
      "/\\/evil.example",
      "https://shop.example\\@evil",
    ]) {
      expect(
        validateThemeValues(schema, { empty_link: bad }).errors
      ).toHaveLength(1);
    }
  });

  it("checks schema defaults like values: a url default must be safe", () => {
    const bad = [
      {
        name: "A",
        settings: [
          { type: "url", id: "u", label: "U", default: "javascript:alert(1)" },
        ],
      },
    ];
    expect(() => parseThemeSchema(bad)).toThrow(/u: default .*http\(s\) URL/);
  });

  it("lets an empty string clear a text default, but treats it as unset for other types", () => {
    const withDefault = [
      {
        name: "A",
        settings: [
          {
            type: "text",
            id: "topbar",
            label: "Top bar",
            default: "Free shipping",
          },
          { type: "color", id: "accent", label: "Accent", default: "#000000" },
        ],
      },
    ] as const satisfies ThemeSchema;
    const r = resolveThemeSettings(withDefault, { topbar: "", accent: "" });
    expect(r.settings.topbar).toBe("");
    expect(r.settings.accent).toBe("#000000");
    expect(r.errors).toEqual([]);
  });
});

describe("resolveThemeSettings", () => {
  it("puts defaults under valid values and nulls under settings without a default", () => {
    expect(themeDefaults(schema)).toEqual({
      primary: "#000000",
      accent: null,
      radius: 8,
      columns: null,
      cart_type: "page",
      auto_open: false,
      empty_link: null,
      logo_inverse: null,
      topbar: null,
      main_menu: null,
      home_collection: null,
      about_page: null,
      featured_post: null,
      news: null,
      sale_tag: null,
      hero_product: null,
    });
    const r = resolveThemeSettings(schema, { accent: "#fff", radius: 99 });
    expect(r.settings.accent).toBe("#fff");
    expect(r.settings.radius).toBe(8);
    expect(r.errors.map(e => e.key)).toEqual(["radius"]);
  });
});

describe("isSettingVisible", () => {
  const auto = schema[1].settings[3];
  it("evaluates equals, not_equals and is_set", () => {
    expect(isSettingVisible(auto, { cart_type: "drawer" })).toBe(true);
    expect(isSettingVisible(auto, { cart_type: "page" })).toBe(false);
    expect(
      isSettingVisible(
        {
          type: "text",
          id: "a",
          label: "A",
          visible_if: { setting: "b", not_equals: "x" },
        },
        { b: "y" }
      )
    ).toBe(true);
    expect(
      isSettingVisible(
        {
          type: "text",
          id: "a",
          label: "A",
          visible_if: { setting: "b", is_set: true },
        },
        { b: "" }
      )
    ).toBe(false);
    expect(
      isSettingVisible(
        {
          type: "text",
          id: "a",
          label: "A",
          visible_if: { setting: "b", is_set: false },
        },
        { b: null }
      )
    ).toBe(true);
  });

  it("shows settings without a condition", () => {
    expect(isSettingVisible({ type: "text", id: "a", label: "A" }, {})).toBe(
      true
    );
  });
});

describe("ThemeSettingsOf", () => {
  it("types values from the schema", () => {
    type S = ThemeSettingsOf<typeof schema>;
    expectTypeOf<S["primary"]>().toEqualTypeOf<string>();
    expectTypeOf<S["accent"]>().toEqualTypeOf<string | null>();
    expectTypeOf<S["radius"]>().toEqualTypeOf<number>();
    expectTypeOf<S["auto_open"]>().toEqualTypeOf<boolean>();
    expectTypeOf<S["columns"]>().toEqualTypeOf<number | null>();
    expectTypeOf<keyof S>().toEqualTypeOf<
      | "primary"
      | "accent"
      | "radius"
      | "columns"
      | "cart_type"
      | "auto_open"
      | "empty_link"
      | "logo_inverse"
      | "topbar"
      | "main_menu"
      | "home_collection"
      | "about_page"
      | "featured_post"
      | "news"
      | "sale_tag"
      | "hero_product"
    >();
  });
});
