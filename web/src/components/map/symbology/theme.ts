/**
 * @file theme.ts
 * @module engage-mt/map/symbology
 * @description Dark-mode cartographic parity. Brand fills
 *              tuned for the light hybrid basemap go ghostly on the
 *              dark satellite basemap; we boost alpha + lighten outline
 *              colors in dark mode so every layer's identity holds.
 *
 *              Approach: a single `getTheme()` reads the active mode
 *              from the document attribute the theme store already
 *              writes (`data-color-scheme`). Renderer factories call
 *              `alphaForTheme(0.24)` instead of `0.24` directly so
 *              the symbology dispatcher can re-evaluate alpha at the
 *              moment of rendering without each factory having to know
 *              about themes.
 *
 *              The renderer rebuild on theme flip is wired in MapView:
 *              the theme subscription re-runs `getRenderer(def)` for
 *              every layer and reassigns the `renderer` property.
 *              Because `moduleAccentHex()` reads CSS custom properties
 *              at call-time, the accent already flips automatically
 *              (e.g., access from #046A38 green → #FFC72C yellow on
 * Dark This module just tunes the alphas.
 * @author Jamie Ellis / Engage MT
 * @created 2026-05-31
 * @updated 2026-06-06
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

export type ThemeMode = "light" | "dark";

/**
 * Resolve the active theme by reading `data-color-scheme` on the root
 * element. The theme store keeps this in sync; renderer authors call
 * this rather than importing the store so symbology stays a leaf
 * dependency (no React imports in the renderer pipeline).
 */
const getTheme = (): ThemeMode => {
  if (typeof document === "undefined") return "light";
  const v = document.documentElement.getAttribute("data-color-scheme");
  return v === "dark" ? "dark" : "light";
};

/**
 * Multiply a light-mode alpha for the current theme. Dark-mode alphas
 * boost ×1.4 (cap at 0.95) so brand fills stay readable against the
 * dark satellite basemap. Light mode passes through unchanged.
 *
 * Tuned against the existing brand palette: polygon habitat fill of
 * 0.24 light → 0.336 dark sits perceptually about right for WMA fills
 * on the FWP Blue dark mode satellite.
 */
export const alphaForTheme = (lightAlpha: number): number => {
  if (getTheme() === "dark") {
    return Math.min(0.95, lightAlpha * 1.4);
  }
  return lightAlpha;
};
