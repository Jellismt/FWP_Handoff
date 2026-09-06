/**
 * @file points.ts
 * @module engage-mt/map/symbology
 * @description Point-layer default renderer factory. Produces a circle
 *              marker in the module's accent color, scaled by view zoom,
 *              with a white 1.5px outline so the marker pops over any
 *              basemap. Per-layer overrides live in `perLayer/*.ts`.
 *
 *              Branches to `iconSymbols.ts` when the
 *              layer id has a registered icon (FAS,
 *              gage, fire, etc.). Otherwise falls back to the
 *              circle marker. Theme is resolved at call-time via the
 *              themeStore so dark-mode flips re-render with the
 *              theme-correct badge ring.
 * @author Jamie Ellis / Engage MT
 * @created 2026-05-31
 * @updated 2026-06-06
 * @version 1.1.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import type { LayerDef } from "@/types/layers";
import { hexToRgba, moduleAccentHex } from "./colors";
import { sizeByScaleVisualVariable } from "./scale";
import { hasIconForLayer, pictureMarkerForLayer, type IconTheme } from "./iconSymbols";
import { asRendererProps } from "@/utils/esriCast";

/**
 * Read the current theme without importing the React store at module
 * top-level (the symbology layer must stay framework-agnostic). The
 * theme is materialized into a CSS attr on documentElement by useTheme.
 */
const currentTheme = (): IconTheme => {
  if (typeof document === "undefined") return "light";
  const scheme = document.body?.getAttribute("color-scheme");
  return scheme === "dark" ? "dark" : "light";
};

export const pointRenderer = (def: LayerDef): __esri.RendererProperties => {
  const boost = def.symbology?.sizeBoost ?? 1;
  // Icon-backed point layers branch here. The badge size grows
  // with zoom via the same visualVariable as the circle fallback, so the
  // FAS / gage / fire icons stay legible at all map scales.
  if (hasIconForLayer(def.id)) {
    const baseSize = 24 * boost;
    const theme = currentTheme();
    const symbol = pictureMarkerForLayer(def.id, theme);
    if (symbol) {
      return asRendererProps({
        type: "simple" as const,
        symbol,
        visualVariables: [sizeByScaleVisualVariable(baseSize)],
      });
    }
  }
  // Fallback — generic module-accent circle for layers without a
  // Registered icon. Keeps the cartography coherent for layers
  // didn't iconify.
  const accent = moduleAccentHex(def.module);
  const baseSize = 8 * boost;
  return asRendererProps({
    type: "simple" as const,
    symbol: {
      type: "simple-marker" as const,
      style: "circle" as const,
      color: hexToRgba(accent, 0.92),
      size: baseSize,
      outline: { color: [255, 255, 255, 0.95], width: 1.5 },
    },
    // Size-variable shrinks symbols at state extent so 336 FAS dots don't
    // mud-mix; grows them as the user zooms in.
    visualVariables: [sizeByScaleVisualVariable(baseSize)],
  });
};
