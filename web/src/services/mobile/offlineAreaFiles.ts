/**
 * @file offlineAreaFiles.ts
 * @module engage-mt/services/mobile
 * @description The on-disk footprint of one offline area (tiles, region
 *              vector data, captured regulations): delete it all when the
 *              area is removed, and check whether its tiles are still present
 *              so a lost index can be reconciled with the filesystem.
 * @author Jamie Ellis / Engage MT
 * @created 2026-09-06
 * @updated 2026-09-06
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { isCapacitor } from "@/utils/capacitor";

interface MinimalFs {
  rmdir: (opts: { path: string; directory: string; recursive?: boolean }) => Promise<void>;
  deleteFile: (opts: { path: string; directory: string }) => Promise<void>;
  readFile: (opts: { path: string; directory: string; encoding?: string }) => Promise<{
    data: string;
  }>;
}

export const areaDirectories = (areaId: string): string[] => [`tiles/${areaId}`, `data/${areaId}`];
export const areaFiles = (areaId: string): string[] => [`regs/areas/${areaId}.json`];

const filesystem = async (): Promise<{ fs: MinimalFs; dir: Record<string, string> }> => {
  const { Filesystem, Directory } = await import("@capacitor/filesystem");
  return {
    fs: Filesystem as unknown as MinimalFs,
    dir: Directory as unknown as Record<string, string>,
  };
};

/** Removes everything the area wrote. Missing paths are not an error. */
export const deleteAreaFiles = async (areaId: string): Promise<void> => {
  if (!isCapacitor()) return;
  const { fs, dir } = await filesystem();
  for (const path of areaDirectories(areaId)) {
    try {
      await fs.rmdir({ path, directory: dir.Data, recursive: true });
    } catch {
      /* already gone */
    }
  }
  for (const path of areaFiles(areaId)) {
    try {
      await fs.deleteFile({ path, directory: dir.Data });
    } catch {
      /* already gone */
    }
  }
};

/** True when the area's tile manifest exists and records at least one tile. */
export const areaTilesPresent = async (areaId: string): Promise<boolean> => {
  if (!isCapacitor()) return false;
  try {
    const { fs, dir } = await filesystem();
    const { data } = await fs.readFile({
      path: `tiles/${areaId}/manifest.json`,
      directory: dir.Data,
      encoding: "utf8",
    });
    const parsed = JSON.parse(data) as { fetched?: unknown };
    return typeof parsed.fetched === "number" && parsed.fetched > 0;
  } catch {
    return false;
  }
};
