/**
 * @file cluster.ts
 * @module engage-mt/map/symbology
 * @description Factory for ArcGIS `FeatureReductionCluster` configurations.
 * Of the cartographic redesign — wires clustering on
 *              dense point layers (FAS 600 points, etc.)
 *              so the state-extent map doesn't read as dot-density noise.
 *
 * Three deltas on top of the foundation:
 *                1. The cluster badge now uses the per-layer Lucide
 *                   icon (iconSymbols.ts) instead of a generic circle so
 *                   the cluster reads as "many access sites" not "many
 *                   blue dots." Cluster radius still ramps 16 → 40px
 *                   with count, but the underlying glyph is the layer
 *                   icon, not a circle.
 *                2. Per-layer threshold tuning — dense layers push out
 *                   to zoom 12 so users
 *                   don't get a giant cluster at zoom 11; sparse layers
 *                   (AIS 30 stations) drop to zoom 9
 *                   so individual symbols read sooner.
 *                3. Dark-mode parity — the label halo + ring colors
 *                   adjust at theme-flip via the same DOM-driven
 *                   currentTheme() helper used in points.ts.
 *
 *              CRITICAL — uncluster choreography:
 *              `maxScale` sets the scale at which the cluster reduction
 *              goes inactive and individual points re-appear. (4.32
 *              renamed this from `disableClusteringAtScale`; using the
 *              old name silently no-ops via autocast and clusters never
 *              disable, breaking every clustered popup.) When a user
 *              taps a cluster, MapView.tsx zooms the view past this
 *              threshold so the cluster fully disaggregates.
 * @author Jamie Ellis / Engage MT
 * @created 2026-05-31
 * @updated 2026-06-10
 * @version 1.3.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import FeatureReductionCluster from "@arcgis/core/layers/support/FeatureReductionCluster";
import type { LayerDef } from "@/types/layers";
import { hexToRgba, moduleAccentHex } from "./colors";
import {
  hasIconForLayer,
  iconColorForLayer,
  pictureMarkerForLayer,
  type IconTheme,
} from "./iconSymbols";

/**
 * Scale below which the cluster reduction goes inactive and individual
 * features re-appear. Exported so the click handler can defensively skip
 * cluster-auto-zoom when the view is already past the threshold (e.g.,
 * when multiple feature records share identical coordinates and would
 * cluster forever regardless of zoom level).
 *
 * Conversion mirrors the standard ArcGIS Web Mercator approximation:
 * `559,082,264.0287 / (2^zoom)`. Default `disableAtZoom` is 11 when the
 * layer doesn't opt in.
 */
export const clusterDisableScale = (def: LayerDef): number => {
  const disableAtZoom = def.symbology?.cluster?.disableAtZoom ?? 11;
  return Math.round(559082264.0287 / 2 ** disableAtZoom);
};

/**
 * Reads the current theme without importing the React store at module
 * top-level. Keeps the symbology layer framework-agnostic.
 */
const currentTheme = (): IconTheme => {
  if (typeof document === "undefined") return "light";
  const scheme = document.body?.getAttribute("color-scheme");
  return scheme === "dark" ? "dark" : "light";
};

/**
 * Cluster badge: per-layer Lucide icon + module-accent
 * fallback. Constructs a `FeatureReductionCluster` INSTANCE directly so
 * the SDK's autocast can't silently drop properties.
 *
 * Two compounding bugs broke every clustered popup
 * (FAS, AIS, BLM/BOR/USFS rec sites) in 4.32:
 *   1. The property `disableClusteringAtScale` was renamed to `maxScale`
 *      in ArcGIS Maps SDK 4.x — the old name silently no-ops via
 *      autocast and clusters never disable.
 *   2. Returning a property literal from `asFeatureReductionProps` let
 *      autocast drop `clusterRadius`, `clusterMinSize`, `clusterMaxSize`
 *      too.
 * Constructing the FeatureReductionCluster instance directly preserves
 * every property; using `maxScale` makes the disable threshold actually
 * fire.
 */
export const clusterReduction = (def: LayerDef): FeatureReductionCluster => {
  const accent = iconColorForLayer(def.id) ?? moduleAccentHex(def.module);
  const disableAtScale = clusterDisableScale(def);

  const theme = currentTheme();
  const iconSymbol = hasIconForLayer(def.id) ? pictureMarkerForLayer(def.id, theme) : null;

  const fallbackSymbol = {
    type: "simple-marker" as const,
    style: "circle" as const,
    color: hexToRgba(accent, 0.92),
    outline: { color: [255, 255, 255, 0.95], width: 2 },
  };

  // Uniform 24px cluster size, no count label. The size
  // ramp + numeral were getting misread as feature-attribute density; we
  // rely on visible cluster vs. expanded points to communicate density.
  return new FeatureReductionCluster({
    clusterRadius: 60,
    clusterMinSize: 24,
    clusterMaxSize: 24,
    maxScale: disableAtScale,
    popupTemplate: {
      title: `Cluster of {cluster_count} ${def.title}`,
      content: "Tap to zoom in.",
    },
    // Cast aside the discriminated-union complaint — the SDK accepts any
    // picture-marker or simple-marker literal here; the union widens too
    // tightly for runtime-shaped JSON.
    symbol: (iconSymbol ?? fallbackSymbol) as never,
  });
};
