/**
 * @file lines.ts
 * @module engage-mt/map/symbology
 * @description Line-layer default renderer factory. Water lines get the
 *              bright water-blue token; trail lines render as a plain brown
 *              stroke with no white casing (they should read as ground
 *              routes, not highlighted features); everything else gets the
 *              module accent inside a soft white halo.
 * @author Jamie Ellis / Engage MT
 * @created 2026-05-31
 * @updated 2026-07-16
 * @version 1.1.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import type { LayerDef } from "@/types/layers";
import { moduleAccentHex } from "./colors";
import { asRendererProps } from "@/utils/esriCast";
import { cssVarToHex } from "@/utils/cssVarToHex";

// Layers that represent water (lakes / rivers / streams) get
// the dedicated --fwp-water bright-blue token instead of the module
// accent. List is small enough to maintain explicitly; extend when new
// hydro layers land.
const WATER_LAYER_IDS = new Set<string>(["major-rivers"]);

// Trail polylines — every child of the `engage-mt:trails` composite. Rendered
// as a plain brown stroke with NO white casing.
const TRAIL_LAYER_IDS = new Set<string>([
  "trails-usfs-nfs",
  "trails-nps-glacier",
  "trails-nps-yellowstone",
  "trails-lewis-clark",
  "trails-missoula-county",
  "trails-bozeman-gvlt",
]);

const TRAIL_BROWN = "#8B4513";

/**
 * The colour this layer's lines are drawn in. Exported so the layer-panel
 * legend swatch paints from the SAME decision the map does — a legend that
 * disagrees with the map is worse than no legend (the rivers legend showed
 * the yellow module accent while the map drew them water-blue). Any new
 * per-layer line colour belongs here, not in a renderer branch.
 */
export const lineColorFor = (def: LayerDef): string => {
  if (TRAIL_LAYER_IDS.has(def.id)) return TRAIL_BROWN;
  if (WATER_LAYER_IDS.has(def.id)) return cssVarToHex("var(--fwp-water)") || "#0094D6";
  return moduleAccentHex(def.module);
};

export const lineRenderer = (def: LayerDef): __esri.RendererProperties => {
  if (TRAIL_LAYER_IDS.has(def.id)) {
    return asRendererProps({
      type: "simple" as const,
      symbol: {
        type: "simple-line" as const,
        color: TRAIL_BROWN,
        width: 1.75,
        style: "solid" as const,
        cap: "round" as const,
        join: "round" as const,
      },
    });
  }
  const isWater = WATER_LAYER_IDS.has(def.id);
  const color = lineColorFor(def);
  // Line "casing." ArcGIS doesn't accept a per-symbol outline on
  // simple-line, so we emit a CIMSymbol with two stacked strokes: a wider,
  // slightly translucent white halo on the outside, the accent stroke on
  // top. Result: streams + road lines read cleanly against satellite imagery
  // AND against the FWP topo basemap without "disappearing into the picture."
  // Cohesive with point + polygon outlines (every geometry now carries a
  // contrasting halo at rest).
  const haloWidthPx = isWater ? 3.6 : 3.75;
  const strokeWidthPx = isWater ? 1.6 : 1.75;
  return asRendererProps({
    type: "simple" as const,
    symbol: {
      type: "cim" as const,
      data: {
        type: "CIMSymbolReference",
        symbol: {
          type: "CIMLineSymbol",
          symbolLayers: [
            {
              type: "CIMSolidStroke",
              enable: true,
              capStyle: "Round",
              joinStyle: "Round",
              width: strokeWidthPx,
              color: hexToRgbaArray255(color, isWater ? 0.95 : 0.85),
            },
            {
              type: "CIMSolidStroke",
              enable: true,
              capStyle: "Round",
              joinStyle: "Round",
              width: haloWidthPx,
              color: [255, 255, 255, 178], // 0.7 alpha — soft halo
            },
          ],
        },
      },
    },
  });
};

function hexToRgbaArray255(hex: string, alpha: number): [number, number, number, number] {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return [r, g, b, Math.round(alpha * 255)];
}
