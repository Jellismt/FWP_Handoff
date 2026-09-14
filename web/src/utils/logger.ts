/**
 * @file logger.ts
 * @module engage-mt/utils
 * @description Namespaced logger — the one sanctioned sink for runtime
 *              diagnostics (`no-console` is an ESLint error). Entries reach the
 *              browser console only in development; in production (and under
 *              vitest) the logger is silent, so nothing about a session is
 *              recorded or uploaded.
 *              Error stacks are sanitized to strip query strings and base64
 *              blobs before they are printed.
 * @author Jamie Ellis / Engage MT
 * @created 2026-05-29
 * @updated 2026-09-05
 * @version 2.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

const IS_DEV = import.meta.env.DEV && !import.meta.env.TEST;

export interface NamespacedLogger {
  debug: (msg: string, meta?: Record<string, unknown>) => void;
  info: (msg: string, meta?: Record<string, unknown>) => void;
  warn: (msg: string, meta?: Record<string, unknown>) => void;
  error: (msg: string, err?: unknown) => void;
}

/** Strip query strings + base64 blobs so a stack can't carry fetch parameters. */
const sanitizeStack = (stack: string | undefined): string | undefined =>
  stack?.replace(/\?[^\s"'`)]*/g, "?…").replace(/(data:[^;]+;base64,)[A-Za-z0-9+/=]+/g, "$1…");

const errorMeta = (err: unknown): Record<string, unknown> => {
  if (err instanceof Error)
    return { name: err.name, message: err.message, stack: sanitizeStack(err.stack) };
  return { value: String(err) };
};

const emit = (ns: string, lvl: LogLevel, msg: string, meta?: Record<string, unknown>): void => {
  if (!IS_DEV) return;
  const fn = lvl === "debug" ? console.debug : console[lvl];
  fn(`[${ns}] ${msg}`, meta ?? "");
};

export const createLogger = (ns: string): NamespacedLogger => ({
  debug: (msg, meta) => emit(ns, "debug", msg, meta),
  info: (msg, meta) => emit(ns, "info", msg, meta),
  warn: (msg, meta) => emit(ns, "warn", msg, meta),
  error: (msg, err) => emit(ns, "error", msg, err === undefined ? undefined : errorMeta(err)),
});
