/**
 * @file useMediaQuery.ts
 * @module engage-mt/hooks
 * @description Subscribe to a CSS media query and re-render when it flips.
 *              SSR/test-safe (returns false when `matchMedia` is absent).
 *              Used by TapQueryPanel to switch between the mobile
 *              full-bleed sheet and the desktop/tablet right-docked rail.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-07
 * @updated 2026-07-07
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { useEffect, useState } from "react";

const evaluate = (query: string): boolean =>
  typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia(query).matches
    : false;

/**
 * Returns whether `query` currently matches, updating on viewport changes.
 * Example: `const isDesktop = useMediaQuery("(min-width: 1024px)")`.
 */
export const useMediaQuery = (query: string): boolean => {
  const [matches, setMatches] = useState<boolean>(() => evaluate(query));

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return undefined;
    const mql = window.matchMedia(query);
    const onChange = (): void => setMatches(mql.matches);
    onChange(); // sync in case the query changed between render and effect
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);

  return matches;
};
