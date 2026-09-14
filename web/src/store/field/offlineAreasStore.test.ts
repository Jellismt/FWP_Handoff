/**
 * @file offlineAreasStore.test.ts
 * @module engage-mt/store/field
 * @description Staging limits, legacy key migration, the two download legs,
 *              file cleanup on removal, persistence requests, and hydration
 *              from the mirrored index.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-08
 * @updated 2026-09-06
 * @version 2.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  isCapacitor: vi.fn(() => false),
  downloadArea: vi.fn(),
  downloadRegionData: vi.fn(),
  captureAreaRegs: vi.fn(),
  deleteAreaFiles: vi.fn(async () => undefined),
  areaTilesPresent: vi.fn(async (_id: string) => true),
  requestPersistentStorage: vi.fn(async () => true),
  readFile: vi.fn(),
  writeFile: vi.fn(async () => undefined),
}));
vi.mock("@/utils/capacitor", () => ({ isCapacitor: h.isCapacitor }));
vi.mock("@/services/mobile/tileDownloader", () => ({ downloadArea: h.downloadArea }));
vi.mock("@/services/mobile/vectorDownloader", () => ({ downloadRegionData: h.downloadRegionData }));
vi.mock("@/services/mobile/regsCapture", () => ({ captureAreaRegs: h.captureAreaRegs }));
vi.mock("@/services/mobile/offlineAreaFiles", () => ({
  deleteAreaFiles: h.deleteAreaFiles,
  areaTilesPresent: h.areaTilesPresent,
}));
vi.mock("@/services/cache/persistentStorage", () => ({
  requestPersistentStorage: h.requestPersistentStorage,
}));
vi.mock("@capacitor/filesystem", () => ({
  Filesystem: { readFile: h.readFile, writeFile: h.writeFile },
  Directory: { Data: "DATA" },
}));

import { MAX_AREAS, OFFLINE_AREAS_KEY, useOfflineAreasStore } from "./offlineAreasStore";
import { DEFAULT_OFFLINE_MAX_BYTES } from "@/services/mobile/offlineTileQuota";

const smallDraft = {
  label: "Test area",
  bbox: { north: 45.6, south: 45.5, east: -111.4, west: -111.5 },
  maxZoom: 11,
  basemap: "usgsTopo" as const,
};

const tilesDone = { fetched: 50, total: 50, failed: 0, bytes: 1_000_000, percent: 100 };
const dataDone = {
  fetchedLayers: 3,
  totalLayers: 3,
  failedLayers: 0,
  bytes: 200_000,
  percent: 100,
};

const regsDone = { ok: true, version: 9, districts: ["380", "410"], bytes: 50_000 };

beforeEach(() => {
  vi.clearAllMocks();
  h.isCapacitor.mockReturnValue(false);
  h.areaTilesPresent.mockResolvedValue(true);
  window.localStorage.clear();
  useOfflineAreasStore.setState({ areas: [] });
  h.downloadArea.mockResolvedValue(tilesDone);
  h.downloadRegionData.mockResolvedValue(dataDone);
  h.captureAreaRegs.mockResolvedValue(regsDone);
});

const queue = (draft = smallDraft) => {
  const r = useOfflineAreasStore.getState().queueArea(draft);
  if (!r.ok) throw new Error(`queue failed: ${r.reason}`);
  return r.area;
};
const find = (id: string) => useOfflineAreasStore.getState().areas.find((a) => a.id === id);

describe("offlineAreasStore — staging", () => {
  it("stages an area and persists a plain array", () => {
    const area = queue();
    expect(area.status).toBe("queued");
    expect(area.basemap).toBe("usgsTopo");
    const parsed = JSON.parse(window.localStorage.getItem(OFFLINE_AREAS_KEY) ?? "null");
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed[0].id).toBe(area.id);
  });

  it("falls back to 'Untitled area' and clamps the max zoom", () => {
    const area = queue({ ...smallDraft, label: "   ", maxZoom: 40 });
    expect(area.label).toBe("Untitled area");
    expect(area.maxZoom).toBe(16);
  });

  it("rejects an area that would exceed the cap", () => {
    useOfflineAreasStore.setState({
      areas: [
        { ...queue(), id: "seed", estimatedBytes: DEFAULT_OFFLINE_MAX_BYTES, status: "downloaded" },
      ],
    });
    expect(useOfflineAreasStore.getState().queueArea(smallDraft)).toEqual({
      ok: false,
      reason: "over-cap",
    });
  });

  it("refuses more than the maximum number of areas instead of silently dropping one", () => {
    for (let i = 0; i < MAX_AREAS; i += 1) queue({ ...smallDraft, label: `Area ${i}` });
    expect(useOfflineAreasStore.getState().queueArea(smallDraft)).toEqual({
      ok: false,
      reason: "too-many",
    });
    expect(useOfflineAreasStore.getState().areas).toHaveLength(MAX_AREAS);
  });

  it("maps basemap keys from earlier builds when loading", async () => {
    window.localStorage.setItem(
      OFFLINE_AREAS_KEY,
      JSON.stringify([
        { ...queue(), id: "old", basemap: "worldTopo" },
        { ...queue(), id: "img", basemap: "imagery" },
      ]),
    );
    vi.resetModules();
    const fresh = await import("./offlineAreasStore");
    const byId = Object.fromEntries(
      fresh.useOfflineAreasStore.getState().areas.map((a) => [a.id, a.basemap]),
    );
    expect(byId.old).toBe("usgsTopo");
    expect(byId.img).toBe("usgsImageryTopo");
  });
});

describe("offlineAreasStore — removal", () => {
  it("drops the area and deletes its files", () => {
    const area = queue();
    useOfflineAreasStore.getState().removeArea(area.id);
    expect(useOfflineAreasStore.getState().areas).toHaveLength(0);
    expect(h.deleteAreaFiles).toHaveBeenCalledWith(area.id);
  });
});

describe("offlineAreasStore — download", () => {
  it("requests persistent storage, downloads the overview floor, and records actual bytes", async () => {
    const area = queue();
    await useOfflineAreasStore.getState().startDownload(area);
    expect(h.requestPersistentStorage).toHaveBeenCalledTimes(1);
    expect(h.downloadArea).toHaveBeenCalledWith(
      expect.objectContaining({
        minZoom: 6,
        maxZoom: 11,
        urlTemplate: expect.stringContaining("USGSTopo"),
      }),
    );
    const done = find(area.id);
    expect(done?.status).toBe("downloaded");
    expect(done?.minZoom).toBe(6);
    expect(done?.tileBytes).toBe(1_000_000);
    expect(done?.dataBytes).toBe(200_000);
    expect(done?.regsStatus).toBe("downloaded");
    expect(done?.regsVersion).toBe(9);
    expect(done?.regsDistricts).toEqual(["380", "410"]);
    expect(done?.estimatedBytes).toBe(1_250_000);
    expect(done?.progressPct).toBe(100);
  });

  it("does not mark an area downloaded when every tile failed", async () => {
    h.downloadArea.mockResolvedValue({ fetched: 0, total: 50, failed: 50, bytes: 0, percent: 100 });
    const area = queue();
    await useOfflineAreasStore.getState().startDownload(area);
    expect(find(area.id)?.status).toBe("failed");
  });

  it("does not mark an area downloaded when the region data failed", async () => {
    h.downloadRegionData.mockResolvedValue({ ...dataDone, failedLayers: 1 });
    const area = queue();
    await useOfflineAreasStore.getState().startDownload(area);
    expect(find(area.id)?.status).toBe("failed");
    expect(find(area.id)?.dataStatus).toBe("failed");
  });

  it("does not mark an area downloaded when the regulations capture failed", async () => {
    h.captureAreaRegs.mockResolvedValue({ ...regsDone, ok: false });
    const area = queue();
    await useOfflineAreasStore.getState().startDownload(area);
    expect(find(area.id)?.status).toBe("failed");
    expect(find(area.id)?.regsStatus).toBe("failed");
  });

  it("keeps the estimate when nothing was written (web preview)", async () => {
    h.downloadArea.mockResolvedValue({ ...tilesDone, bytes: 0 });
    h.downloadRegionData.mockResolvedValue({ ...dataDone, bytes: 0 });
    h.captureAreaRegs.mockResolvedValue({ ...regsDone, bytes: 0 });
    const area = queue();
    await useOfflineAreasStore.getState().startDownload(area);
    expect(find(area.id)?.estimatedBytes).toBe(area.estimatedBytes);
  });
});

describe("offlineAreasStore — hydrate", () => {
  it("is a no-op on the web", async () => {
    await useOfflineAreasStore.getState().hydrate();
    expect(h.readFile).not.toHaveBeenCalled();
  });

  it("restores a lost index from the mirrored file and demotes phantom downloads", async () => {
    const present = { ...queue(), id: "present", status: "downloaded" as const };
    const phantom = { ...queue(), id: "phantom", status: "downloaded" as const };
    useOfflineAreasStore.setState({ areas: [] });
    h.isCapacitor.mockReturnValue(true);
    h.readFile.mockResolvedValue({ data: JSON.stringify([present, phantom]) });
    h.areaTilesPresent.mockImplementation(async (id: string) => id === "present");
    await useOfflineAreasStore.getState().hydrate();
    expect(h.readFile).toHaveBeenCalledTimes(1);
    expect(useOfflineAreasStore.getState().areas.map((a) => a.id)).toEqual(["present", "phantom"]);
    expect(find("present")?.status).toBe("downloaded");
    expect(find("phantom")?.status).toBe("failed");
    await vi.waitFor(() =>
      expect(h.writeFile).toHaveBeenCalledWith(
        expect.objectContaining({ path: "offline-areas.json" }),
      ),
    );
  });
});
