/**
 * @file filesystemSnapshotStore.ts
 * @module engage-mt/services/cache
 * @description A SnapshotStore over the device filesystem: the same
 *              read/write contract as the Cache Storage store, kept under the
 *              app's data directory so a copy survives web-view cache
 *              eviction. Off the device every call is a no-op.
 * @author Jamie Ellis / Engage MT
 * @created 2026-09-06
 * @updated 2026-09-06
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { isCapacitor } from "@/utils/capacitor";
import { createLogger } from "@/utils/logger";
import type { RawSnapshot, SnapshotStore } from "./snapshotStore";

const log = createLogger("fs-snapshot-store");

interface MinimalFs {
  readFile: (opts: {
    path: string;
    directory: string;
    encoding: string;
  }) => Promise<{ data: string }>;
  writeFile: (opts: {
    path: string;
    data: string;
    directory: string;
    encoding: string;
    recursive?: boolean;
  }) => Promise<unknown>;
}

interface StoredSnapshot {
  fetchedAt: string;
  body: unknown;
}

export const snapshotFilePath = (dir: string, cacheKey: string): string =>
  `${dir}/${encodeURIComponent(cacheKey)}.json`;

const filesystem = async (): Promise<{ fs: MinimalFs; directory: string }> => {
  const { Filesystem, Directory } = await import("@capacitor/filesystem");
  return {
    fs: Filesystem as unknown as MinimalFs,
    directory: (Directory as unknown as Record<string, string>).Data,
  };
};

export function makeFilesystemSnapshotStore(dir: string): SnapshotStore {
  return {
    async read(cacheKey: string): Promise<RawSnapshot | null> {
      if (!isCapacitor()) return null;
      try {
        const { fs, directory } = await filesystem();
        const { data } = await fs.readFile({
          path: snapshotFilePath(dir, cacheKey),
          directory,
          encoding: "utf8",
        });
        const parsed = JSON.parse(data) as Partial<StoredSnapshot>;
        if (!parsed || typeof parsed !== "object" || !("body" in parsed)) return null;
        return {
          body: parsed.body,
          fetchedAt: typeof parsed.fetchedAt === "string" ? parsed.fetchedAt : null,
        };
      } catch {
        return null;
      }
    },
    async write(cacheKey: string, body: unknown, fetchedAt: string): Promise<void> {
      if (!isCapacitor()) return;
      try {
        const { fs, directory } = await filesystem();
        const stored: StoredSnapshot = { fetchedAt, body };
        await fs.writeFile({
          path: snapshotFilePath(dir, cacheKey),
          data: JSON.stringify(stored),
          directory,
          encoding: "utf8",
          recursive: true,
        });
      } catch (err) {
        log.warn("field copy write failed", { cacheKey, error: String(err) });
      }
    },
  };
}
