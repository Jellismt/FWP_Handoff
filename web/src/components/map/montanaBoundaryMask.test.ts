/**
 * @file montanaBoundaryMask.test.ts
 * @module engage-mt/map
 * @description Unit tests for the Montana focus-mask attach lifecycle. The
 *              @arcgis/core Graphic / GraphicsLayer / Polygon classes are mocked
 *              as recording shells, the boundary fetch + theme store are mocked
 *              at their seams. Covers the world-ring + Montana-hole geometry, the
 *              CCW hole-orientation guarantee, the theme-driven mask color, the
 *              immediate bundled-ring paint, the async upgrade to the real
 *              census boundary (and its alive/short-ring guards), the theme
 *              recolor subscription, and detach cleanup.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-01
 * @updated 2026-07-03
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

interface GraphicProps {
  geometry: { rings?: number[][][]; spatialReference?: { wkid: number } };
  symbol: { type: string; color: number[]; outline: unknown };
}

const created = vi.hoisted(() => ({
  graphics: [] as GraphicProps[],
}));

vi.mock("@arcgis/core/Graphic", () => ({
  default: class {
    geometry: unknown;
    symbol: unknown;
    constructor(props: GraphicProps) {
      this.geometry = props.geometry;
      this.symbol = props.symbol;
      created.graphics.push(props);
    }
  },
}));

vi.mock("@arcgis/core/layers/GraphicsLayer", () => ({
  default: class {
    id: string;
    title: string;
    graphics: unknown[] = [];
    add = vi.fn((g: unknown) => this.graphics.push(g));
    removeAll = vi.fn(() => {
      this.graphics = [];
    });
    constructor(props: { id: string; title: string }) {
      this.id = props.id;
      this.title = props.title;
    }
  },
}));

vi.mock("@arcgis/core/geometry/Polygon", () => ({
  default: class {
    rings: number[][][];
    spatialReference: { wkid: number };
    constructor(props: { rings: number[][][]; spatialReference: { wkid: number } }) {
      this.rings = props.rings;
      this.spatialReference = props.spatialReference;
    }
  },
}));

const boundary = vi.hoisted(() => ({
  fetch: vi.fn(),
  ring: [] as Array<[number, number]>,
}));

vi.mock("@/data/montanaBoundary", () => ({
  MONTANA_BOUNDARY_RING: boundary.ring,
  fetchRealMontanaBoundary: (...args: unknown[]) => boundary.fetch(...args),
}));

const themeStore = vi.hoisted(() => {
  let resolved: "light" | "dark" = "light";
  const listeners = new Set<(s: { resolved: "light" | "dark" }) => void>();
  return {
    setResolved(next: "light" | "dark") {
      resolved = next;
      listeners.forEach((fn) => fn({ resolved }));
    },
    getResolved: () => resolved,
    listeners,
  };
});

vi.mock("@/store/app/themeStore", () => ({
  useThemeStore: {
    getState: () => ({ resolved: themeStore.getResolved() }),
    subscribe: (fn: (s: { resolved: "light" | "dark" }) => void) => {
      themeStore.listeners.add(fn);
      return () => themeStore.listeners.delete(fn);
    },
  },
}));

vi.mock("@/utils/logger", () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

import { attachMontanaBoundaryMask, buildMontanaMaskGraphic } from "./montanaBoundaryMask";

// A square ring wound COUNTER-clockwise in screen space (lon=X east, lat=Y
// north): SW → SE → NE → NW → SW. signedArea() is positive, so the CCW-guarantee
// path leaves it untouched.
const CCW_SQUARE: Array<[number, number]> = [
  [-116, 44],
  [-104, 44],
  [-104, 49],
  [-116, 49],
  [-116, 44],
];

// The clockwise reversal of CCW_SQUARE: SW → NW → NE → SE → SW. signedArea() is
// negative, so the CCW-guarantee path reverses it back to CCW winding.
const CW_SQUARE: Array<[number, number]> = [...CCW_SQUARE].reverse() as Array<[number, number]>;

interface FakeMap {
  add: ReturnType<typeof vi.fn>;
  layers: unknown[];
}

const makeMap = (): FakeMap => {
  const layers: unknown[] = [];
  return { layers, add: vi.fn((l: unknown) => layers.push(l)) };
};

beforeEach(() => {
  vi.clearAllMocks();
  created.graphics.length = 0;
  themeStore.listeners.clear();
  themeStore.setResolved("light");
  boundary.ring.length = 0;
  boundary.ring.push(...CW_SQUARE);
  boundary.fetch.mockResolvedValue(null);
});

afterEach(() => {
  themeStore.listeners.clear();
});

describe("buildMontanaMaskGraphic", () => {
  it("builds a two-ring polygon: the world outer + the Montana hole", () => {
    buildMontanaMaskGraphic("light", CW_SQUARE);
    const g = created.graphics.at(-1)!;
    expect(g.geometry.spatialReference).toEqual({ wkid: 4326 });
    expect(g.geometry.rings).toHaveLength(2);
    // Outer world ring spans the whole map.
    expect(g.geometry.rings![0][0]).toEqual([-180, -85]);
  });

  it("reverses a clockwise Montana ring so the hole winds counter-clockwise", () => {
    // CW_SQUARE = [-116,44],[-116,49],[-104,49],[-104,44],[-116,44] (clockwise).
    // ensureCcwHoleRing flips it back to CCW → equals CCW_SQUARE.
    buildMontanaMaskGraphic("light", CW_SQUARE);
    const g = created.graphics.at(-1)!;
    const hole = g.geometry.rings![1];
    expect(hole).toEqual(CCW_SQUARE);
    // Sanity: the winding actually differs from the (clockwise) input.
    expect(hole).not.toEqual(CW_SQUARE);
  });

  it("leaves an already-counter-clockwise ring untouched", () => {
    buildMontanaMaskGraphic("light", CCW_SQUARE);
    const g = created.graphics.at(-1)!;
    expect(g.geometry.rings![1]).toEqual(CCW_SQUARE);
  });

  it("uses the lighter-blue mask color in light mode", () => {
    buildMontanaMaskGraphic("light", CW_SQUARE);
    expect(created.graphics.at(-1)!.symbol.color).toEqual([177, 179, 179, 0.55]);
  });

  it("uses the darker-blue, more-opaque mask color in dark mode", () => {
    buildMontanaMaskGraphic("dark", CW_SQUARE);
    expect(created.graphics.at(-1)!.symbol.color).toEqual([0, 40, 85, 0.66]);
  });
});

describe("attachMontanaBoundaryMask", () => {
  it("adds a hidden mask layer with an immediate bundled-ring paint", () => {
    const map = makeMap();
    attachMontanaBoundaryMask({ map: map as never, view: {} as never, alive: () => true });
    expect(map.add).toHaveBeenCalledTimes(1);
    // One graphic painted synchronously (the bundled ring).
    expect(created.graphics).toHaveLength(1);
  });

  it("upgrades to the authoritative census boundary once the fetch resolves", async () => {
    const realRing: Array<[number, number]> = Array.from(
      { length: 60 },
      (_, i) => [-116 + i * 0.1, 44 + (i % 5) * 0.1] as [number, number],
    );
    boundary.fetch.mockResolvedValue(realRing);
    const map = makeMap();
    attachMontanaBoundaryMask({ map: map as never, view: {} as never, alive: () => true });
    await vi.waitFor(() => expect(created.graphics.length).toBeGreaterThan(1));
    // The upgraded graphic carries the larger real ring in its hole.
    const upgraded = created.graphics.at(-1)!;
    expect(upgraded.geometry.rings![1].length).toBe(realRing.length);
  });

  it("ignores a too-short upstream ring (guards against a bad fetch)", async () => {
    boundary.fetch.mockResolvedValue([
      [-111, 46],
      [-110, 46],
    ] as Array<[number, number]>);
    const map = makeMap();
    attachMontanaBoundaryMask({ map: map as never, view: {} as never, alive: () => true });
    await Promise.resolve();
    await Promise.resolve();
    expect(created.graphics).toHaveLength(1);
  });

  it("does not repaint if the effect is no longer alive when the fetch lands", async () => {
    const realRing: Array<[number, number]> = Array.from(
      { length: 60 },
      (_, i) => [-116 + i * 0.1, 44] as [number, number],
    );
    boundary.fetch.mockResolvedValue(realRing);
    const map = makeMap();
    attachMontanaBoundaryMask({ map: map as never, view: {} as never, alive: () => false });
    await Promise.resolve();
    await Promise.resolve();
    expect(created.graphics).toHaveLength(1);
  });

  it("recolors the mask when the theme flips, then stops after detach", () => {
    const map = makeMap();
    const detach = attachMontanaBoundaryMask({
      map: map as never,
      view: {} as never,
      alive: () => true,
    });
    const before = created.graphics.length;
    themeStore.setResolved("dark");
    expect(created.graphics.length).toBe(before + 1);
    expect(created.graphics.at(-1)!.symbol.color).toEqual([0, 40, 85, 0.66]);

    detach();
    const afterDetach = created.graphics.length;
    themeStore.setResolved("light");
    expect(created.graphics.length).toBe(afterDetach);
  });
});
