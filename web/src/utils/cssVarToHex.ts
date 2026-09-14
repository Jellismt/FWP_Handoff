/**
 * @file cssVarToHex.ts
 * @module engage-mt/utils
 * @description Resolve a `var(--token)` string to its
 *              computed hex (or `rgb(...)`) value, suitable for SDK
 *              renderers that cannot read CSS custom properties
 *              (ArcGIS Graphic symbols, canvas, etc.). Reads off
 *              `document.body` at call time so light/dark theme
 *              flips pick up on the next re-render.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-02
 * @updated 2026-06-06
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

const FALLBACK = "#1B3D6B"; // FWP Blue mid — safe default if SSR

/**
 * Resolve `var(--fwp-token)` to its currently-computed value.
 * Pass any plain hex through untouched.
 *
 * @example
 *   cssVarToHex("var(--fwp-cta-primary)") // "#046A38"
 *   cssVarToHex("#fff") // "#fff"
 */
export const cssVarToHex = (cssVar: string): string => {
  if (typeof document === "undefined") return FALLBACK;
  const match = cssVar.match(/var\((--[a-z0-9-]+)\)/i);
  const tokenName = match ? match[1] : cssVar;
  if (!tokenName.startsWith("--")) return cssVar;
  const computed = getComputedStyle(document.body).getPropertyValue(tokenName).trim();
  return computed || FALLBACK;
};
