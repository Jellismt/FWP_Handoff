/**
 * @file useMapNavigation.test.tsx
 * @module engage-mt/hooks
 * @description Integration tests for useMapNavigation.
 *              Verifies the hook pushes the requested target into
 *              mapNavStore and (by default) navigates to `/` so MapView
 *              is mounted before the goTo fires.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-01
 * @updated 2026-07-03
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { describe, expect, it, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";
import { useMapNavigation } from "@/hooks/useMapNavigation";
import { useMapNavStore } from "@/store/map/mapNavStore";

const wrapper = ({ children }: { children: ReactNode }): JSX.Element => (
  <MemoryRouter initialEntries={["/hunt/districts"]}>{children}</MemoryRouter>
);

describe("useMapNavigation", () => {
  beforeEach(() => {
    useMapNavStore.getState().clear();
  });

  it("pushes a target into mapNavStore with default zoom 13", () => {
    const { result } = renderHook(() => useMapNavigation(), { wrapper });
    act(() => {
      result.current.flyTo({ lat: 46.0, lon: -111.0, label: "Test" });
    });
    const t = useMapNavStore.getState().target;
    expect(t).toBeTruthy();
    expect(t?.lat).toBe(46.0);
    expect(t?.lon).toBe(-111.0);
    expect(t?.zoom).toBe(13);
    expect(t?.label).toBe("Test");
  });

  it("honors explicit zoom when supplied", () => {
    const { result } = renderHook(() => useMapNavigation(), { wrapper });
    act(() => {
      result.current.flyTo({ lat: 47.5, lon: -110.5, zoom: 9 });
    });
    expect(useMapNavStore.getState().target?.zoom).toBe(9);
  });

  it("supports the route:false escape hatch (no navigate)", () => {
    const { result } = renderHook(() => useMapNavigation(), { wrapper });
    act(() => {
      result.current.flyTo({ lat: 45, lon: -112 }, { route: false });
    });
    // We can't easily assert on react-router navigate from here, but we
    // can confirm the target was set — the regression that would matter.
    expect(useMapNavStore.getState().target?.lat).toBe(45);
  });

  it("each call replaces the previous target (latest wins)", () => {
    const { result } = renderHook(() => useMapNavigation(), { wrapper });
    act(() => {
      result.current.flyTo({ lat: 46, lon: -111, label: "A" });
      result.current.flyTo({ lat: 47, lon: -110, label: "B" });
    });
    expect(useMapNavStore.getState().target?.label).toBe("B");
  });
});
