/**
 * @file polygons.ts
 * @module engage-mt/map/symbology
 * @description Polygon-layer renderer factories keyed by `polygonRole`
 *. Three roles enforce a visual hierarchy:
 *
 *              - `habitat`  — solid fill, heavy outline. Read FIRST.
 *                              (WMA, State Parks, BMA)
 *              - `boundary` — outline only, no fill. Read SECOND.
 *                              (hunting districts)
 *              - `overlay`  — textured fill (hatched) at low
 *                              opacity. Read THIRD. Multiply blend on
 *                              the layer so triple-overlap doesn't mud.
 *                              (BMA)
 *
 *              When `polygonRole` is missing on the LayerDef, we fall
 *              back to a generic "subtle fill + accent outline" that
 *              matches the pre-Phase-1 behavior.
 * @author Jamie Ellis / Engage MT
 * @created 2026-05-31
 * @updated 2026-07-14
 * @version 1.0.1
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import type { LayerDef } from "@/types/layers";
import { hexToRgba, moduleAccentHex, polygonAccentOverride, tenureOverlayFor } from "./colors";
import { overlaySymbolForLayer } from "./patterns";
import { alphaForTheme } from "./theme";
import { asRendererProps } from "@/utils/esriCast";
import { cssVarToHex } from "@/utils/cssVarToHex";

// Polygon layers that represent water read --fwp-water
// instead of the module accent so they join streams as one connected
// hydro family. Mirrors the WATER_LAYER_IDS Set in lines.ts; keep the
// two lists in sync as new hydro layers land. Currently empty — add a
// layer id when a water polygon layer needs the water-token fallback.
const WATER_POLYGON_IDS = new Set<string>(["major-lakes"]);

/**
 * The fill/outline colours this layer's polygons are drawn in. Exported for
 * the legend swatch so it paints from the SAME decision as the map (see the
 * note on `lineColorFor`). Any new per-layer polygon colour belongs here.
 */
export const polygonColorsFor = (def: LayerDef): { fillHex: string; outlineHex: string } => {
  if (def.id === "wildlife-biologist-coverage") {
    return { fillHex: "#808080", outlineHex: "#ffffff" };
  }
  // Cadastral parcels draw as a white outline with NO fill on the map (see the
  // mt-cadastral branch in polygonRenderer) — the legend reads the same white so
  // the swatch matches the parcel grid.
  if (def.id === "mt-cadastral") {
    return { fillHex: "#ffffff", outlineHex: "#ffffff" };
  }
  // Per-layer brand-color override (hunting districts / warden districts /
  // waterbody closures) wins over the module + tenure palette so the legend
  // paints the exact color the map does.
  const override = polygonAccentOverride(def.id);
  const water = WATER_POLYGON_IDS.has(def.id) ? cssVarToHex("var(--fwp-water)") || "#0094D6" : null;
  const tenure = tenureOverlayFor(def.id);
  const fillHex = override ?? water ?? tenure?.fillHex ?? moduleAccentHex(def.module);
  const outlineHex = def.id.startsWith("district-portions-")
    ? cssVarToHex("var(--fwp-yellow)") || "#FFC72C"
    : (override ?? tenure?.outlineHex ?? fillHex);
  return { fillHex, outlineHex };
};

export const polygonRenderer = (def: LayerDef): __esri.RendererProperties => {
  // Cadastral parcels render as a thin, 50%-translucent white
  // outline with NO fill. Cadastral is the omnipresent ownership-grid
  // layer; overlays + tinted fills here muddy every other
  // layer below them. A subtle white parcel-line grid (a common consumer-map cue) lets
  // the satellite basemap + every overlay continue to read while still
  // surfacing the ownership skeleton. Special-cased here because the
  // The tenure palette doesn't have a "neutral grid" tier.
  if (def.id === "mt-cadastral") {
    return asRendererProps({
      type: "simple" as const,
      symbol: {
        type: "simple-fill" as const,
        color: [0, 0, 0, 0],
        outline: { color: [255, 255, 255, 0.5], width: 0.6 },
      },
    });
  }

  // Wildlife Biologist Areas — normal grey fill at the default overlay
  // transparency with a white outline so the responsibility areas read as
  // neutral reference polygons on any basemap (not the hunt-red accent).
  if (def.id === "wildlife-biologist-coverage") {
    return asRendererProps({
      type: "simple" as const,
      symbol: {
        type: "simple-fill" as const,
        color: hexToRgba("#808080", alphaForTheme(0.18)),
        outline: { color: [255, 255, 255, 0.9], width: 1.5 },
      },
    });
  }

  // Water polygons override the module accent with the
  // bright FWP water token before role-specific styling kicks in.
  const water = WATER_POLYGON_IDS.has(def.id) ? cssVarToHex("var(--fwp-water)") || "#0094D6" : null;

  // Land-tenure overlay palette. For the
  // BMA/WMA/Parks/Easements layers we override the module accent with
  // the tested tier color (lemon-lime / olive-sage / forest-green / mint
  // at ~40% opacity) so the visual identity FWP users already trust
  // carries through, regardless of the canonical-ownership module.
  const tenure = tenureOverlayFor(def.id);

  // Per-layer brand-color override (hunting districts → orange, warden
  // districts → green, waterbody closures → red) — same source the legend
  // swatch reads via polygonColorsFor, so the two stay in lockstep.
  const override = polygonAccentOverride(def.id);
  const accent = override ?? water ?? tenure?.fillHex ?? moduleAccentHex(def.module);
  // District-portion polygons read in the theme yellow/gold rather than the
  // hunt-red module accent, so the species portions stand apart on the map.
  const isDistrictPortion = def.id.startsWith("district-portions-");
  const outlineHex = isDistrictPortion
    ? cssVarToHex("var(--fwp-yellow)") || "#FFC72C"
    : (override ?? tenure?.outlineHex ?? accent);
  const role = def.symbology?.polygonRole ?? "default";

  if (role === "habitat") {
    // Filled destination. WMA, State Parks. Read first.
    return asRendererProps({
      type: "simple" as const,
      symbol: {
        type: "simple-fill" as const,
        color: hexToRgba(accent, alphaForTheme(tenure ? tenure.fillAlpha : 0.24)),
        outline: { color: hexToRgba(outlineHex, 0.95), width: 2 },
      },
    });
  }

  if (role === "boundary") {
    // No fill, heavy outline only. Hunting districts, fishing districts.
    return asRendererProps({
      type: "simple" as const,
      symbol: {
        type: "simple-fill" as const,
        // Transparent fill — the polygon outline carries the meaning.
        color: [0, 0, 0, 0],
        outline: { color: hexToRgba(outlineHex, 0.85), width: 2 },
      },
    });
  }

  if (role === "overlay") {
    // Textured fill via CIMHatchFill (45° hatch for BMA permission
    // overlays). MapView additionally sets
    // `layer.blendMode = "multiply"` for overlay-role layers so triple-
    // overlap with habitat layers darkens cleanly instead of muddying.
    return asRendererProps({
      type: "simple" as const,
      symbol: overlaySymbolForLayer(def.id, accent),
    });
  }

  // Default fallback — preserves pre-Phase-1 look for any registered
  // polygon layer without explicit role. For tier-overlay layers
  // without a declared role, still apply the tenure palette so we don't
  // silently regress.
  return asRendererProps({
    type: "simple" as const,
    symbol: {
      type: "simple-fill" as const,
      color: hexToRgba(accent, alphaForTheme(tenure ? tenure.fillAlpha : 0.18)),
      outline: { color: hexToRgba(outlineHex, 0.9), width: 1.5 },
    },
  });
};
