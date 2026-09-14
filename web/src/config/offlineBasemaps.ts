/**
 * @file offlineBasemaps.ts
 * @module engage-mt/config
 * @description Tile sources for downloaded offline areas: USGS The National
 *              Map (public domain, no usage agreement needed for caching), plus
 *              the zoom bounds every offline surface shares. The online map
 *              keeps its Esri basemaps; only the on-device packs come from
 *              here.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-16
 * @updated 2026-09-06
 * @version 2.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

export const OFFLINE_TILE_HOST = "https://basemap.nationalmap.gov";

/** ArcGIS tile scheme: `/tile/{level}/{row}/{column}`. */
const usgsTemplate = (service: string): string =>
  `${OFFLINE_TILE_HOST}/arcgis/rest/services/${service}/MapServer/tile/{z}/{y}/{x}`;

export const OFFLINE_ATTRIBUTION = "U.S. Geological Survey, The National Map";

export const BASEMAP_TEMPLATES = {
  usgsTopo: {
    label: "USGS Topo",
    description: "Contours, trails, and place names. Best for backcountry navigation.",
    url: usgsTemplate("USGSTopo"),
    tileExtension: "png",
  },
  usgsImageryTopo: {
    label: "USGS Imagery Topo",
    description: "Aerial imagery with contours and names. Best for scouting cover and terrain.",
    url: usgsTemplate("USGSImageryTopo"),
    tileExtension: "jpg",
  },
} as const satisfies Record<
  string,
  { label: string; description: string; url: string; tileExtension: "png" | "jpg" }
>;

export type BasemapKey = keyof typeof BASEMAP_TEMPLATES;

export const DEFAULT_BASEMAP_KEY: BasemapKey = "usgsTopo";

/**
 * Format the source serves. Files are stored with this extension so the native
 * web view can infer the right content type from the path alone.
 */
export const tileExtensionFor = (key: string | undefined): "png" | "jpg" =>
  BASEMAP_TEMPLATES[resolveBasemapKey(key)].tileExtension;

/** Keys persisted by earlier builds, mapped onto the current sources. */
const LEGACY_BASEMAP_KEYS: Readonly<Record<string, BasemapKey>> = {
  topo: "usgsTopo",
  worldTopo: "usgsTopo",
  imagery: "usgsImageryTopo",
};

export const resolveBasemapKey = (key: string | undefined): BasemapKey => {
  if (key && key in BASEMAP_TEMPLATES) return key as BasemapKey;
  return (key && LEGACY_BASEMAP_KEYS[key]) || DEFAULT_BASEMAP_KEY;
};

/** Every pack includes these overview levels so the map is never blank when zoomed out. */
export const OFFLINE_FLOOR_MIN_ZOOM = 6;
/** Lowest detail level a user can choose as an area's max zoom. */
export const OFFLINE_AREA_MIN_ZOOM = 10;
/** The USGS services stop at level 16 (about 1:9,000). */
export const OFFLINE_MAX_ZOOM = 16;
export const DEFAULT_OFFLINE_MAX_ZOOM = 14;

export const clampOfflineMaxZoom = (zoom: number): number => {
  if (!Number.isFinite(zoom)) return DEFAULT_OFFLINE_MAX_ZOOM;
  return Math.min(OFFLINE_MAX_ZOOM, Math.max(OFFLINE_AREA_MIN_ZOOM, Math.round(zoom)));
};
