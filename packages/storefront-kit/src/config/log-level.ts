import { logLevelOf, type LogLevel } from "./schema";

/** Server-side LOG_LEVEL. Not behind server-only: logging runs in both runtimes. */
export function serverLogLevel(): LogLevel | undefined {
  return typeof window === "undefined"
    ? logLevelOf(process.env.LOG_LEVEL?.trim())
    : undefined;
}
