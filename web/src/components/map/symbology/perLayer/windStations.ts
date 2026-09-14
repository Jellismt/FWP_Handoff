/**
 * @file windStations.ts
 * @module engage-mt/map/symbology/perLayer
 * @description Per-layer renderer override for
 *              `engage-mt:wind-stations`. Replaces the geometry-family
 *              default circle with a class-break renderer that:
 *
 *                • Picks an arrow color by WIND_SPEED bucket
 *                  (calm / light / moderate / strong / severe — the same
 *                  buckets used)
 *                • Rotates the arrow glyph by WIND_DIRECT (degrees,
 *                  direction wind is blowing FROM per the Living Atlas
 *                  schema). ArcGIS visualVariable rotation accepts
 *                  either 'arithmetic' or 'geographic' — Living Atlas
 *                  ships the direction as compass degrees clockwise
 *                  from north, which matches 'geographic'.
 *
 *              The arrow glyph itself is the existing Lucide-style
 *              "Wind" path inlined as an SVG data URI. Sized 72px with a
 *              white inner stroke so it reads on satellite imagery.
 *
 *              the wind-arrow renderer uses the same
 *              five-bucket Beaufort-derived palette + degree-rotation.
 *              The popup card itself (WindStationCard.tsx) already
 *              renders the compass + Beaufort + condition
 *              narrative — no change there.
 *
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-02
 * @updated 2026-07-16
 * @version 1.2.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { asRendererProps } from "@/utils/esriCast";

/** Five Beaufort-derived buckets used; mph thresholds + colors. */
export const WIND_SPEED_BREAKS = [
  { max: 5, label: "Calm (0–5 mph)", color: "#6B7280" },
  { max: 15, label: "Light (5–15 mph)", color: "#2D8A5F" },
  { max: 25, label: "Moderate (15–25 mph)", color: "#FFC72C" },
  { max: 40, label: "Strong (25–40 mph)", color: "#E57200" },
  { max: 999, label: "Severe (≥40 mph)", color: "#C5283D" },
] as const;

/**
 * Build a 24×24 SVG arrow glyph data URI with the given fill color.
 * Solid color (no stroke) so the class-break color drives the read.
 * White outline so the arrow contrasts against the satellite basemap.
 */
function arrowDataUri(color: string): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="72" height="72" viewBox="0 0 28 28">` +
    `<g transform="translate(14,14)">` +
    // Arrow shaft + head, pointing up. The class-break rotation visual
    // variable spins this around the center per WIND_DIRECT.
    `<path d="M0 -10 L4 -2 L1.5 -2 L1.5 10 L-1.5 10 L-1.5 -2 L-4 -2 Z" ` +
    `fill="${color}" stroke="#ffffff" stroke-width="1.4" stroke-linejoin="round" />` +
    `</g></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/**
 * Build the class-break renderer for the wind-stations layer.
 * One class break per speed bucket; each break uses the bucket's color
 * to tint the arrow glyph. A single visualVariable spins the arrow by
 * WIND_DIRECT around the marker center.
 */
export function windStationsRenderer(): __esri.RendererProperties {
  return asRendererProps({
    type: "class-breaks",
    field: "WIND_SPEED",
    defaultSymbol: {
      type: "picture-marker",
      url: arrowDataUri("#6B7280"),
      width: 72,
      height: 72,
    },
    classBreakInfos: WIND_SPEED_BREAKS.map((b, i) => ({
      minValue: i === 0 ? -1 : WIND_SPEED_BREAKS[i - 1].max,
      maxValue: b.max,
      label: b.label,
      symbol: {
        type: "picture-marker",
        url: arrowDataUri(b.color),
        width: 72,
        height: 72,
      },
    })),
    visualVariables: [
      {
        type: "rotation",
        field: "WIND_DIRECT",
        rotationType: "geographic",
      },
    ],
  });
}
