/**
 * @file useFetchJson.test.tsx
 * @module engage-mt/hooks
 * @description R.2c — Characterization test for the Tier-2 JSON fetch hook.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-06
 * @updated 2026-06-17
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useFetchJson } from "@/hooks/useFetchJson";

const ok = (body: unknown): Response =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });

describe("useFetchJson", () => {
  beforeEach(() => vi.stubGlobal("fetch", vi.fn()));
  afterEach(() => vi.unstubAllGlobals());

  it("starts loading then resolves to data", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(ok({ ok: true }));
    const { result } = renderHook(() => useFetchJson<{ ok: boolean }>("/data/x.json"));
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.data).toEqual({ ok: true }));
    expect(result.current.loading).toBe(false);
  });

  it("captures error on failure", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response("nope", { status: 500 }));
    const { result } = renderHook(() => useFetchJson("/data/x.json"));
    await waitFor(() => expect(result.current.error).toBeTruthy());
  });

  it("retry triggers a fresh fetch", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(ok("v1")).mockResolvedValueOnce(ok("v2"));
    const { result } = renderHook(() => useFetchJson<string>("/data/x.json"));
    await waitFor(() => expect(result.current.data).toBe("v1"));
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.data).toBe("v2"));
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2);
  });
});
