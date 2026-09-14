/**
 * @file useAsyncState.test.tsx
 * @module engage-mt/hooks
 * @description R.2c — Characterization test for the unified async state
 *              machine + the toAsyncStateFromDuck adapter.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-06
 * @updated 2026-06-17
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useAsyncState } from "@/hooks/useAsyncState";

describe("useAsyncState", () => {
  it("starts in loading state", () => {
    const fetcher = vi.fn().mockResolvedValue([1, 2, 3]);
    const { result } = renderHook(() => useAsyncState({ fetcher }));
    expect(result.current.state.status).toBe("loading");
  });

  it("transitions to success with data on resolve", async () => {
    const fetcher = vi.fn().mockResolvedValue([1, 2, 3]);
    const { result } = renderHook(() => useAsyncState({ fetcher }));
    await waitFor(() => expect(result.current.state.status).toBe("success"));
    expect(result.current.state.data).toEqual([1, 2, 3]);
  });

  it("transitions to empty when isEmpty returns true", async () => {
    const fetcher = vi.fn().mockResolvedValue([]);
    const { result } = renderHook(() =>
      useAsyncState({ fetcher, isEmpty: (d: number[]) => d.length === 0 }),
    );
    await waitFor(() => expect(result.current.state.status).toBe("empty"));
  });

  it("transitions to error on reject", async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error("boom"));
    const { result } = renderHook(() => useAsyncState({ fetcher }));
    await waitFor(() => expect(result.current.state.status).toBe("error"));
    expect((result.current.state.error as Error).message).toBe("boom");
  });

  it("retry re-runs the fetcher", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce("v1").mockResolvedValueOnce("v2");
    const { result } = renderHook(() => useAsyncState({ fetcher }));
    await waitFor(() => expect(result.current.state.status).toBe("success"));
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.state.data).toBe("v2"));
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
