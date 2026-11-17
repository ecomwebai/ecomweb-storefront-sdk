import {
  ConfigError,
  SECRET_IN_PUBLIC_MESSAGE,
  type EnvSource,
} from "./schema";

/** True when `value` is a secret key (`sk_` prefix, ignoring whitespace). */
export function isSecretKeyValue(value: string | undefined): boolean {
  return value?.trim().startsWith("sk_") ?? false;
}

/**
 * Refuses a secret key in any `NEXT_PUBLIC_*` variable: Next inlines those
 * into the browser bundle. The error names every offending variable and never
 * prints a value.
 *
 * @param env The environment to check.
 * @throws ConfigError listing each `NEXT_PUBLIC_*` variable that holds a secret key.
 */
export function assertNoSecretInPublicEnv(env: EnvSource): void {
  const leaked = Object.keys(env)
    .filter(key => key.startsWith("NEXT_PUBLIC_") && isSecretKeyValue(env[key]))
    .sort();
  if (leaked.length === 0) return;
  throw new ConfigError(
    `Invalid storefront configuration:\n${leaked
      .map(key => `  - ${key}: ${SECRET_IN_PUBLIC_MESSAGE}`)
      .join("\n")}`
  );
}
