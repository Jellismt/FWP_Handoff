/**
 * @file routePrefetch.ts
 * @module engage-mt/utils
 * @description Route-prefetch-on-intent registry. Components call
 *              `prefetchRoute(path)` on pointer-enter / focus to trigger the
 *              dynamic import for a lazy route's chunk before the user commits
 *              to navigating — so the transition feels instant. No network
 *              request fires twice: the browser (and Vite's module cache) dedup
 *              concurrent imports of the same specifier.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-16
 * @updated 2026-06-16
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

/** Import factory — same signature passed to React.lazy(). */
type ImportFactory = () => Promise<unknown>;

const registry = new Map<string, ImportFactory>();

/**
 * Register an import factory for a route path. Called once at app startup
 * (typically in App.tsx alongside the React.lazy declarations) so no import
 * factory leaks outside its originating module.
 *
 * @param path — The route path prefix, e.g. `"/hunt"`.
 * @param factory — The dynamic-import factory, e.g.
 *                  `() => import("@/components/hunt/HuntPage")`.
 */
export function registerPrefetch(path: string, factory: ImportFactory): void {
  registry.set(path, factory);
}

/**
 * Trigger the prefetch for a registered route path. Safe to call on every
 * pointer-enter — the browser deduplicates concurrent or already-resolved
 * imports of the same module specifier. No-ops silently for unknown paths.
 */
export function prefetchRoute(path: string): void {
  const factory = registry.get(path);
  if (factory) {
    void factory();
  }
}

/**
 * Spread onto any link or button that leads to a registered route so the
 * destination chunk starts loading on hover and keyboard focus.
 */
export const prefetchProps = (
  path: string,
): { onPointerEnter: () => void; onFocus: () => void } => ({
  onPointerEnter: () => prefetchRoute(path),
  onFocus: () => prefetchRoute(path),
});
