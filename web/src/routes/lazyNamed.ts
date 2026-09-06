/**
 * @file lazyNamed.ts
 * @module engage-mt/routes
 * @description A tiny wrapper over `React.lazy` for our named-export
 *              components. Every route component in Engage MT is a named export
 *              (`export const HuntPage = …`), so without it the route table would repeat
 *              the same 4-7-line block per component:
 *
 *                const HuntPage = lazy(() =>
 *                  import("@/components/hunt/HuntPage").then((m) => ({ default: m.HuntPage })),
 *                );
 *
 *              `lazyNamed` collapses that to one line while keeping the literal
 *              `import(...)` specifier intact — which is load-bearing: Vite/Rollup
 *              can only code-split an import whose specifier is a static string
 *              literal, so the caller MUST pass the thunk `() => import("…literal…")`
 *              (never a variable path) for per-route chunking to survive.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-03
 * @updated 2026-07-03
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { lazy, type ComponentType, type LazyExoticComponent } from "react";

/**
 * Wrap `React.lazy` for a module that exports the component as a **named**
 * export. `loader` MUST contain a literal `import("…")` (so bundlers can split
 * it); `name` is the export key on that module.
 *
 * @example
 *   const HuntPage = lazyNamed(() => import("@/components/hunt/HuntPage"), "HuntPage");
 */
export function lazyNamed<
  TName extends string,
  TModule extends Record<TName, ComponentType<Record<string, never>>>,
>(loader: () => Promise<TModule>, name: TName): LazyExoticComponent<TModule[TName]> {
  return lazy(() => loader().then((m) => ({ default: m[name] })));
}
