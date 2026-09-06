/**
 * @file capacitorPreferencesStorage.ts
 * @module engage-mt/store
 * @description Zustand `StateStorage` adapter backed by
 *              `@capacitor/preferences` on Capacitor and falling back to
 *              `localStorage` on web. Used by stores whose state MUST
 *              survive an iOS / Android app uninstall + reinstall with
 *              backup, where `localStorage` inside the WKWebView is
 *              flushed but Preferences (which lives in the app container)
 *              persists.
 *
 *              Implementation:
 *                - On the web path, the methods are simple sync wrappers
 *                  over `window.localStorage` so the surface stays
 *                  identical to `createJSONStorage(() => localStorage)`.
 *                - On Capacitor, every method returns a Promise. Zustand
 *                  `persist` waits on the async getItem before reaching
 *                  the rehydration step.
 *                - Plugin loaded via dynamic import so the
 *                  web bundle isn't polluted by the Capacitor SDK.
 *
 *              Per [docs/rules/mobile.md § Platform guards](../../../docs/rules/mobile.md)
 *              + [docs/rules/privacy.md](../../../docs/rules/privacy.md):
 *              the storage lives on-device. Nothing leaves until the user
 *              explicitly initiates a share / export action.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-09
 * @updated 2026-07-01
 * @version 1.1.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import type { StateStorage } from "zustand/middleware";
import { isCapacitor } from "@/utils/capacitor";
import { createLogger } from "@/utils/logger";

const log = createLogger("preferences-storage");

const webStorage: StateStorage = {
  getItem: (name) => {
    try {
      return window.localStorage.getItem(name);
    } catch {
      return null;
    }
  },
  setItem: (name, value) => {
    try {
      window.localStorage.setItem(name, value);
    } catch {
      /* quota / private mode — drop */
    }
  },
  removeItem: (name) => {
    try {
      window.localStorage.removeItem(name);
    } catch {
      /* noop */
    }
  },
};

// Cache the MODULE-NAMESPACE promise — never a promise that resolves to the
// `Preferences` plugin proxy. Capacitor's plugin proxy returns a function for
// ANY property access (including `then`), so it looks like a thenable: if it
// ever becomes a promise's resolution value, the Promise-unwrap machinery calls
// `Preferences.then(resolve, reject)`, which the bridge forwards to native and
// dies with `"Preferences.then() is not implemented on android"`. Keeping the
// namespace (which has no `then` export) as the resolved value and destructuring
// `Preferences` synchronously at each call site avoids that entirely.
let prefsModulePromise: Promise<typeof import("@capacitor/preferences")> | null = null;

const loadPreferencesModule = (): Promise<typeof import("@capacitor/preferences")> => {
  if (!prefsModulePromise) {
    prefsModulePromise = import("@capacitor/preferences");
  }
  return prefsModulePromise;
};

const capacitorStorage: StateStorage = {
  getItem: async (name) => {
    try {
      const { Preferences } = await loadPreferencesModule();
      const { value } = await Preferences.get({ key: name });
      return value;
    } catch (err) {
      log.warn("getItem failed", { name, error: err instanceof Error ? err.message : err });
      return null;
    }
  },
  setItem: async (name, value) => {
    try {
      const { Preferences } = await loadPreferencesModule();
      await Preferences.set({ key: name, value });
    } catch (err) {
      log.warn("setItem failed", { name, error: err instanceof Error ? err.message : err });
    }
  },
  removeItem: async (name) => {
    try {
      const { Preferences } = await loadPreferencesModule();
      await Preferences.remove({ key: name });
    } catch (err) {
      log.warn("removeItem failed", { name, error: err instanceof Error ? err.message : err });
    }
  },
};

/**
 * Returns the storage adapter that matches the current platform. Call this
 * once at module load and pass to `createJSONStorage(() => …)`.
 */
export const platformStorage = (): StateStorage => (isCapacitor() ? capacitorStorage : webStorage);
