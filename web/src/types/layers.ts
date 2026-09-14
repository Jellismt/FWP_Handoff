/**
 * @file layers.ts
 * @module engage-mt/types
 * @description Type definitions for the layer registry consumed by map components and stores.
 *              Gains freshness/source/upstreamUrl + docs/rules/data-freshness.md.
 *              Gains `access` module
 *              Gains `definitionExpression` for Montana-scoping of national feature services.
 *              Montana clip pass: gains `montanaClip` + `montanaScopeNote` for geometry-clip scoping.
 * @author Jamie Ellis / Engage MT
 * @created 2026-05-29
 * @updated 2026-07-14
 * @version 1.5.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

// `reference` is a pseudo-module that floats above Hunt at
// the top of the LayerPanel. It owns map-context layers users don't
// "explore for" — radar, wind arrows, public-lands ownership VTL, plus
// the AIS + CWD check-station POINT networks, which are
// cross-cutting compliance/safety infrastructure for anglers *and*
// hunters rather than per-activity content.
// Keeps "shared" for cross-cutting Conditions (fires, drought, alerts).
export type EngageMtModule =
  | "reference"
  | "hunt"
  | "fish"
  | "explore"
  | "access"
  | "manage"
  | "shared";

/**
 * The two cross-cutting "context" pseudo-modules (per docs/rules/ia.md):
 * `reference` (radar, wind, public-land ownership, check stations) and
 * `shared` (fires, hydrology). These ride on top of every
 * spatial module regardless of the active tab. Two behaviors key off this:
 *  1. `soloLayer` PRESERVES these layers' current visibility instead of
 *     blanking them, so a map-first tool keeps the app-open context.
 *  2. The tap-query "N more features here" affordance EXCLUDES them from its
 *     candidate list (they're passive context, not features you tapped for).
 */
export const isReferenceContextModule = (m: EngageMtModule): boolean =>
  m === "reference" || m === "shared";

export type LayerSource =
  | "fwp-public-hub"
  | "fwp-internal-stub"
  | "esri-living-atlas"
  | "external-public"
  | "external-stub";

export type LayerGeometry =
  | "point"
  | "line"
  | "polygon"
  | "raster"
  | "mixed"
  // Vector tile overlay (e.g. Esri Living Atlas Public Land
  // Ownership). MapView resolves these via Layer.fromPortalItem +
  // VectorTileLayer instead of FeatureLayer.
  | "vector-tile";

/**
 * Freshness category per docs/rules/data-freshness.md.
 * `versioned` is reserved for bundled manifest datasets; layers use the other five.
 */
export type LayerFreshness = "realtime" | "hourly" | "daily" | "weekly" | "static";

export interface LayerDef {
  /** Stable kebab-case id used by stores and toggles. */
  id: string;
  /** Which module owns the layer (drives accent color + grouping). */
  module: EngageMtModule;
  /** Human-readable label for the layer panel + legend. */
  title: string;
  /** Short description used in the panel and as the SR-only text equivalent. */
  description: string;
  /** Service URL — empty string if `source` is `fwp-internal-stub` or when
   * `portalItemId` is set (Living Atlas wind layer loads via
   *  Layer.fromPortalItem instead of a hardcoded URL). */
  url: string;
  /** Esri portal-item id. When set, MapView constructs the
   *  layer via `Layer.fromPortalItem({ portalItem: { id } })` instead of
   *  `new FeatureLayer({ url })`. Lets us pull Living Atlas layers without
   *  hardcoding service URLs that may rotate. */
  portalItemId?: string;
  /** Initial opacity applied at layer-construction time.
   *  Defaults to 1.0 for vector layers, 0.7 for raster (NEXRAD radar) so
   *  the basemap stays legible underneath. */
  opacity?: number;
  /** Where the data ultimately comes from. */
  source: LayerSource;
  /** Geometry shape, used for default symbology decisions. */
  geometry: LayerGeometry;
  /** Visible at startup? */
  defaultVisible: boolean;
  /** Calcite icon name for the layer panel row. */
  icon: string;
  /** Optional `outFields` whitelist hint for downstream queries. */
  outFieldsHint?: readonly string[];
  /**
   * Optional objectId field override. A few MSDI MapServer sublayers omit
   * `objectIdField` from their service metadata, which makes the ArcGIS
   * `FeatureLayer` fail to load ("Failed to load layer"). Setting this pins
   * the field explicitly so the layer builds. Only set it when the service
   * genuinely doesn't declare one.
   */
  objectIdField?: string;
  /**
   * Optional Esri SQL `where` clause applied at FeatureLayer
   * construction. Use to scope national/global feature services to
   * Montana — e.g. `"POOState='MT'"` for NIFC wildfires,
   * `"STATE_ADMN='MT'"` for BLM NLCS. FWP / DNRC / MSDI layers are
   * already MT-scoped at the service level; do NOT set this field on
   * those. Services without a state-like field (NHD HR, NOAA drought)
   * stay bounded by `minScale` + the map's `MONTANA_CONSTRAINT_EXTENT`
   * — see `docs/rules/arcgis.md` § Montana scoping.
   */
  definitionExpression?: string;
  /**
   * Montana geographic-clip strategy for national / multi-state VECTOR
   * feature layers that carry NO state-coded attribute (so
   * `definitionExpression` can't scope them) — see `docs/rules/arcgis.md`
   * § Montana scoping and `web/src/services/map/montanaClip.ts`.
   *
   * - `'feature'` — vector FeatureLayer / GeoJSONLayer clipped GPU-side to
   *   the Montana polygon via `featureEffect` (out-of-state features leave
   *   both the render AND tap-query / clustering). Use for the Living Atlas
   *   wind stations, NIFC fire perimeters, and any no-state-field
   *   point/line/polygon FeatureLayer.
   *
   * Raster / vector-tile / MapImageLayer content can't be feature-filtered;
   * scope those with `montanaScopeNote` (dimmed by the focus mask) instead.
   *
   * A LayerDef whose `source` is `esri-living-atlas` / `external-public`
   * MUST declare `definitionExpression`, `montanaClip`, OR `montanaScopeNote`
   * — enforced by `npm run check:montana-scoping`.
   */
  montanaClip?: "feature";
  /**
   * Human-readable justification when a national / multi-state layer is NOT
   * hard-clipped — because it has no state field to filter on and is a
   * raster / vector-tile / MapImageLayer that can't be feature-filtered, so
   * it's bounded by `minScale` + the translucent focus mask (dim outside
   * Montana) instead. Required by `check:montana-scoping` for this path so
   * the reason a layer skips a hard clip is documented, not implied.
   */
  montanaScopeNote?: string;
  /** Optional minScale/maxScale (ArcGIS denominator semantics). */
  minScale?: number;
  maxScale?: number;
  /** Data freshness category — drives the FreshnessChip. */
  freshness: LayerFreshness;
  /** Human-readable source attribution shown in chips + About page. */
  sourceLabel: string;
  /** Pointer to the upstream page or service (for About page). */
  upstreamUrl?: string;
  /** Optional canonical-owner override note. */
  backReferenceFor?: readonly EngageMtModule[];
  /**
   * If true, MapView does NOT add this layer to the ArcGIS map at boot.
   * Used for token-gated layers so that ArcGIS IdentityManager doesn't
   * pop a sign-in dialog. Tier-2 fixture data + dedicated Explorer pages
   * still surface the content. Flag flips to false once the matching
   * STUB token swap lands.
   */
  deferredLoad?: boolean;
  /**
   * When set, the upstream service is known to be temporarily offline
   * (e.g. FWP unpublishes the Block Management service outside the
   * hunting season). Like `deferredLoad`, the layer is NEVER added to
   * the ArcGIS map — so no failed request fires and ArcGIS
   * IdentityManager never pops a sign-in dialog. The LayerPanel renders
   * a non-interactive "offline" badge carrying `note` instead of a
   * toggle. Remove this field entirely (don't set it falsy) when the
   * service is republished.
   */
  unavailable?: {
    /** Short badge label. Defaults to "Offline". */
    badge?: string;
    /** Plain-English explanation shown as the badge tooltip. */
    note: string;
  };
  /**
   * Optional per-layer cartographic spec. When omitted, the symbology
   * dispatcher (web/src/components/map/symbology/index.ts) falls back
   * to module + geometry defaults from points.ts / polygons.ts / lines.ts.
   *
   * - `polygonRole` — `habitat` (filled destinations like WMA,
   *   state parks), `boundary` (outline only for hunting districts), or
   *   `overlay` (textured fill for BMA-style access overlays with multiply blend).
   * - `cluster` — enables FeatureReductionCluster on dense
   *   point layers. `disableAtZoom` is the zoom level at which clusters
   *   disaggregate into individual points.
   * - `sizeBoost` — multiplier on the geometry-family default size
   *   (1.4 = 40% larger). Used for layers like CWD check stations that
   *   need prominence regardless of zoom.
   */
  symbology?: {
    polygonRole?: "habitat" | "boundary" | "overlay";
    cluster?: {
      enabled: true;
      disableAtZoom: number;
    };
    sizeBoost?: number;
  };
  /**
   * Optional sub-group name. When set, sibling LayerDefs
   * with the same `subgroup` collapse under a single header in the
   * LayerPanel (chevron + count). Used today for the six Hunting
   * Districts variants (`subgroup: "Hunting Districts"`); future
   * candidates include Living-Atlas Reference (radar + wind + VTL).
   */
  subgroup?: string;
  /**
   * Within a module + subgroup, display rows ascending by
   * `groupOrder`. Layers without `groupOrder` sort after ordered ones
   * by their position in `LAYER_REGISTRY`. Used to put the General
   * Hunting Districts row first in its subgroup, then the species
   * variants.
   */
  groupOrder?: number;
  /**
   * "one layer that controls many". When set, this
   * LayerDef is a UI-only composite: it owns no data and does NOT
   * materialize as a map layer. The LayerPanel renders one toggle row
   * for the composite; toggling it cascades to every child id. Each
   * child layer still loads its own data + popup card (so tap-to-
   * query still dispatches to the correct gage renderer). Used for
   * `engage-mt:hydrology` rolling the USGS + DNRC stream gages into a
   * single Stream-gages row.
   */
  composite?: readonly string[];
  /**
   * Explicit position within the layer panel group. Ranked rows sort to the
   * top of their group (ascending); unranked rows follow in the standard
   * cartographic-tier order (polygons → lines → points).
   */
  panelRank?: number;
  /**
   * When true, this layer renders on the map (it's a real
   * service) but does NOT show in the LayerPanel. Used for the
   * underlying children of a `composite` so the panel doesn't show
   * duplicate rows.
   */
  hiddenFromPanel?: boolean;
  /**
   * Explicit z-order. Higher values draw above + win the
   * hitTest in MapView's single-topmost-feature click handler, so the
   * most-specific access answer wins over the broader land-tenure
   * polygon below it. Layers without zIndex keep their registry order.
   * Convention: state trust = 40, BMA = 30, WMA / parks = 20, district
   * outlines = 10, Living Atlas VTL = 5.
   */
  zIndex?: number;
}
