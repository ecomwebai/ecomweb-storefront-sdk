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

export function ThemeStyle({
  vars,
}: {
  vars: Record<string, string> | null | undefined;
}) {
  const css = themeStyleCss(vars);
  return css ? <style dangerouslySetInnerHTML={{ __html: css }} /> : null;
}
