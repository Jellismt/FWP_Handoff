/**
 * @file OfflineXyzLayer.ts
 * @module engage-mt/map
 * @description A BaseTileLayer subclass that draws downloaded USGS tiles,
 *              served from the device by the native web view. Tiles outside
 *              every downloaded area render transparent so the map shows
 *              nothing rather than a broken image, and the tiling scheme is
 *              capped at the deepest level a pack can contain so zooming in
 *              past it resamples instead of going blank.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-08
 * @updated 2026-09-06
 * @version 3.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { OFFLINE_ATTRIBUTION, OFFLINE_MAX_ZOOM } from "@/config/offlineBasemaps";
import { resolveOfflineTile } from "@/services/mobile/offlineTileResolver";

const TRANSPARENT_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

/** Loads one URL into an Image, resolving false when it could not be decoded. */
const loadImage = (img: HTMLImageElement, url: string): Promise<boolean> =>
  new Promise((resolve) => {
    img.onload = (): void => resolve(true);
    img.onerror = (): void => resolve(false);
    img.src = url;
  });

export const createOfflineXyzLayer = async (): Promise<unknown | null> => {
  try {
    const [{ default: BaseTileLayer }, { default: TileInfo }] = await Promise.all([
      import("@arcgis/core/layers/BaseTileLayer"),
      import("@arcgis/core/layers/support/TileInfo"),
    ]);
    const OfflineLayer = (
      BaseTileLayer as unknown as {
        createSubclass: (def: Record<string, unknown>) => {
          new (props?: Record<string, unknown>): unknown;
        };
      }
    ).createSubclass({
      async fetchTile(
        level: number,
        row: number,
        col: number,
        options?: { signal?: AbortSignal },
      ): Promise<HTMLImageElement> {
        const img = new Image();
        if (options?.signal?.aborted) return img;
        // Try every area covering this tile: a tile missing from one area's
        // download may be present in an overlapping area's.
        for (const url of await resolveOfflineTile(level, col, row)) {
          if (options?.signal?.aborted) return img;
          if (await loadImage(img, url)) return img;
        }
        await loadImage(img, TRANSPARENT_PNG);
        return img;
      },
    });
    return new OfflineLayer({
      title: "Offline tiles",
      copyright: OFFLINE_ATTRIBUTION,
      // Cap the scheme at the deepest level ever downloaded. Without this the
      // default goes to level 23, and zooming past the pack shows nothing
      // instead of resampling the deepest tile on disk.
      tileInfo: TileInfo.create({ numLODs: OFFLINE_MAX_ZOOM + 1 }),
    });
  } catch {
    return null;
  }
};
