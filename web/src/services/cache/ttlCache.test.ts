/**
 * @file ttlCache.test.ts
 * @module engage-mt/services/cache
 * @description R.2b — Characterization test for the canonical TTL + inflight-
 *              dedup cache. Verifies cache-hit on a fresh entry, dedup of
 *              concurrent loads for the same key, failure-not-cached
 *              semantics, and namespaced invalidation.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-06
 * @updated 2026-06-17
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { describe, expect, it, beforeEach, vi } from "vitest";
import {
  MAX_ENTRIES_PER_NAMESPACE,
  ttlCache,
  invalidate,
  __resetAllCaches,
} from "@/services/cache/ttlCache";

describe("ttlCache", () => {
  beforeEach(() => __resetAllCaches());

  it("returns the loader value on first call", async () => {
    const loader = vi.fn().mockResolvedValue("v1");
    const out = await ttlCache("ns", "k", 1000, loader);
    expect(out).toBe("v1");
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it("returns the cached value on a second call within ttl", async () => {
    const loader = vi.fn().mockResolvedValue("v1");
    await ttlCache("ns", "k", 1000, loader);
    const out = await ttlCache("ns", "k", 1000, loader);
    expect(out).toBe("v1");
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it("dedups concurrent in-flight loads of the same key", async () => {
    let resolveFn: (v: string) => void = () => undefined;
    const loader = vi.fn().mockImplementation(
      () =>
        new Promise<string>((resolve) => {
          resolveFn = resolve;
        }),
    );
    const a = ttlCache("ns", "k", 1000, loader);
    const b = ttlCache("ns", "k", 1000, loader);
    resolveFn("v1");
    const [ra, rb] = await Promise.all([a, b]);
    expect(ra).toBe("v1");
    expect(rb).toBe("v1");
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it("does NOT cache a failing loader — next call retries", async () => {
    const loader = vi.fn().mockRejectedValueOnce(new Error("boom")).mockResolvedValueOnce("v2");
    await expect(ttlCache("ns", "k", 1000, loader)).rejects.toThrow("boom");
    const out = await ttlCache("ns", "k", 1000, loader);
    expect(out).toBe("v2");
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it("namespaces are isolated — same key in two namespaces is two entries", async () => {
    await ttlCache("nsA", "k", 1000, async () => "A");
    await ttlCache("nsB", "k", 1000, async () => "B");
    expect(await ttlCache("nsA", "k", 1000, async () => "skipped")).toBe("A");
    expect(await ttlCache("nsB", "k", 1000, async () => "skipped")).toBe("B");
  });

  it("invalidate(namespace, key) drops that entry only", async () => {
    await ttlCache("ns", "k1", 1000, async () => "1");
    await ttlCache("ns", "k2", 1000, async () => "2");
    invalidate("ns", "k1");
    const loader = vi.fn().mockResolvedValue("1-fresh");
    const out = await ttlCache("ns", "k1", 1000, loader);
    expect(out).toBe("1-fresh");
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it("invalidate(namespace) drops every entry in that namespace", async () => {
    await ttlCache("ns", "k1", 1000, async () => "1");
    await ttlCache("ns", "k2", 1000, async () => "2");
    invalidate("ns");
    const loader = vi.fn().mockResolvedValue("after");
    await ttlCache("ns", "k1", 1000, loader);
    await ttlCache("ns", "k2", 1000, loader);
    expect(loader).toHaveBeenCalledTimes(2);
  });
});

describe("ttlCache — bounded growth", () => {
  it("drops a stale entry on read instead of keeping it until that key returns", async () => {
    const loader = vi.fn(async () => "v");
    const now = Date.now();
    const clock = vi.spyOn(Date, "now");
    clock.mockReturnValue(now);
    await ttlCache("ns", "k", 10, loader);
    clock.mockReturnValue(now + 50);
    await ttlCache("ns", "k", 10, loader);
    expect(loader).toHaveBeenCalledTimes(2);
    clock.mockRestore();
  });

  it("evicts least-recently-written entries past the per-namespace cap", async () => {
    for (let i = 0; i < MAX_ENTRIES_PER_NAMESPACE + 10; i += 1) {
      await ttlCache("big", `k${i}`, 60_000, async () => i);
    }
    // The ten oldest keys are gone, so asking for one loads again.
    const reload = vi.fn(async () => -1);
    await ttlCache("big", "k0", 60_000, reload);
    expect(reload).toHaveBeenCalledTimes(1);
    // A recent key is still cached.
    const untouched = vi.fn(async () => -1);
    await ttlCache("big", `k${MAX_ENTRIES_PER_NAMESPACE + 5}`, 60_000, untouched);
    expect(untouched).not.toHaveBeenCalled();
  });
});
