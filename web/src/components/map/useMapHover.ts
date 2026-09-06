/**
 * @file useMapHover.ts
 * @module engage-mt/map
 * @description Hover affordance. Wires `view.on("pointer-move")`
 *              to a debounced hitTest and paints a white-halo highlight
 *              graphic on a dedicated GraphicsLayer for whichever feature
 *              the cursor is over. Switches cursor to `pointer` while
 *              hovering an interactive feature.
 *
 *              Touch devices skip the listener entirely — hover is a
 *              cartographic affordance that only makes sense with a
 *              mouse. Phone users get the existing tap behavior.
 *
 *              The highlight overlay reuses the same hitTest pattern
 * We already run on click, so the selected-feature
 *              pulse can layer on the same overlay without duplicating
 *              graphics-management code.
 * @author Jamie Ellis / Engage MT
 * @created 2026-05-31
 * @updated 2026-06-10
 * @version 1.2.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { useEffect, useRef } from "react";
import type EsriMapView from "@arcgis/core/views/MapView";
import GraphicsLayer from "@arcgis/core/layers/GraphicsLayer";
import Graphic from "@arcgis/core/Graphic";
import { hasIconForLayer } from "./symbology/iconSymbols";
import { markerSizeAtScale } from "./symbology/scale";

/** Debounce window for pointer-move hitTest — fast enough to feel live
 * but slow enough to spare the GPU. ~30ms = ~33Hz, well below browser
 * paint cadence so we don't drop frames. */
const HOVER_DEBOUNCE_MS = 30;

/** Layers that opt out of the hover halo. Currently empty — add a layer
 * id here when a layer's geometry makes the halo visually noisy rather
 * than useful as an affordance (e.g. dense polygons that cover large
 * areas). Click still works because click runs its own hitTest in
 * MapView; this only suppresses the hover overlay. */
const HOVER_SUPPRESS_LAYER_IDS: ReadonlySet<string> = new Set([]);

/**
 * The hover halo is a 2.5px white outline drawn around the hovered
 * feature's geometry. For points we render a transparent-fill circle
 * ring; for polygons + lines we use a simple outline symbol on the
 * geometry. Symbols cast from JSON at use time via ArcGIS autocast.
 *
 * Point sizing is computed per-hover (see `pointHaloSymbol`) rather than
 * fixed: a constant-size ring is smaller than our 24–31px icon markers and
 * gets swallowed by the glyph, so the affordance read inconsistently
 * across layers (visible on airy glyphs, invisible on dense ones like the
 * AIS inspection-station cluster icon). Sizing the ring to sit just outside the actual
 * marker — and tracking the same scale ramp the markers use — gives every
 * point feature the identical, legible hover ring.
 */
/** Base marker diameter (px) for icon-backed point layers — mirrors the
 * `baseSize = 24` used by the icon renderer in `symbology/points.ts`. */
const ICON_MARKER_BASE = 24;
/** Base diameter for the generic accent-circle fallback markers (8px). */
const CIRCLE_MARKER_BASE = 8;
/** Gap (px) between the marker edge and the halo ring, so the ring reads
 * as surrounding the marker rather than overlapping it. */
const HALO_GAP = 10;

/**
 * Build the point halo symbol sized to ring the hovered marker at the
 * current view scale. `iconBacked` selects the marker base size so the
 * ring hugs whichever symbol family the layer renders.
 */
const pointHaloSymbol = (scale: number, iconBacked: boolean) => {
  const base = iconBacked ? ICON_MARKER_BASE : CIRCLE_MARKER_BASE;
  const markerPx = markerSizeAtScale(base, scale);
  return {
    type: "simple-marker" as const,
    style: "circle" as const,
    color: [255, 255, 255, 0],
    size: markerPx + HALO_GAP,
    outline: { color: [255, 255, 255, 0.95], width: 2.5 },
  };
};

const POLYGON_HALO_SYMBOL = {
  type: "simple-fill" as const,
  color: [255, 255, 255, 0],
  outline: { color: [255, 255, 255, 0.95], width: 2.5 },
};

const LINE_HALO_SYMBOL = {
  type: "simple-line" as const,
  color: [255, 255, 255, 0.95],
  width: 3.5,
};

const isTouchDevice = (): boolean =>
  typeof window !== "undefined" &&
  ("ontouchstart" in window || (typeof navigator !== "undefined" && navigator.maxTouchPoints > 0));

export const useMapHover = (view: EsriMapView | null): void => {
  const overlayRef = useRef<GraphicsLayer | null>(null);
  const lastHitRef = useRef<string | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!view) return;
    // Skip on touch — no hover, no benefit; only cost.
    if (isTouchDevice()) return;

    const overlay = new GraphicsLayer({
      listMode: "hide",
      title: "__engage-mt-hover-overlay__",
    });
    overlayRef.current = overlay;
    view.map?.add(overlay);

    const clearHighlight = () => {
      overlay.removeAll();
      lastHitRef.current = null;
      view.container?.style.removeProperty("cursor");
    };

    const handle = view.on("pointer-move", (event) => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
      timerRef.current = window.setTimeout(() => {
        view
          .hitTest(event)
          .then((response) => {
            // Filter out our own overlay graphics so we don't self-halo,
            // and any layer that opted out of the hover affordance.
            const hits = response.results.filter((r) => {
              if (r.type !== "graphic" || !("graphic" in r)) return false;
              if (r.graphic.layer === overlay) return false;
              const layerId = String(r.graphic.layer?.id ?? "");
              if (HOVER_SUPPRESS_LAYER_IDS.has(layerId)) return false;
              return true;
            });
            if (hits.length === 0) {
              clearHighlight();
              return;
            }
            const hit = hits[0];
            if (hit.type !== "graphic") return;
            const g = (hit as { graphic: Graphic }).graphic;
            // Identify the feature by a fingerprint so we don't redraw
            // the halo on every pointer event while the cursor sits
            // over the same shape.
            const oid =
              (g.attributes && (g.attributes.OBJECTID ?? g.attributes.FID)) ??
              (g as unknown as { uid?: string }).uid ??
              "anon";
            const fingerprint = `${g.layer?.id ?? "anon"}::${oid}`;
            if (fingerprint === lastHitRef.current) return;
            lastHitRef.current = fingerprint;
            overlay.removeAll();
            const geomType = g.geometry?.type;
            let symbol: object | null = null;
            if (geomType === "point" || geomType === "multipoint") {
              const layerId = String(g.layer?.id ?? "");
              symbol = pointHaloSymbol(view.scale, hasIconForLayer(layerId));
            } else if (geomType === "polygon" || geomType === "extent") {
              symbol = POLYGON_HALO_SYMBOL;
            } else if (geomType === "polyline") {
              symbol = LINE_HALO_SYMBOL;
            }
            if (!symbol || !g.geometry) return;
            overlay.add(
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              new Graphic({ geometry: g.geometry, symbol: symbol as any }),
            );
            if (view.container) view.container.style.cursor = "pointer";
          })
          .catch(() => {
            // hitTest can reject during view transitions; ignore.
          });
      }, HOVER_DEBOUNCE_MS);
    });

    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      handle.remove();
      try {
        view.map?.remove(overlay);
      } catch {
        /* view already destroyed */
      }
      clearHighlight();
      overlayRef.current = null;
    };
  }, [view]);
};
