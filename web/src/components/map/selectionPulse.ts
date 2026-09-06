/**
 * @file selectionPulse.ts
 * @module engage-mt/map
 * @description Selection-pulse microinteraction. When a tap
 *              hits a feature, drop a brief expanding-ring graphic at
 *              the tap point so users get a tactile "I see your tap"
 *              confirmation before the side panel / takeover renders.
 *
 *              The pulse rides on its own GraphicsLayer with
 *              `listMode: 'hide'` so it doesn't show up in LayerPanel
 *              and the hover halo's hitTest filter ignores it. One
 *              pulse at a time — a second tap clears the prior pulse
 *              before starting its own.
 *
 *              Respects `prefers-reduced-motion: reduce` by falling
 *              back to a single static ring that fades out instead of
 *              the expanding-pulse animation.
 * @author Jamie Ellis / Engage MT
 * @created 2026-05-31
 * @updated 2026-07-07
 * @version 1.1.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import type EsriMapView from "@arcgis/core/views/MapView";
import type Point from "@arcgis/core/geometry/Point";
import GraphicsLayer from "@arcgis/core/layers/GraphicsLayer";
import Graphic from "@arcgis/core/Graphic";
import { impact } from "@/services/mobile/haptics";

const PULSE_DURATION_MS = 600;
const PULSE_REPEAT = 2;
const START_RADIUS_PX = 6;
const END_RADIUS_PX = 26;

let pulseLayer: GraphicsLayer | null = null;
let activeAnimationFrame: number | null = null;

// The pulse rides on `view.map`, so it works wherever the MapView mounts.
const getOrCreatePulseLayer = (view: EsriMapView): GraphicsLayer => {
  if (pulseLayer && view.map?.layers.includes(pulseLayer)) return pulseLayer;
  pulseLayer = new GraphicsLayer({
    listMode: "hide",
    title: "__engage-mt-selection-pulse__",
  });
  view.map?.add(pulseLayer);
  return pulseLayer;
};

/**
 * Drop a pulse at the supplied map point. Cancels any in-flight pulse
 * before starting a new one. The pulse expands from 6→26px twice over
 * ~1.2s and fades to 0, then clears itself.
 */
export const pulseAtPoint = (view: EsriMapView, mapPoint: Point): void => {
  if (!view) return;
  // A small haptic accompanies the pulse so a phone-pocket
  // tap feels like it landed. Silently no-ops on desktop / browsers
  // without the Vibration API.
  void impact("light");
  const layer = getOrCreatePulseLayer(view);
  layer.removeAll();
  if (activeAnimationFrame !== null) {
    cancelAnimationFrame(activeAnimationFrame);
    activeAnimationFrame = null;
  }

  const reduced =
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  // Reduced-motion: a single static ring that fades out — same
  // semantics (you tapped here), zero motion.
  if (reduced) {
    const graphic = new Graphic({
      geometry: mapPoint,
      symbol: {
        type: "simple-marker",
        style: "circle",
        color: [255, 255, 255, 0],
        size: END_RADIUS_PX,
        outline: { color: [255, 255, 255, 0.95], width: 3 },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
    });
    layer.add(graphic);
    setTimeout(() => layer.remove(graphic), PULSE_DURATION_MS);
    return;
  }

  const start = performance.now();
  const totalDuration = PULSE_DURATION_MS * PULSE_REPEAT;

  // One reusable graphic — we mutate its symbol each frame rather than
  // adding/removing graphics (cheaper on the ArcGIS render loop).
  const graphic = new Graphic({
    geometry: mapPoint,
    symbol: {
      type: "simple-marker",
      style: "circle",
      color: [255, 255, 255, 0],
      size: START_RADIUS_PX,
      outline: { color: [255, 255, 255, 0.95], width: 3 },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
  });
  layer.add(graphic);

  const tick = (now: number) => {
    const elapsed = now - start;
    if (elapsed >= totalDuration) {
      layer.remove(graphic);
      activeAnimationFrame = null;
      return;
    }
    // Position within the current pulse cycle (0..1, repeats PULSE_REPEAT times).
    const cycle = (elapsed % PULSE_DURATION_MS) / PULSE_DURATION_MS;
    const eased = 1 - Math.pow(1 - cycle, 2); // ease-out quad
    const radius = START_RADIUS_PX + (END_RADIUS_PX - START_RADIUS_PX) * eased;
    // Ring fades to transparent as it expands.
    const alpha = Math.max(0, 0.95 - cycle * 0.95);
    (
      graphic.symbol as unknown as {
        size: number;
        outline: { color: number[]; width: number };
      }
    ).size = radius;
    (
      graphic.symbol as unknown as {
        outline: { color: number[]; width: number };
      }
    ).outline = {
      color: [255, 255, 255, alpha],
      width: 3,
    };
    // ArcGIS doesn't re-render on symbol-property mutation; we need to
    // reassign the symbol reference to trigger a redraw.
    if (graphic.symbol) {
      graphic.symbol = graphic.symbol.clone();
    }
    activeAnimationFrame = requestAnimationFrame(tick);
  };
  activeAnimationFrame = requestAnimationFrame(tick);
};
