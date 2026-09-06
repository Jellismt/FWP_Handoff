/**
 * @file tapQueryHelpers.ts
 * @module engage-mt/map
 * @description Pure async helpers for the MapView tap-query pipeline.
 *              Extracted from MapView.tsx so each stage can be unit-tested
 *              independently (no React / view / store coupling).
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-16
 * @updated 2026-07-03
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import type FeatureLayer from "@arcgis/core/layers/FeatureLayer";
import type Point from "@arcgis/core/geometry/Point";
import type { LayerDef } from "@/types/layers";
import type { TapQueryResult } from "../TapQueryPanel";
import type { TapQueryFailure, TapQueryFailureReason } from "@/store/map/tapQueryFailureStore";

// ---------------------------------------------------------------------------
// queryFeatureLayers
// ---------------------------------------------------------------------------

export interface QueryFeatureLayersParams {
  /** Registry-filtered (LayerDef, FeatureLayer) pairs to query. */
  pairs: ReadonlyArray<readonly [LayerDef, FeatureLayer]>;
  /** The map point the user tapped. */
  mapPoint: Point;
  /** Buffer radius in metres for point/line layers (polygons use 0). */
  tolMeters: number;
  /** Maximum features per layer. */
  maxResults: number;
  /** Per-layer query timeout in milliseconds. */
  timeoutMs: number;
  /** Records a failure against the global failure store. */
  recordFailure: (failure: TapQueryFailure) => void;
}

/**
 * FeatureLayer concurrent query stage of the tap-query
 * pipeline. Scoped to only the topmost registered layer's FeatureLayer (when
 * `pairs` is pre-filtered to that layer). Returns `TapQueryResult[]` for every
 * layer that returned ≥1 feature; silently records timeouts / network errors
 * via `recordFailure` and continues so one slow layer can't block the rest.
 */
export async function queryFeatureLayers({
  pairs,
  mapPoint,
  tolMeters,
  maxResults,
  timeoutMs,
  recordFailure,
}: QueryFeatureLayersParams): Promise<TapQueryResult[]> {
  const layerPromises = pairs.map(([def, layer]) => {
    const useBuffer = def.geometry !== "polygon";
    const queryPromise = layer.queryFeatures({
      geometry: mapPoint,
      distance: useBuffer ? tolMeters : 0,
      units: useBuffer ? "meters" : undefined,
      spatialRelationship: "intersects",
      returnGeometry: false,
      outFields: def.outFieldsHint ? Array.from(def.outFieldsHint) : ["*"],
      // Honor the layer's definitionExpression at tap time. `queryFeatures`
      // does not reliably apply it against a MapServer-backed FeatureLayer, so
      // the tap could return rows the map itself filters out (e.g. the
      // mountain-ranges layer draws only Class='Range' but a tap was surfacing
      // Summit/Lake names too). ANDing it in the where keeps tap == display.
      where: def.definitionExpression ?? undefined,
      num: maxResults,
    });
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`tap-query timeout after ${timeoutMs}ms`)), timeoutMs),
    );
    return Promise.race([queryPromise, timeoutPromise]).then(
      (queryRes) => ({ def, queryRes, status: "ok" as const }),
      (err: unknown) => ({ def, err, status: "fail" as const }),
    );
  });

  const settled = await Promise.all(layerPromises);
  const results: TapQueryResult[] = [];

  for (const outcome of settled) {
    if (outcome.status === "ok") {
      const { def, queryRes } = outcome;
      if (queryRes.features.length > 0) {
        results.push({
          layerId: def.id,
          layerTitle: def.title,
          module: def.module,
          features: queryRes.features.map((f) => f.attributes as Record<string, unknown>),
        });
      }
    } else {
      const { def, err } = outcome;
      const reason: TapQueryFailureReason =
        err instanceof Error && /abort|timeout/i.test(err.message)
          ? "timeout"
          : err instanceof TypeError
            ? "network"
            : "unknown";
      recordFailure({
        layerId: def.id,
        layerTitle: def.title,
        reason,
        at: new Date().toISOString(),
      });
    }
  }

  return results;
}
