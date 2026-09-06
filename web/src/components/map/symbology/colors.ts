/**
 * @file colors.ts
 * @module engage-mt/map/symbology
 * @description Cartographic color helpers. The cardinal rule: ArcGIS
 *              Color autocast-from-array uses alpha 0..1 DECIMAL, not
 *              0..255 integer. Values > 1 are silently clamped to 1.0
 *              (fully opaque). All symbology rgba tuples in this module
 * And downstream files use decimal alpha. commit
 *              29ccc3b documents the bug + fix.
 * @author Jamie Ellis / Engage MT
 * @created 2026-05-31
 * @updated 2026-06-06
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import type { EngageMtModule } from "@/types/layers";

/** RGBA tuple with DECIMAL alpha 0..1 (not 0..255). */
export type Rgba = [number, number, number, number];

/**
 * Reads a CSS custom property from `:root`, returning the literal hex
 * if it resolves; otherwise the supplied fallback. Run at module load
 * to materialize the live brand palette into the symbology layer.
 */
const cssVar = (name: string, fallback: string): string => {
  if (typeof document === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v.length > 0 ? v : fallback;
};

/**
 * Land-tenure overlay colors. the
 * canonical owner of these layers is Access (BMA, WMA, Parks), but the
 * *visual* identity FWP users already trust is
 * lemon-lime / olive-sage / forest-green at ~40% opacity. We
 * key directly off the layer id so a future layer renamed elsewhere
 * still gets the right tier color.
 *
 * Returns null when the layer id has no overlay color and
 * the caller should fall back to the module accent.
 */
export interface TenureOverlay {
  fillHex: string;
  outlineHex: string;
  fillAlpha: number;
}

export const tenureOverlayFor = (layerId: string): TenureOverlay | null => {
  switch (layerId) {
    case "bma-boundaries":
      return {
        fillHex: cssVar("--fwp-overlay-bma", "#C6E22D"),
        outlineHex: cssVar("--fwp-overlay-bma-outline", "#7A9112"),
        fillAlpha: parseFloat(cssVar("--fwp-overlay-tier-opacity", "0.40")) || 0.4,
      };
    case "wma-boundaries":
      return {
        fillHex: cssVar("--fwp-overlay-wma", "#6A8B45"),
        outlineHex: cssVar("--fwp-overlay-wma-outline", "#4A6330"),
        fillAlpha: parseFloat(cssVar("--fwp-overlay-tier-opacity", "0.40")) || 0.4,
      };
    case "state-parks":
      return {
        fillHex: cssVar("--fwp-overlay-park", "#338033"),
        outlineHex: cssVar("--fwp-overlay-park-outline", "#1A5C1A"),
        fillAlpha: parseFloat(cssVar("--fwp-overlay-tier-opacity", "0.40")) || 0.4,
      };
    default:
      return null;
  }
};

/**
 * Resolves the module accent hex at call-time so theme flips
 * can be honored without restarting the module.
 */
export const moduleAccentHex = (module: EngageMtModule): string => {
  switch (module) {
    case "hunt":
      return cssVar("--fwp-accent-hunt", "#B3252E");
    case "fish":
      return cssVar("--fwp-accent-fish", "#002855");
    case "explore":
      return cssVar("--fwp-accent-explore", "#744F28");
    case "access":
      return cssVar("--fwp-accent-access", "#046A38");
    case "manage":
      return cssVar("--fwp-accent-manage", "#2D3748");
    default:
      return cssVar("--fwp-cta-primary", "#046A38");
  }
};

/**
 * Per-layer brand-color overrides for polygon symbology. Applied in BOTH
 * the map renderer (`polygonRenderer`) and the legend swatch (via
 * `polygonColorsFor`) so the two never diverge. Each entry is an
 * id-predicate → brand token (resolved at call-time so theme flips are
 * honored). Add a row here — never in one renderer only — to keep the
 * "legend === map" invariant.
 *   - Hunting Districts   → FWP brand orange  #E57200 (was hunt red)
 *   - Game Warden Districts → FWP brand green #046A38
 *   - Waterbody Closures  → closure red       #C5283D
 */
const POLYGON_ACCENT_OVERRIDES: ReadonlyArray<{
  match: (id: string) => boolean;
  varName: string;
  fallback: string;
}> = [
  {
    match: (id) => id.startsWith("hunting-districts"),
    varName: "--fwp-orange",
    fallback: "#E57200",
  },
  { match: (id) => id === "warden-districts", varName: "--fwp-green-dark", fallback: "#046A38" },
  { match: (id) => id === "waterbody-closures", varName: "--fwp-red", fallback: "#C5283D" },
];

/**
 * The brand color a polygon layer's symbology is forced to, or null when
 * the layer uses its normal module/tenure color. See POLYGON_ACCENT_OVERRIDES.
 */
export const polygonAccentOverride = (layerId: string): string | null => {
  for (const o of POLYGON_ACCENT_OVERRIDES) {
    if (o.match(layerId)) return cssVar(o.varName, o.fallback);
  }
  return null;
};

/** Parse `#RRGGBB` → [r,g,b]. */
const parseHex = (hex: string): [number, number, number] => {
  const clean = hex.replace("#", "");
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ];
};

/**
 * Convert `#RRGGBB` + decimal alpha 0..1 to an ArcGIS-compatible RGBA
 * tuple. Alpha stays in 0..1 — passing 0..255 here would silently
 * Render as fully opaque (the bug fixed).
 */
export const hexToRgba = (hex: string, alpha: number): Rgba => {
  const [r, g, b] = parseHex(hex);
  return [r, g, b, alpha];
};

/** Lighten or darken a hex by `pct` (negative = darken) in HSL space. */
export const shiftLightness = (hex: string, pct: number): string => {
  const [r, g, b] = parseHex(hex);
  // Convert RGB → HSL
  const rN = r / 255;
  const gN = g / 255;
  const bN = b / 255;
  const max = Math.max(rN, gN, bN);
  const min = Math.min(rN, gN, bN);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === rN) h = ((gN - bN) / d + (gN < bN ? 6 : 0)) / 6;
    else if (max === gN) h = ((bN - rN) / d + 2) / 6;
    else h = ((rN - gN) / d + 4) / 6;
  }
  // Adjust lightness
  const newL = Math.max(0, Math.min(1, l + pct / 100));
  // HSL → RGB
  const hue2rgb = (p: number, q: number, t: number): number => {
    let tn = t;
    if (tn < 0) tn += 1;
    if (tn > 1) tn -= 1;
    if (tn < 1 / 6) return p + (q - p) * 6 * tn;
    if (tn < 1 / 2) return q;
    if (tn < 2 / 3) return p + (q - p) * (2 / 3 - tn) * 6;
    return p;
  };
  let nr = newL;
  let ng = newL;
  let nb = newL;
  if (s !== 0) {
    const q = newL < 0.5 ? newL * (1 + s) : newL + s - newL * s;
    const p = 2 * newL - q;
    nr = hue2rgb(p, q, h + 1 / 3);
    ng = hue2rgb(p, q, h);
    nb = hue2rgb(p, q, h - 1 / 3);
  }
  const toHex = (x: number): string =>
    Math.round(x * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(nr)}${toHex(ng)}${toHex(nb)}`;
};
