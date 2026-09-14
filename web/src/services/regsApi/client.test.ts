/**
 * @file client.test.ts
 * @module engage-mt/services/regsApi
 * @description Reader order (API → newest stored copy → bundle), tier and
 *              version labelling, stale detection, session reuse rules, and
 *              in-flight de-duplication of the shared regs fetcher.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-04
 * @updated 2026-09-06
 * @version 3.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useConnectivityStore } from "@/store/app/connectivityStore";

const h = vi.hoisted(() => ({
  bundled: vi.fn(async (_key: string): Promise<unknown> => null),
  field: new Map<string, { body: unknown; fetchedAt: string | null }>(),
}));
vi.mock("@/services/regs/bundledRegsSnapshot", () => ({
  getBundledRegsEntry: (k: string) => h.bundled(k),
}));
vi.mock("@/services/cache/filesystemSnapshotStore", () => ({
  makeFilesystemSnapshotStore: () => ({
    read: async (key: string) => h.field.get(key) ?? null,
    write: async (key: string, body: unknown, fetchedAt: string) => {
      h.field.set(key, { body, fetchedAt });
    },
  }),
}));

import {
  RegsApiUnavailableError,
  computeStale,
  createRegsFetcher,
  regsApiBase,
  resetRegsApiCache,
} from "./client";

function installCachesStub(): Map<string, Response> {
  const store = new Map<string, Response>();
  const cache = {
    match: async (key: string) => store.get(key)?.clone() ?? undefined,
    put: async (key: string, res: Response) => {
      store.set(key, res);
    },
  };
  vi.stubGlobal("caches", { open: async () => cache, delete: async () => true });
  return store;
}

const ENVELOPE = {
  data: [{ label: "Deadline", date_code: "d1" }],
  meta: { generatedAt: "2026-07-07T00:00:00Z", version: 4, validUntil: "2027-02-28" },
};
const okFetch = () => vi.fn(async () => new Response(JSON.stringify(ENVELOPE), { status: 200 }));
const failFetch = () => vi.fn(async () => Promise.reject(new Error("offline")));

const config = {
  path: (y: number) => `/hunting/important-dates?year=${y}`,
  cacheKey: (y: number) => `test-dates-${y}`,
  label: (y: number) => `test dates ${y}`,
};

beforeEach(() => {
  resetRegsApiCache();
  h.field.clear();
  h.bundled.mockResolvedValue(null);
  useConnectivityStore.getState().setOnline(true);
  vi.stubEnv("VITE_FWP_API_BASE", "https://example.test/api/v1/fwp");
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("regsApiBase", () => {
  it("keeps v1 paths for v1 and rewrites them for v2", () => {
    expect(regsApiBase("v1")).toBe("https://example.test/api/v1/fwp");
    expect(regsApiBase("v2")).toBe("https://example.test/api/v2/fwp");
  });

  it("prefers the regs base, then an explicit v2 override", () => {
    vi.stubEnv("VITE_FWP_REGS_API_BASE", "https://regs.test/api/v1/fwp");
    expect(regsApiBase("v2")).toBe("https://regs.test/api/v2/fwp");
    vi.stubEnv("VITE_FWP_API_V2_BASE", "https://override.test/api/v2/fwp");
    expect(regsApiBase("v2")).toBe("https://override.test/api/v2/fwp");
    expect(regsApiBase("v1")).toBe("https://regs.test/api/v1/fwp");
  });

  it("is undefined when no base is configured", () => {
    vi.stubEnv("VITE_FWP_API_BASE", "");
    expect(regsApiBase("v2")).toBeUndefined();
  });
});

describe("computeStale", () => {
  const now = Date.parse("2026-09-06T00:00:00Z");
  it("flags a passed validUntil for every tier", () => {
    expect(computeStale("live", "2026-09-06T00:00:00Z", "2026-09-01", now)).toBe(true);
    expect(computeStale("live", "2026-09-06T00:00:00Z", "2026-09-06", now)).toBe(false);
  });
  it("flags stored copies older than the stale window, never live ones", () => {
    expect(computeStale("cached", "2026-05-01T00:00:00Z", null, now)).toBe(true);
    expect(computeStale("cached", "2026-08-01T00:00:00Z", null, now)).toBe(false);
    expect(computeStale("live", "2026-01-01T00:00:00Z", null, now)).toBe(false);
  });
});

describe("createRegsFetcher", () => {
  it("serves live, carries the version, and writes both stored copies", async () => {
    const store = installCachesStub();
    vi.stubGlobal("fetch", okFetch());
    const r = await createRegsFetcher<{ label: string }[]>(config)(2026);
    expect(r.data[0]!.label).toBe("Deadline");
    expect(r.freshness.tier).toBe("live");
    expect(r.freshness.version).toBe(4);
    expect(r.freshness.stale).toBe(false);
    expect(r.freshness.fromCache).toBe(false);
    expect(r.freshness.bundled).toBe(false);
    await vi.waitFor(() => expect(store.has("test-dates-2026")).toBe(true));
    expect(h.field.has("test-dates-2026")).toBe(true);
  });

  it("uses the season start as effectiveDate when the API meta is thin, else effectiveFrom", async () => {
    installCachesStub();
    vi.stubGlobal("fetch", okFetch());
    const thin = await createRegsFetcher<unknown>(config)(2026);
    expect(thin.freshness.effectiveDate).toBe("2026-03-01");
    resetRegsApiCache();
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ data: [], meta: { effectiveFrom: "2026-02-15" } })),
      ),
    );
    const dated = await createRegsFetcher<unknown>(config)(2026, true);
    expect(dated.freshness.effectiveDate).toBe("2026-02-15");
  });

  it("reuses a live result within the TTL and de-duplicates concurrent calls", async () => {
    installCachesStub();
    const spy = okFetch();
    vi.stubGlobal("fetch", spy);
    const fetchDates = createRegsFetcher<unknown>(config);
    await Promise.all([fetchDates(2026), fetchDates(2026)]);
    await fetchDates(2026);
    expect(spy).toHaveBeenCalledTimes(1);
    await fetchDates(2026, true);
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it("falls back to the cached copy on non-OK and labels it", async () => {
    const store = installCachesStub();
    store.set(
      "test-dates-2026",
      new Response(JSON.stringify(ENVELOPE), {
        headers: { "x-fetched-at": "2026-08-01T00:00:00Z" },
      }),
    );
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("boom", { status: 503 })),
    );
    const r = await createRegsFetcher<{ label: string }[]>(config)(2026);
    expect(r.freshness.tier).toBe("cached");
    expect(r.freshness.fromCache).toBe(true);
    expect(r.freshness.fetchedAt).toBe("2026-08-01T00:00:00Z");
    expect(r.freshness.version).toBe(4);
  });

  it("prefers the newer of the browser cache and the field copy", async () => {
    const store = installCachesStub();
    store.set(
      "test-dates-2026",
      new Response(JSON.stringify(ENVELOPE), {
        headers: { "x-fetched-at": "2026-07-01T00:00:00Z" },
      }),
    );
    h.field.set("test-dates-2026", {
      body: { data: [{ label: "Newer" }], meta: {} },
      fetchedAt: "2026-08-15T00:00:00Z",
    });
    vi.stubGlobal("fetch", failFetch());
    const r = await createRegsFetcher<{ label: string }[]>(config)(2026);
    expect(r.freshness.tier).toBe("field-copy");
    expect(r.data[0]!.label).toBe("Newer");
  });

  it("does not reuse a fallback result once online, but does while offline", async () => {
    installCachesStub();
    h.field.set("test-dates-2026", { body: ENVELOPE, fetchedAt: "2026-08-15T00:00:00Z" });
    const spy = failFetch();
    vi.stubGlobal("fetch", spy);
    const fetchDates = createRegsFetcher<unknown>(config);
    await fetchDates(2026);
    await fetchDates(2026);
    expect(spy).toHaveBeenCalledTimes(2);
    useConnectivityStore.getState().setOnline(false);
    await fetchDates(2026);
    await fetchDates(2026);
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it("skips the network and marks an old stored copy stale when offline", async () => {
    installCachesStub();
    h.field.set("test-dates-2026", { body: { data: [] }, fetchedAt: "2026-01-01T00:00:00Z" });
    const spy = okFetch();
    vi.stubGlobal("fetch", spy);
    useConnectivityStore.getState().setOnline(false);
    const r = await createRegsFetcher<unknown>(config)(2026);
    expect(spy).not.toHaveBeenCalled();
    expect(r.freshness.tier).toBe("field-copy");
    expect(r.freshness.stale).toBe(true);
  });

  it("serves the bundled copy last and throws when nothing exists", async () => {
    installCachesStub();
    vi.stubGlobal("fetch", failFetch());
    h.bundled.mockResolvedValue({
      data: [{ label: "Built in" }],
      meta: {
        generatedAt: "2026-07-14T00:00:00Z",
        effectiveDate: "2026-03-01",
        validUntil: "2027-02-28",
        sourceLabel: "FWP 2026 hunting regulations (published v7)",
        version: 7,
      },
    });
    const r = await createRegsFetcher<{ label: string }[]>(config)(2026);
    expect(r.freshness.tier).toBe("bundled");
    expect(r.freshness.bundled).toBe(true);
    expect(r.freshness.fromCache).toBe(false);
    expect(r.freshness.version).toBe(7);
    expect(r.freshness.effectiveDate).toBe("2026-03-01");
    expect(h.bundled).toHaveBeenCalledWith("test-dates-2026");
    h.bundled.mockResolvedValue(null);
    await expect(createRegsFetcher<unknown>(config)(2026, true)).rejects.toBeInstanceOf(
      RegsApiUnavailableError,
    );
  });

  it("clears the session cache when connectivity changes", async () => {
    installCachesStub();
    const spy = okFetch();
    vi.stubGlobal("fetch", spy);
    const fetchDates = createRegsFetcher<unknown>(config);
    await fetchDates(2026);
    useConnectivityStore.getState().setOnline(false);
    useConnectivityStore.getState().setOnline(true);
    await fetchDates(2026);
    expect(spy).toHaveBeenCalledTimes(2);
  });
});
