import "server-only";
import { resolveMode } from "./mode";
import {
  countOf,
  envValue,
  logLevelOf,
  parseOrThrow,
  serverConfigSchema,
  type EnvSource,
  type ServerConfig,
} from "./schema";

function parseMulti(env: EnvSource): ServerConfig {
  return parseOrThrow(
    serverConfigSchema,
    {
      platformApiKey:
        envValue(env, "PLATFORM_API_KEY") ??
        envValue(env, "NEXT_PUBLIC_PLATFORM_API_KEY"),
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
      platformApiKey: "PLATFORM_API_KEY or NEXT_PUBLIC_PLATFORM_API_KEY",
      clientIpHeader: "CLIENT_IP_HEADER",
    }
  );
}

function parseSingle(env: EnvSource): ServerConfig {
  return parseOrThrow(
    serverConfigSchema,
    {
      // The key is publishable, and next.config inlines it at build time as
      // NEXT_PUBLIC_ECOMWEB_PUBLISHABLE_KEY: an image built with --build-arg
      // still runs when the runtime env does not repeat it.
      platformApiKey:
        envValue(env, "ECOMWEB_PUBLISHABLE_KEY") ??
        envValue(env, "NEXT_PUBLIC_ECOMWEB_PUBLISHABLE_KEY"),
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
      platformApiKey: "ECOMWEB_PUBLISHABLE_KEY",
      clientIpHeader: "CLIENT_IP_HEADER",
    }
  );
}

/** Parses the variables of the mode `env` selects (see resolveMode). */
export function parseServerConfig(env: EnvSource): ServerConfig {
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
