import { z } from "zod";

export type LogLevel = "silent" | "error" | "warn" | "info" | "debug";
export type EnvSource = Record<string, string | undefined>;

const LOG_LEVELS = ["silent", "error", "warn", "info", "debug"] as const;

/** Blank strings count as unset: a `KEY=` line in .env is a mistake, not a value. */
export function envValue(env: EnvSource, key: string): string | undefined {
  const v = env[key]?.trim();
  return v ? v : undefined;
}

export function logLevelOf(v: string | undefined): LogLevel | undefined {
  return (LOG_LEVELS as readonly string[]).includes(v ?? "")
    ? (v as LogLevel)
    : undefined;
}

/** http(s) only: bare `localhost:3001` parses as a URL with scheme "localhost:". */
const httpUrl = z.url({ protocol: /^https?$/ });

export const publicConfigSchema = z.object({
  mode: z.enum(["multi", "single"]),
  storeRef: z.string().min(1).nullable(),
  apiUrl: httpUrl,
  assetBaseUrl: z.string(),
  appUrl: httpUrl,
  storefrontApiKey: z.string().min(1),
  platformDomainSuffix: z.string().min(1).nullable(),
  appBaseUrlFlag: z.string().optional(),
  imageTransformationsFlag: z.string().optional(),
  primaryMenuRef: z.string().min(1),
  logLevel: z.enum(LOG_LEVELS).optional(),
  webVitalsSampleRate: z.number().min(0).max(1),
});
export type PublicConfig = z.infer<typeof publicConfigSchema>;

export const serverConfigSchema = z.object({
  platformApiKey: z.string().min(1),
  clientIpForwarderSecret: z.string().min(1).optional(),
  appBaseUrl: z.string().min(1),
  appEnv: z.string().min(1),
  googleVerification: z.string().optional(),
  logLevel: z.enum(LOG_LEVELS).optional(),
  /**
   * The header carrying the shopper's IP that this server's edge sets and a
   * shopper cannot forge: X-Forwarded-For behind an edge that overwrites it
   * (Vercel), CF-Connecting-IP behind Cloudflare → proxies that append.
   */
  clientIpHeader: z.enum(["x-forwarded-for", "cf-connecting-ip"]),
  /**
   * Requests a minute to one store, on one server, above which the
   * multi-tenant middleware logs that store (log only, nothing is refused).
   * 0 turns it off.
   */
  storeTrafficLogPerMinute: z.number().int().min(0),
});
export type ServerConfig = z.infer<typeof serverConfigSchema>;

/**
 * Thrown when the storefront's environment variables are missing or invalid.
 * The message names the variable behind every bad field.
 */
export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

/**
 * Parses `candidate` and, on failure, throws one error naming the env var
 * behind every bad field, so a misconfigured deploy says what to fix instead
 * of rendering empty pages.
 */
export function parseOrThrow<T>(
  schema: z.ZodType<T>,
  candidate: unknown,
  envNameOf: Record<string, string>
): T {
  const result = schema.safeParse(candidate);
  if (result.success) return result.data;
  const lines = result.error.issues.map(issue => {
    const field = String(issue.path[0] ?? "");
    return `  - ${envNameOf[field] ?? field}: ${issue.message}`;
  });
  throw new ConfigError(
    `Invalid storefront configuration:\n${lines.join("\n")}`
  );
}

/** A non-negative integer from `v`, else `fallback`. */
export function countOf(v: string | undefined, fallback: number): number {
  const n = Number(v);
  return v !== undefined && Number.isInteger(n) && n >= 0 ? n : fallback;
}

export function sampleRateOf(v: string | undefined, fallback: number): number {
  const n = Number(v);
  return v !== undefined && Number.isFinite(n) && n >= 0 && n <= 1
    ? n
    : fallback;
}
