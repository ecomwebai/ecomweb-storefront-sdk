const VAR_NAME = /^--[a-zA-Z0-9-]+$/;
/** Anything that could end the declaration, the rule or the <style> tag. */
const UNSAFE_VALUE = /[<>{};\\\r\n]/;

/** A `:root{…}` rule from a theme's custom properties; null when empty. */
export function themeStyleCss(
  vars: Record<string, string> | null | undefined
): string | null {
  if (!vars) return null;
  const declarations = Object.entries(vars)
    .filter(
      ([name, value]) =>
        VAR_NAME.test(name) &&
        typeof value === "string" &&
        value.trim() !== "" &&
        !UNSAFE_VALUE.test(value)
    )
    .map(([name, value]) => `${name}:${value.trim()}`);
  return declarations.length ? `:root{${declarations.join(";")}}` : null;
}

/**
 * Renders a theme's CSS custom properties as a `:root` style tag. Names that
 * are not `--custom-properties` and unsafe values are dropped.
 *
 * @param props.vars - The properties by name, for example from the theme's `styles` function.
 * @returns A `<style>` element, or `null` when no property is usable.
 */
export function ThemeStyle({
  vars,
}: {
  vars: Record<string, string> | null | undefined;
}) {
  const css = themeStyleCss(vars);
  return css ? <style dangerouslySetInnerHTML={{ __html: css }} /> : null;
}
