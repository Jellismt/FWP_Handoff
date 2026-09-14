/**
 * @file gpxFileExport.ts
 * @module engage-mt/services/field
 * @description Exports the whole field library (waypoints and tracks) as one
 *              GPX file. On the device the file is written to the app cache
 *              and handed to the share sheet; on the web it downloads.
 * @author Jamie Ellis / Engage MT
 * @created 2026-09-06
 * @updated 2026-09-06
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import type { CapturedRoute, Waypoint } from "@/store/field/fieldToolsStore";
import { isCapacitor } from "@/utils/capacitor";
import { createLogger } from "@/utils/logger";
import { buildGpxBundle } from "./gpxExport";

const log = createLogger("gpx-file-export");

export type GpxExportOutcome = "shared" | "downloaded" | "empty" | "failed";

export const gpxFileName = (now: Date = new Date()): string =>
  `engage-mt-field-${now.toISOString().slice(0, 10)}.gpx`;

const downloadOnWeb = (gpx: string, fileName: string): void => {
  const blob = new Blob([gpx], { type: "application/gpx+xml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const shareOnDevice = async (gpx: string, fileName: string): Promise<void> => {
  const [{ Filesystem, Directory }, { Share }] = await Promise.all([
    import("@capacitor/filesystem"),
    import("@capacitor/share"),
  ]);
  const path = `exports/${fileName}`;
  await Filesystem.writeFile({
    path,
    data: gpx,
    directory: Directory.Cache,
    encoding: "utf8" as never,
    recursive: true,
  });
  const { uri } = await Filesystem.getUri({ path, directory: Directory.Cache });
  await Share.share({ title: "Engage MT field library", url: uri, dialogTitle: "Export GPX" });
};

export const exportLibraryGpx = async (
  waypoints: readonly Waypoint[],
  routes: readonly CapturedRoute[],
): Promise<GpxExportOutcome> => {
  if (waypoints.length === 0 && routes.length === 0) return "empty";
  const gpx = buildGpxBundle(waypoints, routes);
  const fileName = gpxFileName();
  try {
    if (isCapacitor()) {
      await shareOnDevice(gpx, fileName);
      return "shared";
    }
    downloadOnWeb(gpx, fileName);
    return "downloaded";
  } catch (err) {
    log.warn("GPX export failed", { error: err instanceof Error ? err.message : String(err) });
    return "failed";
  }
};
