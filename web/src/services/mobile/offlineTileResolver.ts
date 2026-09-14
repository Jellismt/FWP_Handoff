/**
 * @file offlineTileResolver.ts
 * @module engage-mt/services/mobile
 * @description Reads the downloaded-area index: which areas cover a tile or a
 *              point, the nearest area to a point, and the URLs for the tiles
 *              themselves. Tiles are served straight from the app's data
 *              directory by the native web view rather than read through the
 *              plugin bridge and rebuilt as base64 data URLs, which cost a
 *              main-thread hop and several copies of every tile. Areas saved
 *              before overview levels were downloaded default to the detail
 *              floor so the resolver never claims tiles that were not fetched.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-08
 * @updated 2026-09-06
 * @version 3.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { isCapacitor } from "@/utils/capacitor";
import { OFFLINE_AREA_MIN_ZOOM, tileExtensionFor } from "@/config/offlineBasemaps";
import { tileIntersectsBbox, type BBox } from "./tileMath";

export interface OfflineAreaRef {
  id: string;
  label: string;
  bbox: BBox;
  minZoom: number;
  maxZoom: number;
  /** Which source the tiles came from, which fixes their file extension. */
  basemap?: string;
}

export const OFFLINE_AREAS_KEY = "engage-mt:offline-areas";

interface PersistedArea {
  id: string;
  label?: string;
  bbox: BBox;
  minZoom?: number;
  maxZoom: number;
  basemap?: string;
  status: string;
}

export const listDownloadedAreas = (): OfflineAreaRef[] => {
  try {
    const raw = window.localStorage?.getItem?.(OFFLINE_AREAS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PersistedArea[];
    return parsed
      .filter((a) => a?.status === "downloaded" && a.bbox)
      .map((a) => ({
        id: a.id,
        label: a.label ?? "Downloaded area",
        bbox: a.bbox,
        minZoom: typeof a.minZoom === "number" ? a.minZoom : OFFLINE_AREA_MIN_ZOOM,
        maxZoom: a.maxZoom,
        basemap: a.basemap,
      }));
  } catch {
    return [];
  }
};

export const areaCoversTile = (area: OfflineAreaRef, z: number, x: number, y: number): boolean =>
  z >= area.minZoom && z <= area.maxZoom && tileIntersectsBbox(area.bbox, z, x, y);

export const areaContainsPoint = (area: OfflineAreaRef, lon: number, lat: number): boolean =>
  lon >= area.bbox.west &&
  lon <= area.bbox.east &&
  lat >= area.bbox.south &&
  lat <= area.bbox.north;

export const areaCoveringPoint = (lon: number, lat: number): OfflineAreaRef | null =>
  listDownloadedAreas().find((a) => areaContainsPoint(a, lon, lat)) ?? null;

export const bboxCenter = (bbox: BBox): { lon: number; lat: number } => ({
  lon: (bbox.east + bbox.west) / 2,
  lat: (bbox.north + bbox.south) / 2,
});

/** Nearest downloaded area by centre-to-centre distance (degrees, latitude-scaled). */
export const nearestDownloadedArea = (lon: number, lat: number): OfflineAreaRef | null => {
  let best: OfflineAreaRef | null = null;
  let bestD = Number.POSITIVE_INFINITY;
  for (const area of listDownloadedAreas()) {
    const c = bboxCenter(area.bbox);
    const dx = (c.lon - lon) * Math.cos((lat * Math.PI) / 180);
    const dy = c.lat - lat;
    const d = dx * dx + dy * dy;
    if (d < bestD) {
      bestD = d;
      best = area;
    }
  }
  return best;
};

export const TILES_DIR = "tiles";

/**
 * The URL the native web view serves the tile directory from. Resolving it
 * costs one bridge call, so it is resolved once and reused for every tile.
 */
let servedTilesBase: Promise<string | null> | null = null;

const tilesBaseUrl = (): Promise<string | null> => {
  servedTilesBase ??= (async () => {
    try {
      const [{ Capacitor }, { Filesystem, Directory }] = await Promise.all([
        import("@capacitor/core"),
        import("@capacitor/filesystem"),
      ]);
      const { uri } = await Filesystem.getUri({ path: TILES_DIR, directory: Directory.Data });
      return Capacitor.convertFileSrc(uri).replace(/\/+$/, "");
    } catch {
      return null;
    }
  })();
  return servedTilesBase;
};

/** Drops the cached base URL. For tests, and after the app data directory moves. */
export const resetOfflineTileBaseUrl = (): void => {
  servedTilesBase = null;
};

/**
 * Every downloaded area that covers this tile, as URLs the web view can load,
 * best first. Empty off the device, or when no area covers the tile. The
 * caller tries them in order: a tile can be missing from one area's download
 * and present in an overlapping area's.
 */
export const resolveOfflineTile = async (z: number, x: number, y: number): Promise<string[]> => {
  if (!isCapacitor()) return [];
  const covering = listDownloadedAreas().filter((a) => areaCoversTile(a, z, x, y));
  if (covering.length === 0) return [];
  const base = await tilesBaseUrl();
  if (!base) return [];
  return covering.map(
    (area) => `${base}/${area.id}/${z}/${x}/${y}.${tileExtensionFor(area.basemap)}`,
  );
};

export const hasAnyDownloadedCoverage = (): boolean => listDownloadedAreas().length > 0;
