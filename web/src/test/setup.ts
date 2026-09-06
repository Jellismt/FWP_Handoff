/**
 * @file setup.ts
 * @module engage-mt/test
 * @description Vitest setup — extends expect with jest-dom matchers + provides a
 *              window.matchMedia polyfill that happy-dom doesn't ship by default.
 * @author Jamie Ellis / Engage MT
 * @created 2026-05-29
 * @updated 2026-06-28
 * @version 1.1.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import "@testing-library/jest-dom/vitest";

// Happy-dom ships a Storage class but in some test contexts the
// global `localStorage` reference is shadowed by a non-conforming object
// (observed: `storage.setItem is not a function` when zustand persist runs
// in tests). Install a minimal in-memory polyfill so the persist
// middleware can write through without depending on the DOM.
//
// Hygiene: probe the property *descriptor* rather than reading
// `window[key]`. Under Node 25 + happy-dom 20 the `window.localStorage`
// getter delegates to Node's experimental Web Storage, so merely *reading*
// it emits `--localstorage-file was provided without a valid path` on every
// worker. `getOwnPropertyDescriptor` inspects without invoking the getter,
// and `defineProperty` installs our in-memory data property as an own prop
// that shadows the native accessor — the getter is never touched.
if (typeof window !== "undefined") {
  const ensureStorage = (key: "localStorage" | "sessionStorage"): void => {
    const existing = Object.getOwnPropertyDescriptor(window, key);
    if (existing && typeof existing.value?.setItem === "function") return;
    const store = new Map<string, string>();
    const impl = {
      get length() {
        return store.size;
      },
      clear: () => store.clear(),
      getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
      key: (i: number) => Array.from(store.keys())[i] ?? null,
      removeItem: (k: string) => {
        store.delete(k);
      },
      setItem: (k: string, v: string) => {
        store.set(k, String(v));
      },
    };
    Object.defineProperty(window, key, { value: impl, writable: true, configurable: true });
  };
  ensureStorage("localStorage");
  ensureStorage("sessionStorage");
}

if (!window.matchMedia) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}
