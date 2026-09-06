/**
 * @file esriCast.ts
 * @module engage-mt/utils
 * @description One home for ArcGIS SDK type-narrowing
 *              casts. The SDK's `*Properties` types are nominally
 *              typed (built from the constructor options), so feeding
 *              plain literal objects into them at runtime requires a
 *              dual cast — `as unknown as __esri.RendererProperties`,
 *              etc. The pattern was reproduced in ten+ symbology /
 *              layer files; this module centralizes it so each cast
 *              site reads as one verb instead of `as unknown as …`
 *              boilerplate.
 *
 *              The helpers do NOT change runtime behaviour. They are
 *              identity functions whose only job is to swap a structural
 *              JS literal for the corresponding nominal SDK type so
 *              `tsc` accepts it. Every helper is one line.
 *
 *              When adding a new SDK cast: prefer extending this file
 *              over a one-off `as unknown as __esri.*` in the calling
 *              code. The bar is "if the same shape appears in 2+ files,
 *              add a helper here."
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-02
 * @updated 2026-06-10
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import type Geometry from "@arcgis/core/geometry/Geometry";

/**
 * Wrap a `{ id }` literal as `__esri.PortalItem`. Used by every
 * portal-item-backed layer constructor in MapView.
 *
 *   new FeatureLayer({ portalItem: asPortalItem(def.portalItemId) })
 */
export const asPortalItem = (id: string): __esri.PortalItem =>
  ({ id }) as unknown as __esri.PortalItem;

/**
 * Wrap a renderer-literal as `__esri.RendererProperties`. Used by every
 * `web/src/components/map/symbology/*.ts` module that builds a renderer
 * config object from brand tokens.
 */
export const asRendererProps = <T extends object>(config: T): __esri.RendererProperties =>
  config as unknown as __esri.RendererProperties;

/**
 * Wrap a `FeatureReductionCluster` literal as the SDK's typed
 * properties shape. Used by `cluster.ts`.
 */
export const asFeatureReductionProps = <T extends object>(
  config: T,
): __esri.FeatureReductionClusterProperties =>
  config as unknown as __esri.FeatureReductionClusterProperties;

/**
 * Wrap an array of `Geometry` instances as the union-typed array the
 * `geometryEngine.union` / `difference` operators expect. Retained for
 * any future geometry-pipeline caller that hands back `Geometry[]` but
 * needs the nominal `GeometryUnion[]` for the SDK signature.
 */
export const asGeometryUnionArray = (geos: Geometry[]): __esri.GeometryUnion[] =>
  geos as unknown as __esri.GeometryUnion[];

/**
 * Wrap a simple-fill symbol literal (`{ type: 'simple-fill', color, outline }`)
 * as the SDK's nominal discriminated type so `new Graphic({ symbol })` type-checks
 * without a per-call `as any`. Used by inline polygon symbol authors.
 */
export const asSimpleFillSymbol = <T extends object>(
  config: T,
): __esri.SimpleFillSymbolProperties & { type: "simple-fill" } =>
  config as unknown as __esri.SimpleFillSymbolProperties & { type: "simple-fill" };
