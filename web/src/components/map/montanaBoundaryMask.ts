/**
 * @file montanaBoundaryMask.ts
 * @module engage-mt/map
 * @description R.3b — Montana focus-mask layer extracted from MapView.tsx.
 *              Owns the full lifecycle for the translucent overlay that darkens
 *              everything outside Montana, including:
 *                · the immediate paint with the bundled 78-vertex ring
 *                · the async upgrade to the authoritative 297-vertex Census
 *                  boundary
 *                · the recolor on theme change
 *                · the ring-orientation helpers (shoelace + CCW guarantee)
 *                · the `buildMontanaMaskGraphic` builder
 *
 *              MapView keeps a separate theme subscription for the layer
 *              registry (renderer + alphaForTheme refresh on dark-mode flip);
 *              the mask's theme subscription stays local because the mask
 *              isn't part of LAYER_REGISTRY.
 *
 *              Returns an imperative detach function — matches the existing
 *              `attachFieldGraphics` pattern so callers compose without prop-
 *              drilling. The boundary fetch uses an `alive` lifecycle flag
 *              owned by the caller so a view teardown mid-fetch can't paint
 *              into a destroyed view.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-06
 * @updated 2026-07-03
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import Graphic from "@arcgis/core/Graphic";
import GraphicsLayer from "@arcgis/core/layers/GraphicsLayer";
import Polygon from "@arcgis/core/geometry/Polygon";
import type EsriMap from "@arcgis/core/Map";
import type MapView from "@arcgis/core/views/MapView";
import { MONTANA_BOUNDARY_RING, fetchRealMontanaBoundary } from "@/data/montanaBoundary";
import { useThemeStore } from "@/store/app/themeStore";
import { createLogger } from "@/utils/logger";

const log = createLogger("montanaBoundaryMask");

/**
 * Signed area via the shoelace formula. Positive = CCW in screen space
 * (lon=X east, lat=Y north). Negative = CW.
 */
const signedArea = (ring: ReadonlyArray<[number, number]>): number => {
  let area = 0;
  for (let i = 0; i < ring.length - 1; i += 1) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[i + 1];
    area += x1 * y2 - x2 * y1;
  }
  return area / 2;
};

/** Ensure ring is CCW in screen space (inner-ring / hole orientation for ArcGIS). */
const ensureCcwHoleRing = (ring: ReadonlyArray<[number, number]>): Array<[number, number]> => {
  const oriented = ring.map(([lon, lat]) => [lon, lat] as [number, number]);
  if (signedArea(oriented) < 0) oriented.reverse();
  return oriented;
};

export const buildMontanaMaskGraphic = (
  theme: "light" | "dark",
  boundaryRing: ReadonlyArray<[number, number]> = MONTANA_BOUNDARY_RING,
): Graphic => {
  // World rectangle, CLOCKWISE in screen space: SW → NW → NE → SE → SW. Outer fill.
  const worldRing: Array<[number, number]> = [
    [-180, -85],
    [-180, 85],
    [180, 85],
    [180, -85],
    [-180, -85],
  ];
  const montanaRing = ensureCcwHoleRing(boundaryRing);

  const polygon = new Polygon({
    rings: [worldRing, montanaRing],
    spatialReference: { wkid: 4326 },
  });

  // Out-of-Montana tint is a theme-blue veil at the same transparency levels as
  // before (light 0.55 / dark 0.66): a lighter FWP blue in light mode, the
  // darker FWP brand blue in dark mode. Paired with `--fwp-mask-light` +
  // `--fwp-mask-dark` tokens in brand-tokens.css — change in lockstep.
  const color = theme === "dark" ? [0, 40, 85, 0.66] : [177, 179, 179, 0.55];

  return new Graphic({
    geometry: polygon,
    symbol: {
      type: "simple-fill" as const,
      color,
      outline: { color: [0, 0, 0, 0], width: 0 },
    },
  });
};

interface AttachOptions {
  map: EsriMap;
  view: MapView;
  /** Callback returns false once the parent effect has been torn down. */
  alive: () => boolean;
}

/**
 * Attach the Montana focus-mask GraphicsLayer to the map. Returns a detach
 * function that removes the theme subscription. The GraphicsLayer itself is
 * cleaned up when `view.destroy()` runs.
 */
export const attachMontanaBoundaryMask = ({ map, view, alive }: AttachOptions): (() => void) => {
  const theme = useThemeStore.getState().resolved;
  const maskLayer = new GraphicsLayer({
    id: "engage-mt-montana-mask",
    title: "Montana focus mask",
    listMode: "hide",
  });
  let currentBoundary: ReadonlyArray<[number, number]> = MONTANA_BOUNDARY_RING;
  maskLayer.add(buildMontanaMaskGraphic(theme, currentBoundary));
  map.add(maskLayer);

  // Async upgrade to the authoritative 297-vertex Census boundary.
  void fetchRealMontanaBoundary().then((realRing) => {
    if (!alive() || view.destroyed) return;
    if (!realRing || realRing.length < 50) return;
    currentBoundary = realRing;
    const themeNow = useThemeStore.getState().resolved;
    maskLayer.removeAll();
    maskLayer.add(buildMontanaMaskGraphic(themeNow, currentBoundary));
    log.info(`Montana mask upgraded to real boundary (${realRing.length} vertices)`);
  });

  // Theme subscription — recolor the mask only.
  const themeUnsub = useThemeStore.subscribe((state) => {
    maskLayer.removeAll();
    maskLayer.add(buildMontanaMaskGraphic(state.resolved, currentBoundary));
  });

  return () => themeUnsub();
};
