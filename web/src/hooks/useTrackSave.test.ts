/**
 * @file useTrackSave.test.ts
 * @module engage-mt/hooks
 * @description Unit tests for the stop-&-save track flow. Exercises the
 *              zero-point silent-discard branch, the seed-name-&-open branch,
 *              the save + discard terminal actions, canSave gating, and the
 *              focus-on-open effect — with the recorder store + haptics mocked
 *              at the seam.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-01
 * @updated 2026-07-01
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  pathLength: 0,
  stop: vi.fn(),
  discard: vi.fn(),
  impact: vi.fn(),
}));

// The store is a hook taking a selector; feed it the fields the hook reads.
vi.mock("@/services/field/trackRecorder", () => ({
  useTrackRecorderStore: (selector: (s: unknown) => unknown) =>
    selector({ path: { length: h.pathLength }, stop: h.stop, discard: h.discard }),
}));
vi.mock("@/services/mobile/haptics", () => ({ impact: h.impact }));

import { useTrackSave } from "./useTrackSave";

beforeEach(() => {
  vi.clearAllMocks();
  h.pathLength = 0;
});

describe("useTrackSave.requestStop", () => {
  it("discards silently and does NOT open the sheet when zero points captured", () => {
    h.pathLength = 0;
    const { result } = renderHook(() => useTrackSave());

    act(() => result.current.requestStop());

    expect(h.discard).toHaveBeenCalledOnce();
    expect(result.current.saveOpen).toBe(false);
    expect(result.current.trackName).toBe("");
  });

  it("seeds a dated default name and opens the sheet when points exist", () => {
    h.pathLength = 12;
    const { result } = renderHook(() => useTrackSave());

    act(() => result.current.requestStop());

    expect(result.current.saveOpen).toBe(true);
    expect(result.current.trackName).toMatch(/^Track · /);
    expect(result.current.canSave).toBe(true);
    expect(h.discard).not.toHaveBeenCalled();
  });
});

describe("useTrackSave.confirmSave", () => {
  it("persists via stop(name, notes), fires heavy haptics, and closes + clears", () => {
    h.pathLength = 5;
    const { result } = renderHook(() => useTrackSave());

    act(() => result.current.requestStop());
    act(() => {
      result.current.setTrackName("Sunrise Loop");
      result.current.setTrackNotes("muddy at mile 2");
    });
    act(() => result.current.confirmSave());

    expect(h.impact).toHaveBeenCalledWith("heavy");
    expect(h.stop).toHaveBeenCalledWith("Sunrise Loop", "muddy at mile 2");
    expect(result.current.saveOpen).toBe(false);
    expect(result.current.trackName).toBe("");
    expect(result.current.trackNotes).toBe("");
  });
});

describe("useTrackSave.confirmDiscard", () => {
  it("drops the buffer via discard(), fires medium haptics, and closes + clears", () => {
    h.pathLength = 5;
    const { result } = renderHook(() => useTrackSave());

    act(() => result.current.requestStop());
    act(() => result.current.confirmDiscard());

    expect(h.impact).toHaveBeenCalledWith("medium");
    expect(h.discard).toHaveBeenCalledOnce();
    expect(h.stop).not.toHaveBeenCalled();
    expect(result.current.saveOpen).toBe(false);
    expect(result.current.trackName).toBe("");
  });
});

describe("useTrackSave.canSave", () => {
  it("is false when the draft name is whitespace-only", () => {
    h.pathLength = 5;
    const { result } = renderHook(() => useTrackSave());

    act(() => result.current.requestStop());
    act(() => result.current.setTrackName("   "));

    expect(result.current.canSave).toBe(false);
  });
});

describe("useTrackSave focus-on-open", () => {
  it("focuses the name input when the sheet transitions to open", () => {
    h.pathLength = 5;
    const focus = vi.fn();
    const { result } = renderHook(() => useTrackSave());

    // Attach a real element so the ref's focus() is callable.
    const input = document.createElement("input");
    input.focus = focus;
    result.current.nameInputRef.current = input;

    act(() => result.current.requestStop());

    expect(focus).toHaveBeenCalledOnce();
  });
});
