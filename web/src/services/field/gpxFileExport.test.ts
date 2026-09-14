/**
 * @file gpxFileExport.test.ts
 * @module engage-mt/services/field
 * @description Empty libraries are refused, the web path downloads a GPX
 *              blob, and the device path writes to the cache and shares it.
 * @author Jamie Ellis / Engage MT
 * @created 2026-09-06
 * @updated 2026-09-06
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  isCapacitor: vi.fn(() => false),
  writeFile: vi.fn(async () => undefined),
  getUri: vi.fn(async () => ({ uri: "file:///cache/exports/x.gpx" })),
  share: vi.fn(async () => undefined),
}));
vi.mock("@/utils/capacitor", () => ({ isCapacitor: h.isCapacitor }));
vi.mock("@/utils/logger", () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));
vi.mock("@capacitor/filesystem", () => ({
  Filesystem: { writeFile: h.writeFile, getUri: h.getUri },
  Directory: { Cache: "CACHE", Data: "DATA" },
}));
vi.mock("@capacitor/share", () => ({ Share: { share: h.share } }));

import { exportLibraryGpx, gpxFileName } from "./gpxFileExport";
import type { CapturedRoute, Waypoint } from "@/store/field/fieldToolsStore";

const waypoint = {
  id: "w1",
  name: "Camp",
  kind: "general",
  lat: 46,
  lon: -111,
  createdAt: "2026-09-06T00:00:00Z",
  photos: [],
} as unknown as Waypoint;
const route = {
  id: "r1",
  name: "Walk",
  path: [
    [-111, 46],
    [-111, 46.001],
  ],
  distanceMi: 0.07,
  gainFt: 0,
  startedAt: "2026-09-06T00:00:00Z",
  endedAt: "2026-09-06T01:00:00Z",
} as CapturedRoute;

beforeEach(() => {
  vi.clearAllMocks();
  h.isCapacitor.mockReturnValue(false);
});

describe("exportLibraryGpx", () => {
  it("names the file by date and refuses an empty library", async () => {
    expect(gpxFileName(new Date("2026-09-06T12:00:00Z"))).toBe("engage-mt-field-2026-09-06.gpx");
    await expect(exportLibraryGpx([], [])).resolves.toBe("empty");
  });

  it("downloads a GPX blob on the web", async () => {
    const createObjectURL = vi.fn(() => "blob:x");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { ...URL, createObjectURL, revokeObjectURL });
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);
    await expect(exportLibraryGpx([waypoint], [route])).resolves.toBe("downloaded");
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(click).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
    click.mockRestore();
  });

  it("writes to the cache directory and opens the share sheet on the device", async () => {
    h.isCapacitor.mockReturnValue(true);
    await expect(exportLibraryGpx([waypoint], [route])).resolves.toBe("shared");
    expect(h.writeFile).toHaveBeenCalledWith(
      expect.objectContaining({
        directory: "CACHE",
        path: expect.stringMatching(/^exports\/engage-mt-field-.*\.gpx$/),
      }),
    );
    expect(h.share).toHaveBeenCalledWith(
      expect.objectContaining({ url: "file:///cache/exports/x.gpx" }),
    );
  });

  it("reports failure when the share sheet throws", async () => {
    h.isCapacitor.mockReturnValue(true);
    h.share.mockRejectedValueOnce(new Error("cancelled"));
    await expect(exportLibraryGpx([waypoint], [route])).resolves.toBe("failed");
  });
});
