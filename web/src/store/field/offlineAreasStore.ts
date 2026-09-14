/**
 * @file offlineAreasStore.ts
 * @module engage-mt/store/field
 * @description Offline areas the user has staged or downloaded. The index is
 *              persisted to localStorage as a plain array (the tile resolver
 *              and the device page read it directly) and mirrored to the app's
 *              data directory so a cleared web view can be reconciled with the
 *              files still on disk. Removing an area deletes its files.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-08
 * @updated 2026-09-06
 * @version 2.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { create } from "zustand";
import {
  BASEMAP_TEMPLATES,
  OFFLINE_FLOOR_MIN_ZOOM,
  clampOfflineMaxZoom,
  resolveBasemapKey,
  tileExtensionFor,
  type BasemapKey,
} from "@/config/offlineBasemaps";
import { OFFLINE_DATA_LAYERS } from "@/config/offlineDataLayers";
import { requestPersistentStorage } from "@/services/cache/persistentStorage";
import { areaTilesPresent, deleteAreaFiles } from "@/services/mobile/offlineAreaFiles";
import { estimateAreaBytes, offlineMaxBytes } from "@/services/mobile/offlineTileQuota";
import { downloadArea } from "@/services/mobile/tileDownloader";
import { downloadRegionData } from "@/services/mobile/vectorDownloader";
import { captureAreaRegs } from "@/services/mobile/regsCapture";
import type { BBox } from "@/services/mobile/tileMath";
import { isCapacitor } from "@/utils/capacitor";

export interface OfflineArea {
  id: string;
  label: string;
  bbox: BBox;
  /** Lowest zoom on disk. Absent for areas saved before overview levels were included. */
  minZoom?: number;
  maxZoom: number;
  /** Estimate while staged; actual bytes once downloaded. */
  estimatedBytes: number;
  status: "queued" | "downloading" | "downloaded" | "failed";
  createdAt: string;
  progressPct?: number;
  basemap?: BasemapKey;
  tileBytes?: number;
  dataStatus?: "downloaded" | "failed";
  dataBytes?: number;
  regsStatus?: "downloaded" | "failed";
  /** Published regulations version captured with the area. */
  regsVersion?: number | null;
  /** Hunting districts inside the area whose facts were captured. */
  regsDistricts?: string[];
}

export interface OfflineAreaDraft {
  label: string;
  bbox: BBox;
  maxZoom: number;
  basemap: BasemapKey;
}

export type QueueResult =
  | { ok: true; area: OfflineArea }
  | { ok: false; reason: "over-cap" | "too-many" };

export const OFFLINE_AREAS_KEY = "engage-mt:offline-areas";
export const MAX_AREAS = 10;
const INDEX_FILE = "offline-areas.json";

const normalize = (raw: OfflineArea[]): OfflineArea[] =>
  raw
    .filter((a) => a && typeof a.id === "string" && a.bbox)
    .map((a) => ({ ...a, basemap: resolveBasemapKey(a.basemap) }));

const load = (): OfflineArea[] => {
  try {
    const raw = window.localStorage?.getItem?.(OFFLINE_AREAS_KEY);
    return raw ? normalize(JSON.parse(raw) as OfflineArea[]) : [];
  } catch {
    return [];
  }
};

interface MinimalFs {
  writeFile: (opts: {
    path: string;
    data: string;
    directory: string;
    encoding: string;
  }) => Promise<unknown>;
  readFile: (opts: {
    path: string;
    directory: string;
    encoding: string;
  }) => Promise<{ data: string }>;
}

const filesystem = async (): Promise<{ fs: MinimalFs; dir: Record<string, string> }> => {
  const { Filesystem, Directory } = await import("@capacitor/filesystem");
  return {
    fs: Filesystem as unknown as MinimalFs,
    dir: Directory as unknown as Record<string, string>,
  };
};

const save = (list: OfflineArea[]): void => {
  const json = JSON.stringify(list);
  try {
    window.localStorage?.setItem?.(OFFLINE_AREAS_KEY, json);
  } catch {
    /* storage unavailable */
  }
  if (isCapacitor()) {
    void filesystem()
      .then(({ fs, dir }) =>
        fs.writeFile({ path: INDEX_FILE, data: json, directory: dir.Data, encoding: "utf8" }),
      )
      .catch(() => undefined);
  }
};

const readMirroredIndex = async (): Promise<OfflineArea[]> => {
  try {
    const { fs, dir } = await filesystem();
    const { data } = await fs.readFile({ path: INDEX_FILE, directory: dir.Data, encoding: "utf8" });
    return normalize(JSON.parse(data) as OfflineArea[]);
  } catch {
    return [];
  }
};

const sumBytes = (areas: OfflineArea[]): number => areas.reduce((t, a) => t + a.estimatedBytes, 0);

interface OfflineAreasState {
  areas: OfflineArea[];
  totalBytes: () => number;
  exceedsCap: (additional: number) => boolean;
  queueArea: (draft: OfflineAreaDraft) => QueueResult;
  /** Drops the area from the index and deletes its files. */
  removeArea: (id: string) => void;
  /** Downloads an area's tiles, region data, and regulations, updating status and progress. */
  startDownload: (area: OfflineArea) => Promise<void>;
  /**
   * On the device: restore a lost index from the mirrored file and demote any
   * "downloaded" area whose tiles are no longer on disk so it can be retried.
   */
  hydrate: () => Promise<void>;
}

export const useOfflineAreasStore = create<OfflineAreasState>((set, get) => {
  const commit = (next: OfflineArea[]): void => {
    save(next);
    set({ areas: next });
  };
  const patch = (id: string, fields: Partial<OfflineArea>): void => {
    commit(get().areas.map((a) => (a.id === id ? { ...a, ...fields } : a)));
  };

  return {
    areas: load(),
    totalBytes: () => sumBytes(get().areas),
    exceedsCap: (additional) => sumBytes(get().areas) + additional > offlineMaxBytes(),

    queueArea: (draft) => {
      if (get().areas.length >= MAX_AREAS) return { ok: false, reason: "too-many" };
      const maxZoom = clampOfflineMaxZoom(draft.maxZoom);
      const estimate = estimateAreaBytes(draft.bbox, maxZoom);
      if (get().exceedsCap(estimate.totalBytes)) return { ok: false, reason: "over-cap" };
      const area: OfflineArea = {
        id: `area_${Date.now().toString(36)}`,
        label: draft.label.trim() || "Untitled area",
        bbox: draft.bbox,
        maxZoom,
        estimatedBytes: estimate.totalBytes,
        status: "queued",
        createdAt: new Date().toISOString(),
        basemap: resolveBasemapKey(draft.basemap),
      };
      commit([area, ...get().areas]);
      return { ok: true, area };
    },

    removeArea: (id) => {
      commit(get().areas.filter((a) => a.id !== id));
      void deleteAreaFiles(id);
    },

    startDownload: async (area) => {
      patch(area.id, { status: "downloading", progressPct: 0 });
      await requestPersistentStorage();
      const template = BASEMAP_TEMPLATES[resolveBasemapKey(area.basemap)].url;
      try {
        // Tiles are most of the bytes and the time: 0–80% of the bar.
        const tiles = await downloadArea({
          areaId: area.id,
          bbox: area.bbox,
          urlTemplate: template,
          tileExtension: tileExtensionFor(area.basemap),
          minZoom: OFFLINE_FLOOR_MIN_ZOOM,
          maxZoom: area.maxZoom,
          onProgress: (p) => patch(area.id, { progressPct: Math.round(p.percent * 0.8) }),
        });
        const tilesOk = tiles.failed === 0 || tiles.fetched === tiles.total;

        // Region vector data for the same footprint: 80–90%.
        const data = await downloadRegionData({
          areaId: area.id,
          bbox: area.bbox,
          layers: OFFLINE_DATA_LAYERS,
          onProgress: (p) => patch(area.id, { progressPct: 80 + Math.round(p.percent * 0.1) }),
        });
        const dataOk = data.failedLayers === 0;

        // Regulations and district facts for the districts in the box: 90–100%.
        const regs = await captureAreaRegs({
          areaId: area.id,
          onProgress: (p) => patch(area.id, { progressPct: 90 + Math.round(p.percent * 0.1) }),
        });
        const actualBytes = tiles.bytes + data.bytes + regs.bytes;

        patch(area.id, {
          tileBytes: tiles.bytes,
          dataStatus: dataOk ? "downloaded" : "failed",
          dataBytes: data.bytes,
          regsStatus: regs.ok ? "downloaded" : "failed",
          regsVersion: regs.version,
          regsDistricts: regs.districts,
          estimatedBytes: actualBytes > 0 ? actualBytes : area.estimatedBytes,
        });
        // "Downloaded" means every leg landed; anything less stays retryable.
        if (tilesOk && dataOk && regs.ok) {
          patch(area.id, {
            status: "downloaded",
            progressPct: 100,
            minZoom: OFFLINE_FLOOR_MIN_ZOOM,
          });
        } else {
          patch(area.id, { status: "failed", progressPct: Math.round(tiles.percent * 0.8) });
        }
      } catch {
        patch(area.id, { status: "failed" });
        throw new Error(`Download failed for ${area.label}`);
      }
    },

    hydrate: async () => {
      if (!isCapacitor()) return;
      let areas = get().areas;
      if (areas.length === 0) areas = await readMirroredIndex();
      const checked = await Promise.all(
        areas.map(async (a) =>
          a.status === "downloaded" && !(await areaTilesPresent(a.id))
            ? { ...a, status: "failed" as const, progressPct: undefined }
            : a,
        ),
      );
      commit(checked);
    },
  };
});
