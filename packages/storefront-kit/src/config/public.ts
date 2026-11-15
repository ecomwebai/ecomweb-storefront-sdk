import { resolveMode } from "./mode";
import {
  envValue,
  logLevelOf,
  parseOrThrow,
  publicConfigSchema,
  sampleRateOf,
  type EnvSource,
  type PublicConfig,
} from "./schema";

const MULTI_ENV_NAME_OF: Record<string, string> = {
  apiUrl: "NEXT_PUBLIC_API_URL",
  storefrontApiKey: "NEXT_PUBLIC_PLATFORM_API_KEY",
  appUrl: "NEXT_PUBLIC_APP_URL",
  platformDomainSuffix: "NEXT_PUBLIC_PLATFORM_DOMAIN_SUFFIX",
  primaryMenuRef: "NEXT_PUBLIC_PRIMARY_MENU_REF",
};

/** next.config.mjs derives these NEXT_PUBLIC_ names from ECOMWEB_* / SITE_URL. */
const SINGLE_ENV_NAME_OF: Record<string, string> = {
  storeRef: "ECOMWEB_STORE_REF",
  storefrontApiKey: "ECOMWEB_PUBLISHABLE_KEY",
  apiUrl: "ECOMWEB_API_URL",
  appUrl: "SITE_URL",
};

// Production serves the API under /api/v1 (Kong strips the prefix) and stored
// assets at the origin's /storage/v1.
const DEFAULT_SINGLE_API_URL = "https://apibase.ecomweb.app/api/v1";

/** Stored assets live at the API host's /storage/v1, whatever path the API has. */
function originOf(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return url; // the schema reports the invalid API URL
  }
}

function parseMulti(env: EnvSource): PublicConfig {
  return parseOrThrow(
    publicConfigSchema,
    {
      mode: "multi",
      storeRef: null,
      apiUrl: envValue(env, "NEXT_PUBLIC_API_URL")?.replace(/\/$/, ""),
      assetBaseUrl: (envValue(env, "NEXT_PUBLIC_ASSET_BASE_URL") ?? "").replace(
        /\/$/,
        ""
      ),
      appUrl: envValue(env, "NEXT_PUBLIC_APP_URL") ?? "https://ecomweb.app",
      storefrontApiKey: envValue(env, "NEXT_PUBLIC_PLATFORM_API_KEY"),
      platformDomainSuffix:
        envValue(env, "NEXT_PUBLIC_PLATFORM_DOMAIN_SUFFIX") ?? "ecomsite.app",
      appBaseUrlFlag: envValue(env, "NEXT_PUBLIC_APP_BASE_URL"),
      imageTransformationsFlag: envValue(
        env,
        "NEXT_PUBLIC_ENABLE_IMAGE_TRANSFORMATIONS"
      ),
      primaryMenuRef:
        envValue(env, "NEXT_PUBLIC_PRIMARY_MENU_REF") ?? "main-menu",
      logLevel: logLevelOf(envValue(env, "NEXT_PUBLIC_LOG_LEVEL")),
      webVitalsSampleRate: sampleRateOf(
        envValue(env, "NEXT_PUBLIC_WEB_VITALS_SAMPLE_RATE"),
        0.1
      ),
    },
    MULTI_ENV_NAME_OF
  );
}

function parseSingle(env: EnvSource): PublicConfig {
  const apiUrl = (
    envValue(env, "NEXT_PUBLIC_ECOMWEB_API_URL") ?? DEFAULT_SINGLE_API_URL
  ).replace(/\/$/, "");
  return parseOrThrow(
    publicConfigSchema,
    {
      mode: "single",
      storeRef: envValue(env, "NEXT_PUBLIC_ECOMWEB_STORE_REF"),
      apiUrl,
      assetBaseUrl: (
        envValue(env, "NEXT_PUBLIC_ECOMWEB_ASSET_URL") ?? originOf(apiUrl)
      ).replace(/\/$/, ""),
      appUrl: envValue(env, "NEXT_PUBLIC_SITE_URL")?.replace(/\/$/, ""),
      storefrontApiKey: envValue(env, "NEXT_PUBLIC_ECOMWEB_PUBLISHABLE_KEY"),
      platformDomainSuffix: null,
      appBaseUrlFlag: undefined,
      imageTransformationsFlag: envValue(
        env,
        "NEXT_PUBLIC_ENABLE_IMAGE_TRANSFORMATIONS"
      ),
      primaryMenuRef: "main-menu",
      logLevel: logLevelOf(envValue(env, "NEXT_PUBLIC_LOG_LEVEL")),
      webVitalsSampleRate: sampleRateOf(
        envValue(env, "NEXT_PUBLIC_WEB_VITALS_SAMPLE_RATE"),
        0.1
      ),
    },
    SINGLE_ENV_NAME_OF
  );
}

/** Parses the variables of the mode `env` selects (see resolveMode). */
export function parsePublicConfig(env: EnvSource): PublicConfig {
  return resolveMode(env) === "multi" ? parseMulti(env) : parseSingle(env);
}

let cached: PublicConfig | undefined;

/** Specs that stub env per test call this in beforeEach. */
export function resetPublicConfigForTests(): void {
  cached = undefined;
}

/**
 * Every NEXT_PUBLIC_ var is spelled out literally: Next inlines only literal
 * `process.env.NEXT_PUBLIC_X` reads into client bundles.
 */
export function publicConfig(): PublicConfig {
  return (cached ??= parsePublicConfig({
    NEXT_PUBLIC_ECOMWEB_MODE: process.env.NEXT_PUBLIC_ECOMWEB_MODE,
    ECOMWEB_MODE:
      typeof window === "undefined" ? process.env.ECOMWEB_MODE : undefined,
    // multi
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_ASSET_BASE_URL: process.env.NEXT_PUBLIC_ASSET_BASE_URL,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_PLATFORM_API_KEY: process.env.NEXT_PUBLIC_PLATFORM_API_KEY,
    NEXT_PUBLIC_PLATFORM_DOMAIN_SUFFIX:
      process.env.NEXT_PUBLIC_PLATFORM_DOMAIN_SUFFIX,
    NEXT_PUBLIC_APP_BASE_URL: process.env.NEXT_PUBLIC_APP_BASE_URL,
    NEXT_PUBLIC_PRIMARY_MENU_REF: process.env.NEXT_PUBLIC_PRIMARY_MENU_REF,
    // single
    NEXT_PUBLIC_ECOMWEB_STORE_REF: process.env.NEXT_PUBLIC_ECOMWEB_STORE_REF,
    NEXT_PUBLIC_ECOMWEB_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_ECOMWEB_PUBLISHABLE_KEY,
    NEXT_PUBLIC_ECOMWEB_API_URL: process.env.NEXT_PUBLIC_ECOMWEB_API_URL,
    NEXT_PUBLIC_ECOMWEB_ASSET_URL: process.env.NEXT_PUBLIC_ECOMWEB_ASSET_URL,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    // both
    NEXT_PUBLIC_ENABLE_IMAGE_TRANSFORMATIONS:
      process.env.NEXT_PUBLIC_ENABLE_IMAGE_TRANSFORMATIONS,
    NEXT_PUBLIC_LOG_LEVEL: process.env.NEXT_PUBLIC_LOG_LEVEL,
    NEXT_PUBLIC_WEB_VITALS_SAMPLE_RATE:
      process.env.NEXT_PUBLIC_WEB_VITALS_SAMPLE_RATE,
  }));
}
