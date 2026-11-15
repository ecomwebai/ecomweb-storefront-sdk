// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import {
  ThemeSettingsProvider,
  useOptionalThemeId,
  useOptionalThemeKey,
  useThemeId,
  useThemeSettings,
} from "./settings-context";

describe("ThemeSettingsProvider", () => {
  it("gives components the theme's settings and id", () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <ThemeSettingsProvider themeId="default" settings={{ main_menu: "top" }}>
        {children}
      </ThemeSettingsProvider>
    );
    const settings = renderHook(
      () => useThemeSettings<{ main_menu: string }>(),
      { wrapper }
    );
    const id = renderHook(() => useThemeId(), { wrapper });
    expect(settings.result.current.main_menu).toBe("top");
    expect(id.result.current).toBe("default");
  });

  it("fails loudly outside a provider", () => {
    expect(() => renderHook(() => useThemeSettings())).toThrow(
      /useThemeSettings must be used inside a ThemeSettingsProvider/
    );
  });

  it("useOptionalThemeId returns the id inside a provider and null outside", () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <ThemeSettingsProvider themeId="meridian" settings={{}}>
        {children}
      </ThemeSettingsProvider>
    );
    expect(
      renderHook(() => useOptionalThemeId(), { wrapper }).result.current
    ).toBe("meridian");
    expect(renderHook(() => useOptionalThemeId()).result.current).toBeNull();
  });
});

const wrapKey = (props: { themeId: string; themeKey?: string }) =>
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <ThemeSettingsProvider {...props} settings={{}}>
        {children}
      </ThemeSettingsProvider>
    );
  };

describe("theme key", () => {
  it("is the provider's key, while the id stays the id", () => {
    const { result } = renderHook(
      () => [useOptionalThemeKey(), useThemeId()],
      { wrapper: wrapKey({ themeId: "meridian", themeKey: "meridian@1" }) }
    );
    expect(result.current).toEqual(["meridian@1", "meridian"]);
  });
  it("falls back to the id, and to null outside a provider", () => {
    expect(
      renderHook(useOptionalThemeKey, { wrapper: wrapKey({ themeId: "x" }) })
        .result.current
    ).toBe("x");
    expect(renderHook(useOptionalThemeKey).result.current).toBeNull();
  });
});
