/**
 * @file themeStore.ts
 * @module engage-mt/store
 * @description Zustand store for light/dark/system theme preference.
 *              Persists via the shared `persistedKey` helper
 *              so the SSR-safe localStorage I/O lives in one place
 *              instead of three copies.
 * @author Jamie Ellis / Engage MT
 * @created 2026-05-29
 * @updated 2026-07-03
 * @version 1.2.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { create } from "zustand";
import { createPersistedKey } from "@/store/persistedKey";

export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

const DEFAULT_PREFERENCE: ThemePreference = "system"; // Auto-follow OS by default
const ALLOWED: readonly ThemePreference[] = ["light", "dark", "system"];
const slot = createPersistedKey<ThemePreference>({
  key: "engage-mt:theme",
  decode: (raw) => (ALLOWED.includes(raw as ThemePreference) ? (raw as ThemePreference) : null),
  encode: (value) => value,
});

interface ThemeState {
  preference: ThemePreference;
  resolved: ResolvedTheme;
  setPreference: (next: ThemePreference) => void;
}

const systemPrefersDark = (): boolean => {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
};

const resolve = (pref: ThemePreference): ResolvedTheme => {
  if (pref === "system") return systemPrefersDark() ? "dark" : "light";
  return pref;
};

const initialPreference = slot.read(DEFAULT_PREFERENCE);

export const useThemeStore = create<ThemeState>((set) => ({
  preference: initialPreference,
  resolved: resolve(initialPreference),
  setPreference: (next) => {
    slot.write(next);
    set({ preference: next, resolved: resolve(next) });
  },
}));
