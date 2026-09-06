/**
 * @file useRegsIndex.test.ts
 * @module engage-mt/services/regs
 * @description Covers the regs-index loader: module-level cache + concurrent
 *              fetch dedup, the pending-reset-on-error retry path, the synchronous
 *              `findReg` lookup, `buildPdfDeepLink` construction, and the hook's
 *              mount/unmount `alive` guard. Routed through the shared `fetchJson`
 *              wrapper, which is mocked here. Each test re-imports the module fresh
 *              (vi.resetModules) so the module-level cache starts clean.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-29
 * @updated 2026-06-29
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

const fetchJsonMock = vi.fn();
vi.mock("@/utils/http", () => ({
  fetchJson: (url: string, opts?: unknown) => fetchJsonMock(url, opts),
}));

type RegsModule = typeof import("./useRegsIndex");

const FIXTURE = {
  _meta: { schemaVersion: "1", description: "test", regenerated: "2026-06-29" },
  regs: [
    {
      id: "r4-pond-guide-2026",
      filename: "r4-pond-guide-2026.pdf",
      title: "Region 4 Pond Guide",
      publisher: "Montana FWP",
      pageCount: 12,
      commissionAdoptedAt: null,
      effectiveFrom: "2026-03-01",
      validUntil: null,
      url: "/regs/r4-pond-guide-2026.pdf",
      scope: ["fish"],
    },
  ],
} as const;

/** Import the module fresh so `cached` / `pending` reset between tests. */
const freshImport = async (): Promise<RegsModule> => {
  vi.resetModules();
  return import("./useRegsIndex");
};

beforeEach(() => fetchJsonMock.mockReset());
afterEach(() => vi.restoreAllMocks());

describe("useRegsIndex / findReg / buildPdfDeepLink", () => {
  it("loads the index and exposes it through the hook", async () => {
    fetchJsonMock.mockResolvedValueOnce(FIXTURE);
    const { useRegsIndex } = await freshImport();

    const { result } = renderHook(() => useRegsIndex());
    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.index).toEqual(FIXTURE);
    expect(result.current.error).toBeNull();
    expect(fetchJsonMock.mock.calls[0]![0]).toBe("/regs/regs-index.json");
  });

  it("dedupes concurrent callers into a single fetch", async () => {
    fetchJsonMock.mockResolvedValueOnce(FIXTURE);
    const { useRegsIndex } = await freshImport();

    renderHook(() => useRegsIndex());
    renderHook(() => useRegsIndex());
    renderHook(() => useRegsIndex());

    await waitFor(() => expect(fetchJsonMock).toHaveBeenCalledTimes(1));
  });

  it("serves a synchronous cache hit on a later mount without re-fetching", async () => {
    fetchJsonMock.mockResolvedValueOnce(FIXTURE);
    const mod = await freshImport();

    const first = renderHook(() => mod.useRegsIndex());
    await waitFor(() => expect(first.result.current.loading).toBe(false));

    // Cache is now warm — a fresh mount should start non-loading and not re-fetch.
    const second = renderHook(() => mod.useRegsIndex());
    expect(second.result.current.loading).toBe(false);
    expect(second.result.current.index).toEqual(FIXTURE);
    expect(fetchJsonMock).toHaveBeenCalledTimes(1);
  });

  it("surfaces the error and clears pending so a retry re-fetches", async () => {
    const boom = new Error("regs-index HTTP 500");
    fetchJsonMock.mockRejectedValueOnce(boom);
    const { useRegsIndex } = await freshImport();

    const first = renderHook(() => useRegsIndex());
    await waitFor(() => expect(first.result.current.error).toBe(boom));
    expect(first.result.current.index).toBeNull();

    // pending was reset on error → a new mount triggers a second fetch (success).
    fetchJsonMock.mockResolvedValueOnce(FIXTURE);
    const second = renderHook(() => useRegsIndex());
    await waitFor(() => expect(second.result.current.index).toEqual(FIXTURE));
    expect(fetchJsonMock).toHaveBeenCalledTimes(2);
  });

  it("findReg returns null before load and the row after", async () => {
    fetchJsonMock.mockResolvedValueOnce(FIXTURE);
    const mod = await freshImport();

    expect(mod.findReg("r4-pond-guide-2026")).toBeNull(); // cache cold

    const { result } = renderHook(() => mod.useRegsIndex());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(mod.findReg("r4-pond-guide-2026")?.title).toBe("Region 4 Pond Guide");
    expect(mod.findReg("does-not-exist")).toBeNull();
  });

  it("buildPdfDeepLink appends the page anchor for a known reg, null otherwise", async () => {
    fetchJsonMock.mockResolvedValueOnce(FIXTURE);
    const mod = await freshImport();
    const { result } = renderHook(() => mod.useRegsIndex());
    await waitFor(() => expect(result.current.loading).toBe(false));

    const source = {
      regId: "r4-pond-guide-2026",
      page: 7,
      commissionAdoptedAt: null,
      validUntil: null,
      extractedAt: "2026-06-29",
      extractor: "test@1.0.0",
      override: false,
    };
    expect(mod.buildPdfDeepLink(source)).toBe("/regs/r4-pond-guide-2026.pdf#page=7");
    expect(mod.buildPdfDeepLink({ ...source, regId: "missing" })).toBeNull();
  });

  it("does not set state after unmount (alive guard)", async () => {
    let resolveFetch: (v: typeof FIXTURE) => void = () => {};
    fetchJsonMock.mockReturnValueOnce(
      new Promise((res) => {
        resolveFetch = res;
      }),
    );
    const { useRegsIndex } = await freshImport();

    const { result, unmount } = renderHook(() => useRegsIndex());
    expect(result.current.loading).toBe(true);
    unmount();

    // Resolving after unmount must not throw or flip state (the cleanup set alive=false).
    resolveFetch(FIXTURE);
    await Promise.resolve();
    expect(result.current.loading).toBe(true); // last committed value pre-unmount
  });
});
