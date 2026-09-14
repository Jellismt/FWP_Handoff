/**
 * @file featureFocusStore.test.ts
 * @module engage-mt/store
 * @description Unit tests for the co-located feature-focus stores — the
 *              full-screen takeover popup (useTakeoverPopupStore) and the
 *              transient map halo (useHighlightedFeatureStore), including the
 *              deliberate "retain content on close" animation behaviour and
 *              the geometry-arrives-late update path.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-01
 * @updated 2026-07-07
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  useHighlightedFeatureStore,
  useTakeoverPopupStore,
  type HighlightGeometry,
} from "@/store/map/featureFocusStore";

describe("useTakeoverPopupStore", () => {
  beforeEach(() => {
    useTakeoverPopupStore.setState({
      open: false,
      layerId: null,
      layerTitle: null,
      module: null,
      attrs: null,
      tapPoint: null,
    });
  });

  it("starts closed and empty", () => {
    const s = useTakeoverPopupStore.getState();
    expect(s.open).toBe(false);
    expect(s.layerId).toBeNull();
    expect(s.attrs).toBeNull();
  });

  it("openFeature populates every slot and flips open", () => {
    useTakeoverPopupStore.getState().openFeature({
      layerId: "fishing-access-sites",
      layerTitle: "Fishing Access Sites",
      module: "fish",
      attrs: { NAME: "Lone Pine" },
      tapPoint: { x: -113, y: 46, latitude: 46, longitude: -113 },
    });
    const s = useTakeoverPopupStore.getState();
    expect(s.open).toBe(true);
    expect(s.layerId).toBe("fishing-access-sites");
    expect(s.module).toBe("fish");
    expect(s.attrs).toEqual({ NAME: "Lone Pine" });
    expect(s.tapPoint?.latitude).toBe(46);
  });

  it("openFeature defaults tapPoint to null when omitted", () => {
    useTakeoverPopupStore.getState().openFeature({
      layerId: "bma",
      layerTitle: "BMA",
      module: "access",
      attrs: {},
    });
    expect(useTakeoverPopupStore.getState().tapPoint).toBeNull();
  });

  it("close only flips `open` and RETAINS content (for the exit animation)", () => {
    useTakeoverPopupStore.getState().openFeature({
      layerId: "fishing-access-sites",
      layerTitle: "Fishing Access Sites",
      module: "fish",
      attrs: { NAME: "Lone Pine" },
    });
    useTakeoverPopupStore.getState().close();
    const s = useTakeoverPopupStore.getState();
    expect(s.open).toBe(false);
    // Deliberately still populated — nulling synchronously amputates the
    // CalciteDialog close animation (see the store's inline rationale).
    expect(s.layerId).toBe("fishing-access-sites");
    expect(s.attrs).toEqual({ NAME: "Lone Pine" });
  });
});

describe("useHighlightedFeatureStore", () => {
  beforeEach(() => {
    useHighlightedFeatureStore.setState({ selected: null });
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-01T12:00:00Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("set stores the target with a default 60s TTL and no geometry", () => {
    const now = Date.now();
    useHighlightedFeatureStore
      .getState()
      .set({ lat: 46.9, lon: -110.5, label: "Holter Lake", kind: "waterbody" });
    const sel = useHighlightedFeatureStore.getState().selected;
    expect(sel?.label).toBe("Holter Lake");
    expect(sel?.expiresAt).toBe(now + 60_000);
    expect(sel?.geometry).toBeNull();
    expect(sel?.geometryFadesAt).toBeUndefined();
  });

  it("set honours a custom ttlMs and sets a geometry fade window when geometry is present", () => {
    const now = Date.now();
    const geometry: HighlightGeometry = {
      kind: "polygon",
      rings: [
        [
          [-110, 46],
          [-110, 47],
          [-111, 47],
          [-110, 46],
        ],
      ],
    };
    useHighlightedFeatureStore
      .getState()
      .set({ lat: 46, lon: -110, label: "Lake", kind: "waterbody", ttlMs: 5_000, geometry });
    const sel = useHighlightedFeatureStore.getState().selected;
    expect(sel?.expiresAt).toBe(now + 5_000);
    expect(sel?.geometry).toEqual(geometry);
    expect(sel?.geometryFadesAt).toBe(now + 6_000); // default geom fade
  });

  it("supports an Infinity ttl/fade for a persistent highlight", () => {
    const geometry: HighlightGeometry = {
      kind: "polygon",
      rings: [
        [
          [-110, 46],
          [-110, 47],
          [-111, 47],
          [-110, 46],
        ],
      ],
    };
    useHighlightedFeatureStore.getState().set({
      lat: 46,
      lon: -110,
      label: "Cadastral parcels",
      kind: "polygon",
      ttlMs: Number.POSITIVE_INFINITY,
      geometry,
      geometryFadeMs: Number.POSITIVE_INFINITY,
    });
    const sel = useHighlightedFeatureStore.getState().selected;
    expect(sel?.expiresAt).toBe(Number.POSITIVE_INFINITY);
    expect(sel?.geometryFadesAt).toBe(Number.POSITIVE_INFINITY);
  });

  it("stamps a strictly-increasing seq on every set (so same-label taps don't collide)", () => {
    const s = useHighlightedFeatureStore.getState();
    s.set({ lat: 46, lon: -110, label: "Cadastral parcels", kind: "polygon" });
    const first = useHighlightedFeatureStore.getState().selected?.seq ?? -1;
    s.set({ lat: 47, lon: -111, label: "Cadastral parcels", kind: "polygon" });
    const second = useHighlightedFeatureStore.getState().selected?.seq ?? -1;
    expect(second).toBeGreaterThan(first);
  });

  it("setGeometry updates the geometry of the current target", () => {
    useHighlightedFeatureStore
      .getState()
      .set({ lat: 46, lon: -110, label: "River", kind: "point" });
    const geometry: HighlightGeometry = {
      kind: "polyline",
      paths: [
        [
          [-110, 46],
          [-110.1, 46.1],
        ],
      ],
    };
    useHighlightedFeatureStore.getState().setGeometry(geometry, { geometryFadeMs: 3_000 });
    const sel = useHighlightedFeatureStore.getState().selected;
    expect(sel?.geometry).toEqual(geometry);
    expect(sel?.geometryFadesAt).toBe(Date.now() + 3_000);
  });

  it("setGeometry is a no-op when no target is selected", () => {
    useHighlightedFeatureStore.getState().setGeometry({
      kind: "polyline",
      paths: [[[-110, 46]]],
    });
    expect(useHighlightedFeatureStore.getState().selected).toBeNull();
  });

  it("setGeometry(null) clears geometry and its fade window", () => {
    useHighlightedFeatureStore.getState().set({
      lat: 46,
      lon: -110,
      label: "Lake",
      kind: "waterbody",
      geometry: { kind: "polygon", rings: [[[-110, 46]]] },
    });
    useHighlightedFeatureStore.getState().setGeometry(null);
    const sel = useHighlightedFeatureStore.getState().selected;
    expect(sel?.geometry).toBeNull();
    expect(sel?.geometryFadesAt).toBeUndefined();
  });

  it("clear removes the selection", () => {
    useHighlightedFeatureStore.getState().set({ lat: 46, lon: -110, label: "X", kind: "point" });
    useHighlightedFeatureStore.getState().clear();
    expect(useHighlightedFeatureStore.getState().selected).toBeNull();
  });
});
