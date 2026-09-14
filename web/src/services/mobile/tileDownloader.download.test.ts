/**
 * @file tileDownloader.download.test.ts
 * @module engage-mt/services/mobile
 * @description Unit tests for the tileDownloader runtime branches not covered
 *              by the enumeration-math suite: the web no-op fast path, the
 *              Capacitor download loop (filesystem writes, failed-tile
 *              counting, resume-from-manifest skip, calibration sample), and
 *              readAreaManifest across platform + parse branches. The
 *              @capacitor/filesystem plugin is mocked at the import seam.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-01
 * @updated 2026-07-03
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  isCapacitor: vi.fn(() => false),
  recordTileSizeSample: vi.fn(),
  writeFile: vi.fn(async () => undefined),
  readFile: vi.fn(),
}));

vi.mock("@/utils/capacitor", () => ({ isCapacitor: h.isCapacitor }));
vi.mock("@/utils/logger", () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));
vi.mock("./offlineTileQuota", () => ({ recordTileSizeSample: h.recordTileSizeSample }));
vi.mock("@capacitor/filesystem", () => ({
  Filesystem: { writeFile: h.writeFile, readFile: h.readFile },
  Directory: { Documents: "DOCUMENTS", Data: "DATA" },
}));

import { bytesToBase64, downloadArea, readAreaManifest } from "./tileDownloader";
import { latToTileY, lonToTileX } from "./tileMath";

// A tiny single-zoom bbox so enumerateTiles yields exactly one tile.
const TINY_BBOX = { north: 46.6, south: 46.6, east: -111.9, west: -111.9 };

const TEMPLATE = "https://tiles.example/{z}/{y}/{x}";
const okResponse = (bytes: number) => ({
  ok: true,
  arrayBuffer: async () => new Uint8Array(bytes).buffer,
});

beforeEach(() => {
  vi.clearAllMocks();
  h.isCapacitor.mockReturnValue(false);
  h.readFile.mockReset();
  h.writeFile.mockReset();
  h.writeFile.mockResolvedValue(undefined);
  vi.stubGlobal("fetch", vi.fn());
});

describe("downloadArea — web no-op path", () => {
  it("skips writes and reports full completion without hitting the network", async () => {
    const onProgress = vi.fn();
    const progress = await downloadArea({
      areaId: "web-area",
      bbox: TINY_BBOX,
      urlTemplate: TEMPLATE,
      tileExtension: "png",
      minZoom: 10,
      maxZoom: 10,
      onProgress,
    });
    expect(progress.percent).toBe(100);
    expect(progress.fetched).toBe(progress.total);
    expect(progress.total).toBeGreaterThan(0);
    expect(fetch).not.toHaveBeenCalled();
    expect(h.writeFile).not.toHaveBeenCalled();
    expect(onProgress).toHaveBeenCalledWith(progress);
  });
});

describe("downloadArea — Capacitor path", () => {
  beforeEach(() => {
    h.isCapacitor.mockReturnValue(true);
    h.readFile.mockRejectedValue(new Error("no manifest yet"));
  });

  it("fetches, writes each tile, records a calibration sample, and persists a manifest", async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(okResponse(1024));
    const progress = await downloadArea({
      areaId: "cap-area",
      bbox: TINY_BBOX,
      urlTemplate: TEMPLATE,
      tileExtension: "png",
      minZoom: 10,
      maxZoom: 10,
    });
    expect(progress.fetched).toBe(progress.total);
    expect(progress.failed).toBe(0);
    // One tile write + one manifest write.
    const paths = h.writeFile.mock.calls.map((c) => ((c as unknown[])[0] as { path: string }).path);
    expect(paths.some((p) => p.endsWith(".png"))).toBe(true);
    expect(paths).toContain("tiles/cap-area/manifest.json");
    expect(progress.bytes).toBe(1024);
    const manifest = JSON.parse(
      ((h.writeFile.mock.calls.at(-1) as unknown[])[0] as never as string) === undefined
        ? "{}"
        : ((h.writeFile.mock.calls.at(-1) as unknown[])[0] as { data: string }).data,
    );
    // The manifest is JSON, so it must be written as text. Without an explicit
    // encoding the plugin treats `data` as base64, fails to decode it, and the
    // manifest is silently lost — which breaks resume and makes a downloaded
    // area look absent on the next launch.
    const manifestCall = h.writeFile.mock.calls
      .map((c) => (c as unknown[])[0] as { path: string; encoding?: string })
      .find((c) => c.path.endsWith("manifest.json"));
    expect(manifestCall?.encoding).toBe("utf8");
    // Tiles are the opposite: no encoding, so the plugin decodes the base64 and
    // writes real bytes.
    const tileCall = h.writeFile.mock.calls
      .map((c) => (c as unknown[])[0] as { path: string; encoding?: string })
      .find((c) => c.path.endsWith(".png"));
    expect(tileCall?.encoding).toBeUndefined();
    expect(manifest.urlTemplate).toBe(TEMPLATE);
    expect(manifest.minZoom).toBe(10);
    expect(manifest.bytes).toBe(1024);
    // Calibration sample recorded (bytes/tile).
    expect(h.recordTileSizeSample).toHaveBeenCalledWith(1024);
  });

  it("counts a non-ok response as a failed tile and records no calibration", async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false });
    const progress = await downloadArea({
      areaId: "fail-area",
      bbox: TINY_BBOX,
      urlTemplate: TEMPLATE,
      tileExtension: "png",
      minZoom: 10,
      maxZoom: 10,
    });
    expect(progress.failed).toBe(progress.total);
    expect(progress.fetched).toBe(0);
    expect(h.recordTileSizeSample).not.toHaveBeenCalled();
  });

  it("counts a thrown fetch as a failed tile (does not reject)", async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("boom"));
    const progress = await downloadArea({
      areaId: "throw-area",
      bbox: TINY_BBOX,
      urlTemplate: TEMPLATE,
      tileExtension: "png",
      minZoom: 10,
      maxZoom: 10,
    });
    expect(progress.failed).toBe(progress.total);
  });

  it("resumes from a prior manifest for the same tile source, skipping tiles on disk", async () => {
    const key = `10/${lonToTileX(TINY_BBOX.west, 10)}/${latToTileY(TINY_BBOX.north, 10)}`;
    h.readFile.mockResolvedValue({
      data: JSON.stringify({
        areaId: "resume-area",
        urlTemplate: TEMPLATE,
        tileExtension: "png",
        fetched: 1,
        total: 1,
        failed: 0,
        bytes: 900,
        completedTiles: [key],
      }),
    });
    const progress = await downloadArea({
      areaId: "resume-area",
      bbox: TINY_BBOX,
      urlTemplate: TEMPLATE,
      tileExtension: "png",
      minZoom: 10,
      maxZoom: 10,
    });
    expect(fetch).not.toHaveBeenCalled();
    expect(progress.fetched).toBe(1);
    expect(progress.bytes).toBe(900);
  });

  it("starts over when the prior manifest came from a different tile source", async () => {
    const key = `10/${lonToTileX(TINY_BBOX.west, 10)}/${latToTileY(TINY_BBOX.north, 10)}`;
    h.readFile.mockResolvedValue({
      data: JSON.stringify({
        areaId: "old-area",
        urlTemplate: "https://old.example/{z}/{x}/{y}.png",
        fetched: 1,
        total: 1,
        failed: 0,
        completedTiles: [key],
      }),
    });
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(okResponse(10));
    const progress = await downloadArea({
      areaId: "old-area",
      bbox: TINY_BBOX,
      urlTemplate: TEMPLATE,
      tileExtension: "png",
      minZoom: 10,
      maxZoom: 10,
    });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(progress.fetched).toBe(1);
  });

  it("includes the overview levels down to minZoom", async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(okResponse(10));
    const progress = await downloadArea({
      areaId: "floor-area",
      bbox: TINY_BBOX,
      urlTemplate: TEMPLATE,
      tileExtension: "png",
      minZoom: 6,
      maxZoom: 10,
    });
    expect(progress.total).toBe(5);
    const urls = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.map(
      (c) => c[0] as string,
    );
    expect(urls.some((u) => u.startsWith("https://tiles.example/6/"))).toBe(true);
  });
});

describe("bytesToBase64", () => {
  it("matches btoa for small input and handles input larger than one chunk", () => {
    const small = new TextEncoder().encode("hello");
    expect(bytesToBase64(small)).toBe(btoa("hello"));
    const big = new Uint8Array(0x8000 * 3 + 7).fill(65);
    expect(bytesToBase64(big)).toBe(btoa("A".repeat(big.length)));
  });
});

describe("readAreaManifest", () => {
  it("returns null on the web (no Capacitor)", async () => {
    h.isCapacitor.mockReturnValue(false);
    await expect(readAreaManifest("x")).resolves.toBeNull();
  });

  it("parses a valid persisted manifest on Capacitor", async () => {
    h.isCapacitor.mockReturnValue(true);
    h.readFile.mockResolvedValue({
      data: JSON.stringify({
        areaId: "a1",
        fetched: 3,
        total: 10,
        failed: 1,
        completedTiles: ["10/1/1", "10/1/2", 42],
      }),
    });
    const manifest = await readAreaManifest("a1");
    expect(manifest?.bytes).toBe(0);
    expect(manifest?.fetched).toBe(3);
    expect(manifest?.total).toBe(10);
    expect(manifest?.failed).toBe(1);
    // Non-string completedTiles entries are filtered out.
    expect(manifest?.completedTiles).toEqual(["10/1/1", "10/1/2"]);
  });

  it("returns null when the manifest is missing / unreadable", async () => {
    h.isCapacitor.mockReturnValue(true);
    h.readFile.mockRejectedValue(new Error("ENOENT"));
    await expect(readAreaManifest("gone")).resolves.toBeNull();
  });

  it("defaults numeric fields when the persisted manifest is malformed", async () => {
    h.isCapacitor.mockReturnValue(true);
    h.readFile.mockResolvedValue({ data: JSON.stringify({ areaId: "m" }) });
    const manifest = await readAreaManifest("m");
    expect(manifest).toEqual({
      areaId: "m",
      completedAt: undefined,
      fetched: 0,
      total: 0,
      failed: 0,
      bytes: 0,
      completedTiles: [],
    });
  });
});
