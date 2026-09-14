/**
 * @file filesystemSnapshotStore.test.ts
 * @module engage-mt/services/cache
 * @description Round-trips a snapshot through the mocked filesystem, tolerates
 *              missing or corrupt files, and no-ops on the web.
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
  files: new Map<string, string>(),
}));
vi.mock("@/utils/capacitor", () => ({ isCapacitor: h.isCapacitor }));
vi.mock("@/utils/logger", () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));
vi.mock("@capacitor/filesystem", () => ({
  Filesystem: {
    readFile: async ({ path }: { path: string }) => {
      const data = h.files.get(path);
      if (data === undefined) throw new Error("ENOENT");
      return { data };
    },
    writeFile: async ({ path, data }: { path: string; data: string }) => {
      h.files.set(path, data);
    },
  },
  Directory: { Data: "DATA" },
}));

import { makeFilesystemSnapshotStore, snapshotFilePath } from "./filesystemSnapshotStore";

beforeEach(() => {
  h.files.clear();
  h.isCapacitor.mockReturnValue(true);
});

describe("filesystemSnapshotStore", () => {
  it("writes and reads a snapshot with its fetchedAt stamp", async () => {
    const store = makeFilesystemSnapshotStore("regs");
    await store.write("district-notes-2026", { data: [1] }, "2026-09-01T00:00:00Z");
    expect(h.files.has(snapshotFilePath("regs", "district-notes-2026"))).toBe(true);
    await expect(store.read("district-notes-2026")).resolves.toEqual({
      body: { data: [1] },
      fetchedAt: "2026-09-01T00:00:00Z",
    });
  });

  it("returns null for a missing or corrupt file", async () => {
    const store = makeFilesystemSnapshotStore("regs");
    await expect(store.read("nothing")).resolves.toBeNull();
    h.files.set(snapshotFilePath("regs", "bad"), "{not json");
    await expect(store.read("bad")).resolves.toBeNull();
  });

  it("is a no-op on the web", async () => {
    h.isCapacitor.mockReturnValue(false);
    const store = makeFilesystemSnapshotStore("regs");
    await store.write("k", {}, "2026-09-01T00:00:00Z");
    expect(h.files.size).toBe(0);
    await expect(store.read("k")).resolves.toBeNull();
  });
});
