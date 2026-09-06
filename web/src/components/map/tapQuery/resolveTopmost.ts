/**
 * @file resolveTopmost.ts
 * @module engage-mt/map
 * @description Pure tap-query resolution helpers extracted from MapView.tsx
 *. Two concerns, both free of view/store/React
 *              coupling so they can be unit-tested directly:
 *                · `resolveTopmost` — "the popup is for the thing I
 *                  clicked." Given a hitTest result stack + the set of
 *                  registered LayerDef ids, return the FRONTMOST graphic that
 *                  belongs to a real registered layer (walking `parent`
 *                  ancestors so portal-item GroupLayer children resolve), while
 *                  skipping infra overlays (mask / highlight / field-tools).
 * · `decideClusterZoom` — cluster auto-zoom
 *                  DECISION (no side effects). The caller owns the actual
 *                  `view.goTo` / `pulseAtPoint`.
 *              Phases 19 / 32.5 / 32.7 / 44.2 / 48 / 49 / 54 logic lives here.
 *              Shaped view-agnostically (takes `hit.results`, not a view) so
 *              it stays decoupled from the view wiring and trivially testable.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-29
 * @updated 2026-07-07
 * @version 1.1.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

/**
 * Infra overlays that own a real layer id but must never be treated as a
 * tap-query target: the Montana focus mask, the selection highlight halo, and
 * the user's field-tools graphics (which the click handler hit-tests first via
 * its own dedicated path).
 */
export const INFRA_LAYER_IDS: ReadonlySet<string> = new Set<string>([
  "engage-mt-montana-mask",
  "engage-mt-highlight",
  "engage-mt-field-tools",
]);

/** Max ancestor hops when walking a graphic's layer up to a registered id. */
const MAX_ANCESTOR_WALK = 6;

/**
 * Walk from a graphic's immediate layer up through `parent` ancestors until we
 * hit one whose id is in the registry. Returns the registered id, or `null` if
 * none of the ancestors are known. Living Atlas portal items resolve
 * to FeatureLayer children with auto-generated ids whose `parent` GroupLayer
 * carries our LayerDef id.
 */
export const resolveRegisteredLid = (
  graphicLayer: __esri.Layer | undefined | null,
  registeredIds: ReadonlySet<string>,
): string | null => {
  let cur = graphicLayer as
    | (__esri.Layer & { parent?: __esri.Layer | __esri.Map | null })
    | null
    | undefined;
  for (let i = 0; cur && i < MAX_ANCESTOR_WALK; i++) {
    const id = (cur as { id?: string }).id;
    if (typeof id === "string" && registeredIds.has(id)) return id;
    cur = (cur as { parent?: __esri.Layer | __esri.Map | null }).parent as
      | (__esri.Layer & { parent?: __esri.Layer | __esri.Map | null })
      | null
      | undefined;
  }
  return null;
};

export interface TopmostResolution {
  /** Registered LayerDef id of the frontmost real graphic, or `null`. */
  topLayerId: string | null;
  /** That graphic's attributes (null when it carries none). */
  topGraphicAttrs: Record<string, unknown> | null;
  /** The hit itself — kept so the caller can read `graphic.geometry`. */
  topGraphic: { graphic?: __esri.Graphic } | undefined;
}

/**
 * Minimal structural shape of a hitTest result — only the fields this helper
 * reads, so it stays agnostic to the concrete hit-result union `MapView`
 * produces.
 */
export interface TapHit {
  type: string;
  graphic?: __esri.Graphic;
}

/**
 * Resolve the single frontmost graphic the user clicked to a
 * registered LayerDef id. Skips graphics with no named layer (cluster
 * aggregates, mask, highlight, field-tools) by walking the hit stack until a
 * graphic owned by a real registered layer is found.
 */
export const resolveTopmost = (
  hitResults: ReadonlyArray<TapHit>,
  registeredIds: ReadonlySet<string>,
): TopmostResolution => {
  let topLayerId: string | null = null;
  let topGraphicAttrs: Record<string, unknown> | null = null;
  let topGraphic: { graphic?: __esri.Graphic } | undefined;
  for (const r of hitResults) {
    if (r.type !== "graphic") continue;
    const lid = resolveRegisteredLid(r.graphic?.layer as __esri.Layer | undefined, registeredIds);
    if (!lid) continue;
    if (INFRA_LAYER_IDS.has(lid)) continue;
    topGraphic = r;
    topLayerId = lid;
    if (r.graphic?.attributes) {
      topGraphicAttrs = r.graphic.attributes as Record<string, unknown>;
    }
    break;
  }
  return { topLayerId, topGraphicAttrs, topGraphic };
};

/**
 * Collect the DISTINCT registered, non-infra layer ids
 * that have a graphic under the click, front-to-back, from the SAME hitTest
 * result stack `resolveTopmost` consumed. Zero extra network: this is just the
 * set of client-rendered layers the user's pixel actually landed on, and it
 * backs the "N more features here" affordance (the caller filters out the
 * topmost, non-visible, and reference/shared context layers). MapImage rasters
 * (server-rendered, e.g. BMA) don't appear here — they carry no client graphic.
 */
export const collectRegisteredHitLayerIds = (
  hitResults: ReadonlyArray<TapHit>,
  registeredIds: ReadonlySet<string>,
): string[] => {
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const r of hitResults) {
    if (r.type !== "graphic") continue;
    const lid = resolveRegisteredLid(r.graphic?.layer as __esri.Layer | undefined, registeredIds);
    if (!lid || INFRA_LAYER_IDS.has(lid) || seen.has(lid)) continue;
    seen.add(lid);
    ids.push(lid);
  }
  return ids;
};

export interface ClusterDecisionParams {
  /** Frontmost graphic's attributes (carries `cluster_count` on aggregates). */
  topGraphicAttrs: Record<string, unknown> | null;
  /** Whether the frontmost graphic has a geometry to zoom toward. */
  hasGeometry: boolean;
  /**
   * The layer's `disableClusteringAtScale` (from `clusterDisableScale(def)`),
   * or `null` when the topmost layer doesn't cluster.
   */
  clusterDisableScale: number | null;
  /** Current `view.scale` (pass `Infinity` when unknown). */
  currentScale: number;
  /** Current `view.zoom` (pass the default when unknown). */
  currentZoom: number;
  /** SDK max zoom for the view. */
  maxZoom: number;
}

export interface ClusterDecision {
  /** True → caller should `view.goTo` the cluster + pulse, then return early. */
  shouldZoom: boolean;
  /** Zoom level to fly to when `shouldZoom`. */
  targetZoom: number;
  /**
   * True → caller should null out `topGraphicAttrs` so the aggregate's synthetic
   * attributes don't leak into the Living-Atlas fallback as a Tier-1 card.
   */
  clearAttrs: boolean;
}

/**
 * Pure decision for cluster auto-zoom. ArcGIS's
 * FeatureReductionCluster paints aggregate "N" markers when many points sit too
 * close to resolve; clicking one returns a graphic with `cluster_count` but no
 * queryable underlying feature. We drill in by zooming two levels — UNLESS the
 * count is a single-feature false aggregate, the view is already
 * past the layer's disable threshold, or we're at max zoom, in which
 * case we fall through to the query loop and clear the synthetic attrs.
 */
export const decideClusterZoom = (p: ClusterDecisionParams): ClusterDecision => {
  const clusterCount =
    typeof p.topGraphicAttrs?.cluster_count === "number"
      ? (p.topGraphicAttrs.cluster_count as number)
      : null;
  const pastClusterDisable =
    p.clusterDisableScale !== null && p.currentScale <= p.clusterDisableScale;
  const atMaxZoom = p.currentZoom >= p.maxZoom - 1;
  const shouldZoom = Boolean(
    clusterCount && clusterCount >= 2 && p.hasGeometry && !pastClusterDisable && !atMaxZoom,
  );
  const targetZoom = Math.min(p.currentZoom + 2, p.maxZoom);
  // Only clear when we fell through with a cluster aggregate in hand.
  const clearAttrs = !shouldZoom && clusterCount !== null;
  return { shouldZoom, targetZoom, clearAttrs };
};
