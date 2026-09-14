/**
 * @file buildLayer.ts
 * @module engage-mt/map
 * @description The ArcGIS layer factory: turns a `LayerDef` from the registry
 *              into the constructed `@arcgis/core` FeatureLayer (service URL) or
 *              GeoJSONLayer (bundled `/data/*.geojson`) instance with renderer,
 *              clustering, blend-mode, zoom-gated labels, Montana definition
 *              expression, and z-order applied.
 *
 *              Extracted verbatim from
 *              `MapView.tsx`'s 600-line mount effect so the dispatch is
 *              independently unit-testable and MapView stays orchestration-
 *              focused. Behavior-preserving: a pure factory with no React /
 *              store / view coupling. Per docs/rules/arcgis.md +
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-16
 * @updated 2026-07-16
 * @version 1.2.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import FeatureLayer from "@arcgis/core/layers/FeatureLayer";
import GeoJSONLayer from "@arcgis/core/layers/GeoJSONLayer";
import type Layer from "@arcgis/core/layers/Layer";
import type FeatureReductionCluster from "@arcgis/core/layers/support/FeatureReductionCluster";
import type { LayerDef } from "@/types/layers";
import { getRenderer } from "./symbology";
import { clusterReduction } from "./symbology/cluster";
import { labelClassesFor } from "./symbology/labels";

/**
 * Construct the ArcGIS layer for a registry `LayerDef`. `initialVisible` is
 * applied at construction so default-visible layers paint on first render
 * without waiting for the post-mount visibility-sync effect (BUG-C).
 */
export const buildLayer = (def: LayerDef, initialVisible: boolean): Layer => {
  // Shared construction props — identical for both layer classes below.
  const common = {
    id: def.id,
    title: def.title,
    visible: initialVisible, // applied at construction so default-visible layers
    // render on first paint without waiting for the post-mount sync effect.
    outFields: def.outFieldsHint ? Array.from(def.outFieldsHint) : ["*"],
    minScale: def.minScale,
    maxScale: def.maxScale,
    // Montana scoping. National feature services (NIFC fires,
    // BLM NLCS) declare a state / forecast-office filter on their LayerDef. Applied at construction
    // so the first FeatureLayer request to the service is already scoped
    // — saves the round-trip otherwise spent downloading non-MT features
    // that would fall outside the map's MONTANA_CONSTRAINT_EXTENT anyway.
    definitionExpression: def.definitionExpression,
  };
  // A `.geojson` url means a bundled dataset in `web/public/data`
  // rather than an ArcGIS service, so it builds a GeoJSONLayer. Used by the
  // major rivers + lakes reference layers, whose geometry is dissolved by name
  // at build time (one feature per river) — something a service we don't own
  // can't do. GeoJSONLayer synthesizes its own OBJECTID, so `objectIdField`
  // (a FeatureLayer-only workaround for MapServer sublayers) doesn't apply.
  const layer: Layer = def.url.endsWith(".geojson")
    ? new GeoJSONLayer({ ...common, url: def.url })
    : // FeatureLayer is the workhorse — every FWP / Esri Living Atlas point /
      // line / polygon FeatureServer endpoint flows through here.
      new FeatureLayer({
        ...common,
        url: def.url,
        // A few MSDI MapServer sublayers omit objectIdField from their metadata;
        // pin it explicitly when the LayerDef declares one so the layer loads.
        ...(def.objectIdField ? { objectIdField: def.objectIdField } : {}),
      });
  // Every layer (default-visible OR opt-in) gets its
  // cartographic renderer from the symbology dispatcher. Per-layer
  // overrides live in symbology/perLayer/*; geometry-family defaults
  // (points / polygons / lines) handle the rest. Assigned post-construct
  // so ArcGIS's renderer autocast can normalize the JSON.
  const renderer = getRenderer(def);
  if (renderer) {
    (layer as unknown as { renderer: unknown }).renderer = renderer;
  }
  // Point layers opt into clustering via `def.symbology.cluster`.
  // FeatureReductionCluster auto-disables itself at the configured zoom
  // so individual points re-appear when the user zooms in past the
  // threshold (default zoom 11). MapView's click handler also routes
  // cluster taps through `view.goTo(extent)` so taps disaggregate.
  if (def.symbology?.cluster?.enabled) {
    // `clusterReduction()` now returns a constructed
    // FeatureReductionCluster instance. Constructing directly bypasses
    // the SDK autocast, which drops `disableClusteringAtScale`
    // + `clusterRadius` + `clusterMinSize` + `clusterMaxSize`, which
    // left clustered FeatureLayers permanently aggregated and silently
    // broke every clustered popup (FAS, AIS, BLM/BOR/USFS rec sites).
    (layer as unknown as { featureReduction: FeatureReductionCluster }).featureReduction =
      clusterReduction(def);
  }
  // Overlay-role polygons (e.g. BMA) get
  // `blendMode = "multiply"` so they darken cleanly against habitat
  // polygons underneath instead of additively muddying.
  if (def.symbology?.polygonRole === "overlay") {
    (layer as unknown as { blendMode: string }).blendMode = "multiply";
  }
  // Zoom-gated labels. Labels only appear when "super zoomed in"
  // — labelClassesFor enforces a minScale (≈ zoom 12+) on every class it
  // returns. Most layers get no labels at all (null return).
  // When labelClassesFor returns null (e.g., FAS), explicitly
  // NULL OUT labelingInfo + flip labelsVisible OFF — otherwise service-side
  // labelingInfo bleeds through and re-labels a layer the user silenced.
  const labelClasses = labelClassesFor(def);
  if (labelClasses && labelClasses.length > 0) {
    (layer as unknown as { labelingInfo: unknown; labelsVisible: boolean }).labelingInfo =
      labelClasses;
    (layer as unknown as { labelsVisible: boolean }).labelsVisible = true;
  } else {
    (layer as unknown as { labelingInfo: unknown; labelsVisible: boolean }).labelingInfo = [];
    (layer as unknown as { labelsVisible: boolean }).labelsVisible = false;
  }
  // Draw order is NOT set here. ArcGIS `Layer` has no `z`
  // property, so the former `layer.z = def.zIndex` never affected
  // stacking OR the topmost-feature hitTest — those follow the `map.layers`
  // collection order set in attachRegistryLayers (role sort + ordered insert
  // for async portal-item layers). `def.zIndex` remains registry documentation.
  return layer;
};
