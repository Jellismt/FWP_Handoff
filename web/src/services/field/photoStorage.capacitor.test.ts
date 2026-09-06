/**
 * @file photoStorage.capacitor.test.ts
 * @module engage-mt/services/field
 * @description Unit tests for the Capacitor branch of the waypoint-photo storage
 *              abstraction — the on-device write path the web-only companion
 *              suite (`photoStorage.test.ts`, isCapacitor:false) cannot reach.
 *              `isCapacitor` is forced true and `@capacitor/filesystem` is mocked
 *              at the import seam so the tests drive: base64 extraction from the
 *              data-URI, the per-mime extension, the mkdir+writeFile to
 *              Directory.Data (never public Documents — MB-2), returning the
 *              persistent file:// URI, the malformed-data-URI passthrough, the
 *              write-failure fallback to the original URI (no photo loss), and
 *              deletePhotoFile trying every extension idempotently.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-03
 * @updated 2026-07-03
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const fs = vi.hoisted(() => ({
  mkdir: vi.fn(async (_a: { path: string; directory: string; recursive?: boolean }) => undefined),
  writeFile: vi.fn(async (_a: { path: string; directory: string; data: string }) => undefined),
  getUri: vi.fn(async (_a: { path: string; directory: string }) => ({
    uri: "file:///data/field/photos/p1.jpg",
  })),
  deleteFile: vi.fn(async (_a: { path: string; directory: string }) => undefined),
}));

vi.mock("@/utils/capacitor", () => ({ isCapacitor: () => true }));
vi.mock("@capacitor/filesystem", () => ({
  Filesystem: fs,
  Directory: { Data: "DATA", Documents: "DOCUMENTS" },
}));

import { persistPhoto, deletePhotoFile } from "./photoStorage";

const JPEG = "data:image/jpeg;base64,QUJD"; // "ABC"

beforeEach(() => vi.clearAllMocks());

describe("persistPhoto — Capacitor write path", () => {
  it("writes the decoded bytes under Directory.Data and returns the file:// URI", async () => {
    const uri = await persistPhoto("p1", JPEG);
    expect(uri).toBe("file:///data/field/photos/p1.jpg");

    expect(fs.mkdir).toHaveBeenCalledWith(
      expect.objectContaining({ path: "field/photos", directory: "DATA", recursive: true }),
    );
    const write = fs.writeFile.mock.calls[0]![0];
    expect(write).toMatchObject({
      path: "field/photos/p1.jpg",
      directory: "DATA",
      data: "QUJD",
    });
    // MB-2: must never write to public Documents.
    expect(write.directory).not.toBe("DOCUMENTS");
  });

  it("uses the right extension for a PNG data-URI", async () => {
    await persistPhoto("p2", "data:image/png;base64,QUJD");
    expect(fs.writeFile.mock.calls[0]![0].path).toBe("field/photos/p2.png");
  });

  it("returns the input verbatim for a non-data-URI (nothing to persist)", async () => {
    const uri = await persistPhoto("p3", "https://example.com/not-a-data-uri.jpg");
    expect(uri).toBe("https://example.com/not-a-data-uri.jpg");
    expect(fs.writeFile).not.toHaveBeenCalled();
  });

  it("falls back to the original data-URI when the write fails (no photo loss)", async () => {
    fs.writeFile.mockRejectedValueOnce(new Error("disk full"));
    const uri = await persistPhoto("p4", JPEG);
    expect(uri).toBe(JPEG);
  });

  it("ignores an already-exists mkdir error and still writes the file", async () => {
    fs.mkdir.mockRejectedValueOnce(new Error("EEXIST"));
    const uri = await persistPhoto("p5", JPEG);
    expect(fs.writeFile).toHaveBeenCalled();
    expect(uri).toBe("file:///data/field/photos/p1.jpg");
  });
});

describe("deletePhotoFile — Capacitor", () => {
  it("attempts deletion for every candidate extension under Directory.Data", async () => {
    await deletePhotoFile("p1");
    const paths = fs.deleteFile.mock.calls.map((c) => c[0]!.path);
    expect(paths).toEqual([
      "field/photos/p1.jpg",
      "field/photos/p1.png",
      "field/photos/p1.heic",
      "field/photos/p1.webp",
    ]);
    expect(fs.deleteFile.mock.calls.every((c) => c[0]!.directory === "DATA")).toBe(true);
  });

  it("swallows a missing-file error (idempotent delete)", async () => {
    fs.deleteFile.mockRejectedValue(new Error("ENOENT"));
    await expect(deletePhotoFile("gone")).resolves.toBeUndefined();
  });
});
