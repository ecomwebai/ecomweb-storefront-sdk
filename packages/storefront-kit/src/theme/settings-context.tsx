"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { ThemeValues } from "@ecomweb/sdk";

interface ThemeSettingsContextValue {
  themeId: string;
  /** The registry key of the code rendering, e.g. "meridian@1" (theme majors). */
  themeKey?: string;
  settings: ThemeValues;
}

const ThemeSettingsContext = createContext<ThemeSettingsContextValue | null>(
  null
);

/** The published (or previewed) theme's resolved settings, for client components. */
export function ThemeSettingsProvider({
  themeId,
  themeKey,
  settings,
  children,
}: ThemeSettingsContextValue & { children: ReactNode }) {
  const value = useMemo(
    () => ({ themeId, themeKey, settings }),
    [themeId, themeKey, settings]
  );
  return (
    <ThemeSettingsContext.Provider value={value}>
      {children}
    </ThemeSettingsContext.Provider>
  );
}

function useThemeSettingsContext(hook: string): ThemeSettingsContextValue {
  const ctx = useContext(ThemeSettingsContext);
  if (!ctx) {
    throw new Error(`${hook} must be used inside a ThemeSettingsProvider`);
  }
  return ctx;
}

/** Pass the theme's settings type: `useThemeSettings<MyThemeSettings>()`. */
export function useThemeSettings<T = ThemeValues>(): T {
  return useThemeSettingsContext("useThemeSettings").settings as T;
}

/**
 * The id of the theme rendering the store.
 *
 * Must run under the theme settings provider the storefront's layout sets up.
 *
 * @returns The theme id.
 * @throws When used outside that provider.
 */
export function useThemeId(): string {
  return useThemeSettingsContext("useThemeId").themeId;
}

/** The theme id, or null outside a ThemeSettingsProvider (e.g. a store 404). */
export function useOptionalThemeId(): string | null {
  return useContext(ThemeSettingsContext)?.themeId ?? null;
}

/**
 * The registry key of the theme code rendering ("meridian@1"), else its id;
 * null outside a ThemeSettingsProvider. Client registries look up by it.
 */
export function useOptionalThemeKey(): string | null {
  const ctx = useContext(ThemeSettingsContext);
  return ctx ? (ctx.themeKey ?? ctx.themeId) : null;
}
