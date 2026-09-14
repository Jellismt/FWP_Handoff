/**
 * @file persistedKey.ts
 * @module engage-mt/store
 * @description Persistence helper. Three stores
 *              (`themeStore`, `fieldModeStore`)
 *              reimplemented the same `try { localStorage.getItem }
 *              catch {}` boilerplate. This helper captures the pattern
 *              once: SSR-safe read with fallback, encode-on-write, all
 *              exceptions swallowed (private-browsing + quota errors).
 *
 *              Per `docs/rules/privacy.md` § "What stays on your
 *              device" — every key persisted via this helper stays in
 *              `localStorage` (web) or `@capacitor/preferences` (mobile
 *              when the Capacitor wrapper lands). Never transmitted.
 *
 *              Naming convention: all keys MUST be prefixed
 *              `engage-mt:<scope>` so they're easy to grep + bulk-clear
 *              from browser DevTools.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-02
 * @updated 2026-06-10
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

export interface PersistedKey<T> {
  /** Read the stored value, falling back to `fallback` when missing / invalid. */
  read: (fallback: T) => T;
  /** Write the value. No-op when storage is unavailable. */
  write: (value: T) => void;
  /** Drop the key (e.g., sign-out, settings reset). */
  clear: () => void;
}

interface CreatePersistedKeyOptions<T> {
  /** Storage key. MUST start with `engage-mt:` per the naming convention. */
  key: string;
  /** Parse the raw string into the typed value. Return `null` on parse failure. */
  decode: (raw: string) => T | null;
  /** Serialize the value to the string that lands in storage. */
  encode: (value: T) => string;
}

const isSafe = (): boolean => typeof window !== "undefined" && !!window.localStorage;

/**
 * Create a typed, SSR-safe `localStorage` slot. The returned trio is
 * the minimum surface a Zustand store needs to hydrate + persist:
 * `read()` at create-time, `write()` on every state change, `clear()`
 * on sign-out / reset.
 */
export const createPersistedKey = <T>(opts: CreatePersistedKeyOptions<T>): PersistedKey<T> => {
  if (!opts.key.startsWith("engage-mt:")) {
    // Compile-time assertion so misnamed keys surface during dev. This
    // file is on the no-console exemption list in eslint.config.js.
    console.warn(
      `[persistedKey] Key "${opts.key}" does not start with "engage-mt:" — ` +
        "please follow the naming convention so the value is easy to grep + " +
        "bulk-clear.",
    );
  }
  return {
    read: (fallback) => {
      if (!isSafe()) return fallback;
      try {
        const raw = window.localStorage.getItem(opts.key);
        if (raw == null) return fallback;
        const out = opts.decode(raw);
        return out ?? fallback;
      } catch {
        return fallback;
      }
    },
    write: (value) => {
      if (!isSafe()) return;
      try {
        window.localStorage.setItem(opts.key, opts.encode(value));
      } catch {
        /* storage quota / private mode — silently drop */
      }
    },
    clear: () => {
      if (!isSafe()) return;
      try {
        window.localStorage.removeItem(opts.key);
      } catch {
        /* noop */
      }
    },
  };
};

/**
 * Convenience: a `PersistedKey<boolean>` slot. Reads `"true"` /
 * `"false"`; anything else returns the fallback.
 */
export const createPersistedBool = (key: string): PersistedKey<boolean> =>
  createPersistedKey({
    key,
    decode: (raw) => (raw === "true" ? true : raw === "false" ? false : null),
    encode: (value) => String(value),
  });

/**
 * Convenience: a `PersistedKey<T>` slot that round-trips through JSON
 * for arbitrary structured state.
 */
export const createPersistedJson = <T>(key: string): PersistedKey<T> =>
  createPersistedKey({
    key,
    decode: (raw) => {
      try {
        return JSON.parse(raw) as T;
      } catch {
        return null;
      }
    },
    encode: (value) => JSON.stringify(value),
  });
