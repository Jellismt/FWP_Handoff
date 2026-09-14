/**
 * @file offlineAreaFiles.test.ts
 * @module engage-mt/services/mobile
 * @description Area deletion removes every directory and file, tolerates
 *              missing paths, and tile presence reads the manifest.
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
  isCapacitor: vi.fn(() => true),
  rmdir: vi.fn(async () => undefined),
  deleteFile: vi.fn(async () => undefined),
  readFile: vi.fn(),
}));
vi.mock("@/utils/capacitor", () => ({ isCapacitor: h.isCapacitor }));
vi.mock("@capacitor/filesystem", () => ({
  Filesystem: { rmdir: h.rmdir, deleteFile: h.deleteFile, readFile: h.readFile },
  Directory: { Data: "DATA" },
}));

import { areaTilesPresent, deleteAreaFiles } from "./offlineAreaFiles";

beforeEach(() => {
  vi.clearAllMocks();
  h.isCapacitor.mockReturnValue(true);
});

describe("deleteAreaFiles", () => {
  it("removes the tile and data directories and the regs file", async () => {
    await deleteAreaFiles("a1");
    expect(h.rmdir.mock.calls.map((c) => (c as unknown[])[0])).toEqual([
      { path: "tiles/a1", directory: "DATA", recursive: true },
      { path: "data/a1", directory: "DATA", recursive: true },
    ]);
    expect(h.deleteFile).toHaveBeenCalledWith({ path: "regs/areas/a1.json", directory: "DATA" });
  });

  it("ignores paths that are already gone", async () => {
    h.rmdir.mockRejectedValue(new Error("ENOENT"));
    h.deleteFile.mockRejectedValue(new Error("ENOENT"));
    await expect(deleteAreaFiles("a1")).resolves.toBeUndefined();
  });

  it("is a no-op on the web", async () => {
    h.isCapacitor.mockReturnValue(false);
    await deleteAreaFiles("a1");
    expect(h.rmdir).not.toHaveBeenCalled();
  });
});

describe("areaTilesPresent", () => {
  it("is true only for a manifest with fetched tiles", async () => {
    h.readFile.mockResolvedValue({ data: JSON.stringify({ fetched: 3 }) });
    await expect(areaTilesPresent("a1")).resolves.toBe(true);
    h.readFile.mockResolvedValue({ data: JSON.stringify({ fetched: 0 }) });
    await expect(areaTilesPresent("a1")).resolves.toBe(false);
    h.readFile.mockRejectedValue(new Error("ENOENT"));
    await expect(areaTilesPresent("a1")).resolves.toBe(false);
  });
});
