/**
 * @file patterns.ts
 * @module engage-mt/map/symbology
 * @description CIM-based hatched fill patterns for
 *              "overlay" polygon role. ArcGIS Maps SDK 4.x's `simple-fill`
 *              symbol only supports solid color; for true cartographic
 *              texture (45° diagonal lines for BMA permission overlays)
 *              we need a CIM
 *              symbol — the SDK's Cartographic Information Model. CIM
 *              fills support `CIMHatchFill` and `CIMVectorMarker`-as-fill,
 *              which we use here.
 *
 *              These factories return CIMSymbolReference JSON suitable for
 *              `renderer.symbol` on a SimpleRenderer. The dispatcher in
 *              `polygons.ts` chooses between solid-fill (habitat /
 *              boundary / default) and CIM-fill (overlay) by role.
 *
 *              Reference: ArcGIS REST CIM spec §8.4.6 (CIMHatchFill) and
 *              §8.5.2 (CIMVectorMarker). We use shipped pattern primitives
 *              rather than embedding raster swatches so symbols stay
 *              vector-crisp at every zoom.
 * @author Jamie Ellis / Engage MT
 * @created 2026-05-31
 * @updated 2026-06-06
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { hexToRgba } from "./colors";

/** ArcGIS Color JSON: `[r, g, b]` ints + alpha 0..100 (CIM uses 0..100). */
const cimColor = (hex: string, alpha100: number) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return { type: "CIMRGBColor", values: [r, g, b, alpha100] };
};

/**
 * 45° diagonal hatched fill — for BMA permission overlays. The hatch
 * lines are drawn in the accent color at 65% opacity; the underlying fill
 * is a light wash at 10% opacity so the overall polygon reads as "marked"
 * without obliterating what's underneath.
 */
const hatchedOverlaySymbol = (accentHex: string) => ({
  type: "cim",
  data: {
    type: "CIMSymbolReference",
    symbol: {
      type: "CIMPolygonSymbol",
      symbolLayers: [
        // Hatch strokes (drawn first → render on top of background fill).
        {
          type: "CIMHatchFill",
          enable: true,
          rotation: 45,
          separation: 6,
          offsetX: 0,
          offsetY: 0,
          lineSymbol: {
            type: "CIMLineSymbol",
            symbolLayers: [
              {
                type: "CIMSolidStroke",
                enable: true,
                width: 0.75,
                color: cimColor(accentHex, 65),
              },
            ],
          },
        },
        // Background wash — keeps the polygon legible even when the
        // hatch lines fall on contrast-poor basemap.
        {
          type: "CIMSolidFill",
          enable: true,
          color: cimColor(accentHex, 10),
        },
        // Outer stroke — 1px accent, 70% alpha. Reads as the polygon
        // boundary at every zoom.
        {
          type: "CIMSolidStroke",
          enable: true,
          width: 1,
          color: cimColor(accentHex, 70),
        },
      ],
    },
  },
});

/**
 * Cross-hatched fill — two CIMHatchFill layers at +45° and −45° so the
 * polygon reads as crossed diagonal lines (a stronger "closed / restricted"
 * cue than a single-direction hatch). Used by Waterbody Closures &
 * Restrictions, drawn in the closure red.
 */
const crossHatchedOverlaySymbol = (accentHex: string) => {
  const hatchLayer = (rotation: number) => ({
    type: "CIMHatchFill",
    enable: true,
    rotation,
    separation: 6,
    offsetX: 0,
    offsetY: 0,
    lineSymbol: {
      type: "CIMLineSymbol",
      symbolLayers: [
        {
          type: "CIMSolidStroke",
          enable: true,
          width: 0.75,
          color: cimColor(accentHex, 70),
        },
      ],
    },
  });
  return {
    type: "cim",
    data: {
      type: "CIMSymbolReference",
      symbol: {
        type: "CIMPolygonSymbol",
        symbolLayers: [
          // Both hatch directions render on top of the wash → crossed lines.
          hatchLayer(45),
          hatchLayer(-45),
          // Background wash — keeps the polygon legible on any basemap.
          {
            type: "CIMSolidFill",
            enable: true,
            color: cimColor(accentHex, 10),
          },
          // Outer stroke — the red polygon boundary at every zoom.
          {
            type: "CIMSolidStroke",
            enable: true,
            width: 1.2,
            color: cimColor(accentHex, 85),
          },
        ],
      },
    },
  };
};

/**
 * Choose the CIM symbol for an overlay polygon. Waterbody closures use the
 * red cross-hatch; every other overlay uses the 45° single hatch. Return
 * widened to `unknown`; ArcGIS autocasts the raw JSON at assignment time.
 */
export const overlaySymbolForLayer = (layerId: string, accentHex: string): unknown =>
  layerId === "waterbody-closures"
    ? crossHatchedOverlaySymbol(accentHex)
    : hatchedOverlaySymbol(accentHex);

/**
 * Convenience: read `hexToRgba` through the same alpha convention as the
 * rest of the dispatcher. Re-exported so consumers can stay on one import.
 */
export { hexToRgba };
