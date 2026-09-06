/**
 * @file offlineDataLayers.ts
 * @module engage-mt/config
 * @description The curated set of registry layers whose vector features ride
 *              along when a user downloads an offline area — the "download a
 *              region = download everything about that region" model. These are
 *              the polygon layers that answer the highest-value offline field
 *              questions: whose land is this, what district am I in, is this a
 *              public-access parcel.
 *
 *              Each entry MUST name a registered polygon LayerDef (config/layers)
 *              with a queryable ArcGIS URL — regionDataCache looks the layer up,
 *              filters to polygon geometry, and fetches only the features
 *              intersecting the drawn AOI. This array is the single knob for
 *              "what data goes offline"; add a row to carry another layer.
 *
 *              Scoped to registered polygon layers only; county / PLSS context
 *              is resolved online and is intentionally out of this set.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-14
 * @updated 2026-07-14
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

export interface OfflineDataLayer {
  /** Registered polygon layer id from config/layers.ts. */
  layerId: string;
  /** Human-facing label for the pre-trip "what you'll have offline" summary. */
  label: string;
}

/**
 * Ordered by field priority — ownership and districts first, access parcels
 * next. regionDataCache walks this list; a layer that isn't a queryable polygon
 * at runtime is skipped with a warning rather than failing the download.
 */
export const OFFLINE_DATA_LAYERS: readonly OfflineDataLayer[] = [
  { layerId: "mt-cadastral", label: "Land ownership (parcels)" },
  { layerId: "hunting-districts", label: "Hunting districts" },
  { layerId: "bma-boundaries", label: "Block Management Areas" },
  { layerId: "wildlife-management-areas", label: "Wildlife Management Areas" },
] as const;
