/**
 * @file snapshotStore.test.ts
 * @module engage-mt/services/cache
 * @description Unit tests for the reusable Cache-Storage snapshot store. Uses a
 *              minimal in-memory stub of the Web Cache-Storage API so the store's
 *              read/write + x-fetched-at stamping is exercised without a browser.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-14
 * @updated 2026-07-14
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { makeSnapshotStore } from "./snapshotStore";

/** Tiny in-memory stand-in for the Cache-Storage API. */
class FakeCache {
  private store = new Map<string, Response>();
  async match(key: string): Promise<Response | undefined> {
    return this.store.get(key);
  }
  async put(key: string, res: Response): Promise<void> {
    this.store.set(key, res);
  }
}

const buckets = new Map<string, FakeCache>();

beforeEach(() => {
  buckets.clear();
  vi.stubGlobal("caches", {
    open: async (name: string) => {
      if (!buckets.has(name)) buckets.set(name, new FakeCache());
      return buckets.get(name)!;
    },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("makeSnapshotStore", () => {
  it("round-trips a body and preserves the fetched-at stamp", async () => {
    const store = makeSnapshotStore("test-bucket");
    await store.write("k1", { hello: "world" }, "2026-07-14T10:00:00.000Z");
    const raw = await store.read("k1");
    expect(raw).not.toBeNull();
    expect(raw?.body).toEqual({ hello: "world" });
    expect(raw?.fetchedAt).toBe("2026-07-14T10:00:00.000Z");
  });

  it("returns null on a miss", async () => {
    const store = makeSnapshotStore("test-bucket");
    expect(await store.read("absent")).toBeNull();
  });

  it("isolates keys by bucket name", async () => {
    const a = makeSnapshotStore("bucket-a");
    const b = makeSnapshotStore("bucket-b");
    await a.write("same-key", { from: "a" }, "2026-07-14T10:00:00.000Z");
    expect(await b.read("same-key")).toBeNull();
    expect((await a.read("same-key"))?.body).toEqual({ from: "a" });
  });

  it("no-ops safely when Cache-Storage is unavailable", async () => {
    vi.stubGlobal("caches", undefined);
    const store = makeSnapshotStore("test-bucket");
    await expect(store.write("k", {}, "t")).resolves.toBeUndefined();
    expect(await store.read("k")).toBeNull();
  });
});
