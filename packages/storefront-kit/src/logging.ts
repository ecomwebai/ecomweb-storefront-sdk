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

export function getLogLevel(): LogLevel {
  const envLevel =
    publicConfig().logLevel ?? serverLogLevel();

  if (envLevel && envLevel in levelOrder) return envLevel;

  return process.env.NODE_ENV === "production" ? "warn" : "debug";
}

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
