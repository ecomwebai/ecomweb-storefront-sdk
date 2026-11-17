/**
 * Lightweight logging helpers: log levels + console filtering.
 * - Defaults to 'warn' in production and 'debug' in development
 * - Honors `NEXT_PUBLIC_LOG_LEVEL` (client) or `LOG_LEVEL` (server)
 */

import { publicConfig } from "./config/public";
import { serverLogLevel } from "./config/log-level";

export type LogLevel = "silent" | "error" | "warn" | "info" | "debug";

const levelOrder: Record<LogLevel, number> = {
  silent: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4,
};

/**
 * Reads the configured log level: `NEXT_PUBLIC_LOG_LEVEL` in the browser or
 * `LOG_LEVEL` on the server, else `warn` in production and `debug` in
 * development.
 *
 * @returns The active log level.
 */
export function getLogLevel(): LogLevel {
  const envLevel =
    publicConfig().logLevel ?? serverLogLevel();

  if (envLevel && envLevel in levelOrder) return envLevel;

  return process.env.NODE_ENV === "production" ? "warn" : "debug";
}

/**
 * Tells whether a message of one level is shown at the current level.
 *
 * @param currentLevel - The level the app is configured for.
 * @param messageLevel - The level of the message to print.
 * @returns `true` when the message should be printed; always `false` when the current level is `silent`.
 */
export function shouldLog(currentLevel: LogLevel, messageLevel: LogLevel) {
  return (
    levelOrder[messageLevel] <= levelOrder[currentLevel] &&
    currentLevel !== "silent"
  );
}

/**
 * Replace noisy console methods based on configured level.
 * - Disables lower-priority methods while preserving warn/error by default.
 * - Safe to call multiple times; idempotent for the same level.
 */
let appliedLevel: LogLevel | null = null;
/**
 * Silences the `console` methods below the log level by replacing them.
 * Calling it again with the same level does nothing.
 *
 * @param level - The level to apply; defaults to {@link getLogLevel}.
 */
export function applyConsoleFilter(level: LogLevel = getLogLevel()) {
  if (appliedLevel === level) return; // avoid re-wrapping
  appliedLevel = level;

  const original = {
    log: console.log.bind(console),
    info: console.info ? console.info.bind(console) : console.log.bind(console),
    debug: console.debug
      ? console.debug.bind(console)
      : console.log.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
  } as const;

  const noop = () => {};

  console.debug = shouldLog(level, "debug") ? original.debug : noop;
  console.log = shouldLog(level, "info") ? original.log : noop;
  console.info = shouldLog(level, "info") ? original.info : noop;
  console.warn = shouldLog(level, "warn") ? original.warn : noop;
  console.error = shouldLog(level, "error") ? original.error : noop;
}
