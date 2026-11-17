import "server-only";
import { resolveMode } from "./mode";
import { assertNoSecretInPublicEnv } from "./secret-guard";
import {
  countOf,
  envValue,
  logLevelOf,
  parseOrThrow,
  serverConfigSchema,
  type EnvSource,
  type ServerConfig,
} from "./schema";

/**
 * The secret key, from the runtime env only (never a NEXT_PUBLIC_ fallback).
 * `next build` gets none (hosted builds hold no secret), so while it runs a
 * missing key reads as empty; `storefrontSecretKey()` throws on an empty one.
 */
function secretOf(env: EnvSource, name: string): string | undefined {
  const value = envValue(env, name);
  if (value === undefined && env.NEXT_PHASE === "phase-production-build") {
    return "";
  }
  return value;
}

function parseMulti(env: EnvSource): ServerConfig {
  return parseOrThrow(
    serverConfigSchema,
    {
      secretKey: secretOf(env, "PLATFORM_SECRET_KEY"),
      clientIpForwarderSecret: envValue(env, "CLIENT_IP_FORWARDER_SECRET"),
      appBaseUrl: envValue(env, "APP_BASE_URL") ?? "http://localhost:3002",
      appEnv: envValue(env, "APP_ENV") ?? "unknown",
      googleVerification: envValue(env, "GOOGLE_VERIFICATION"),
      logLevel: logLevelOf(envValue(env, "LOG_LEVEL")),
      clientIpHeader: envValue(env, "CLIENT_IP_HEADER") ?? "x-forwarded-for",
      storeTrafficLogPerMinute: countOf(
        envValue(env, "STORE_TRAFFIC_LOG_PER_MINUTE"),
        600
      ),
    },
    {
      secretKey: "PLATFORM_SECRET_KEY",
      clientIpHeader: "CLIENT_IP_HEADER",
    },
    envValue(env, "PLATFORM_API_KEY")
      ? { secretKey: "(PLATFORM_API_KEY is retired)" }
      : {}
  );
}

function parseSingle(env: EnvSource): ServerConfig {
  return parseOrThrow(
    serverConfigSchema,
    {
      secretKey: secretOf(env, "ECOMWEB_SECRET_KEY"),
      clientIpForwarderSecret: envValue(env, "CLIENT_IP_FORWARDER_SECRET"),
      appBaseUrl: envValue(env, "SITE_URL") ?? "http://localhost:3000",
      appEnv: envValue(env, "APP_ENV") ?? "production",
      googleVerification: envValue(env, "GOOGLE_VERIFICATION"),
      logLevel: logLevelOf(envValue(env, "LOG_LEVEL")),
      clientIpHeader: envValue(env, "CLIENT_IP_HEADER") ?? "x-forwarded-for",
      // One store per site: there are no neighbours to watch.
      storeTrafficLogPerMinute: 0,
    },
    {
      secretKey: "ECOMWEB_SECRET_KEY",
      clientIpHeader: "CLIENT_IP_HEADER",
    }
  );
}

/** Parses the variables of the mode `env` selects (see resolveMode). */
export function parseServerConfig(env: EnvSource): ServerConfig {
  assertNoSecretInPublicEnv(env);
  return resolveMode(env) === "multi" ? parseMulti(env) : parseSingle(env);
}

let cached: ServerConfig | undefined;

export function resetServerConfigForTests(): void {
  cached = undefined;
}

/**
 * The server's parsed configuration, read from the environment on the first
 * call and cached. Server-only: import it from `@ecomweb/storefront-kit/server`
 * in server code, never in a client component.
 *
 * @returns The validated server config.
 * @throws ConfigError when a required variable is missing or invalid.
 */
export function serverConfig(): ServerConfig {
  return (cached ??= parseServerConfig({
    ...process.env,
    // Literal reads so Next inlines the build-time values.
    NEXT_PUBLIC_ECOMWEB_MODE: process.env.NEXT_PUBLIC_ECOMWEB_MODE,
    NEXT_PUBLIC_ECOMWEB_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_ECOMWEB_PUBLISHABLE_KEY,
  }));
}
