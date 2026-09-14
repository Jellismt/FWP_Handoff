/**
 * @file index.ts
 * @module engage-mt/map/symbology
 * @description Single dispatcher for layer renderers. the load-
 *              bearing piece — every later phase (clustering, polygon
 *              hierarchy, hover, labels, dark-mode parity) reads through
 *              this entry. Per-layer overrides live in `./perLayer/*.ts`
 *              and are keyed by `def.id`; the generic geometry-family
 *              defaults live in `./points.ts`, `./polygons.ts`,
 *              `./lines.ts`.
 *
 *              Critical invariant: ArcGIS Color autocast-from-array uses
 * Alpha 0..1 DECIMAL. documents this; downstream
 *              renderer authors must NOT pass alphas in the 0..255 range.
 * @author Jamie Ellis / Engage MT
 * @created 2026-05-31
 * @updated 2026-06-10
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import type { LayerDef } from "@/types/layers";
import { pointRenderer } from "./points";
import { polygonRenderer } from "./polygons";
import { lineRenderer } from "./lines";
import { windStationsRenderer } from "./perLayer/windStations";

/**
 * Resolve the renderer for a given LayerDef. Falls back to the
 * geometry-family default when no per-layer override is present.
 *
 * Will add a `theme` parameter so renderers can shift alpha
 * + saturation for dark mode; right now the function is theme-agnostic
 * because alpha changes via CSS-var-on-document-root + accent flip
 * already cover most of the dark-mode polish.
 *
 * Per-layer overrides land here as named cases above the
 * geometry-family fallback. Wind stations need a class-break renderer
 * driven by WIND_SPEED + rotation by WIND_DIRECT; the generic point
 * renderer (which returns a single-color circle) can't express that.
 */
export const getRenderer = (def: LayerDef): __esri.RendererProperties | null => {
  if (def.id === "engage-mt:wind-stations") return windStationsRenderer();
  switch (def.geometry) {
    case "point":
      return pointRenderer(def);
    case "polygon":
      return polygonRenderer(def);
    case "line":
      return lineRenderer(def);
    default:
      return null;
  }
};
