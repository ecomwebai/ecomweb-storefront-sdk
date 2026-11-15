import { describe, expect, expectTypeOf, it } from "vitest";
import {
  defineSchema,
  defineTheme,
  type LayoutSlotProps,
  type ThemeComponents,
} from "./define";

describe("defineSchema / defineTheme", () => {
  const schema = defineSchema([
    {
      name: "Header",
      settings: [
        { type: "menu", id: "main_menu", label: "Menu" },
        { type: "checkbox", id: "sticky", label: "Sticky", default: true },
      ],
    },
  ]);

  it("returns its input unchanged", () => {
    const theme = defineTheme({
      info: { id: "t", name: "T", version: "1.0.0", author: "Ecomweb" },
      schema,
      components: {},
    });
    expect(theme.schema).toBe(schema);
    expect(theme.info.id).toBe("t");
  });

  it("types slot settings from the schema", () => {
    defineTheme({
      info: { id: "t", name: "T", version: "1.0.0", author: "Ecomweb" },
      schema,
      components: {
        Layout: (
          props: LayoutSlotProps<{ main_menu: string | null; sticky: boolean }>
        ) => props.children,
      },
      styles: settings => {
        expectTypeOf(settings.sticky).toEqualTypeOf<boolean>();
        expectTypeOf(settings.main_menu).toEqualTypeOf<string | null>();
        return {};
      },
    });
  });

  it("accepts every page slot", () => {
    const Slot = () => null;
    const components: ThemeComponents<unknown> = {
      Layout: Slot,
      HomePage: Slot,
      ProductPage: Slot,
      CollectionPage: Slot,
      ContentPage: Slot,
      BlogIndex: Slot,
      BlogPost: Slot,
    };
    expect(Object.keys(components)).toHaveLength(7);
  });
});
