/**
 * @file selectedHighlightGraphics.test.ts
 * @module engage-mt/services/map
 * @description Unit tests for the selected-feature highlight-halo layer. The
 *              @arcgis/core classes are mocked at the import seam as recording
 *              shells so we assert on layer.add/remove calls + the geometry
 *              inputs (point halo, polygon-ring flash, polyline flash) rather
 *              than real rendering. Covers reduced-motion (static ring), the
 *              initial deep-link paint, the store-subscription re-render path,
 *              the geometry-only update branch, and detach cleanup.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-01
 * @updated 2026-07-07
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { HighlightGeometry, HighlightTarget } from "@/store/map/featureFocusStore";

// ── ArcGIS class shells — record their construction args ─────────────────
const created = vi.hoisted(() => ({
  graphics: [] as Array<{ geometry: unknown; symbol: unknown; attributes?: unknown }>,
  points: [] as unknown[],
  polygons: [] as unknown[],
  polylines: [] as unknown[],
}));

vi.mock("@arcgis/core/Map", () => ({ default: class {} }));
vi.mock("@arcgis/core/layers/GraphicsLayer", () => ({
  default: class {
    id: string;
    add = vi.fn();
    remove = vi.fn();
    constructor(props: { id: string }) {
      this.id = props.id;
    }
  },
}));
vi.mock("@arcgis/core/Graphic", () => ({
  default: class {
    geometry: unknown;
    symbol: unknown;
    attributes: unknown;
    constructor(props: { geometry: unknown; symbol: unknown; attributes?: unknown }) {
      this.geometry = props.geometry;
      this.symbol = props.symbol;
      this.attributes = props.attributes;
      created.graphics.push(props);
    }
  },
}));
vi.mock("@arcgis/core/geometry/Point", () => ({
  default: class {
    constructor(props: unknown) {
      created.points.push(props);
      Object.assign(this, props, { type: "point" });
    }
  },
}));
vi.mock("@arcgis/core/geometry/Polygon", () => ({
  default: class {
    constructor(props: unknown) {
      created.polygons.push(props);
      Object.assign(this, props, { type: "polygon" });
    }
  },
}));
vi.mock("@arcgis/core/geometry/Polyline", () => ({
  default: class {
    constructor(props: unknown) {
      created.polylines.push(props);
      Object.assign(this, props, { type: "polyline" });
    }
  },
}));
vi.mock("@arcgis/core/symbols/SimpleMarkerSymbol", () => ({
  default: class {
    constructor(props: unknown) {
      Object.assign(this, props);
    }
  },
}));
vi.mock("@arcgis/core/symbols/SimpleLineSymbol", () => ({
  default: class {
    constructor(props: unknown) {
      Object.assign(this, props);
    }
  },
}));
vi.mock("@arcgis/core/symbols/SimpleFillSymbol", () => ({
  default: class {
    constructor(props: unknown) {
      Object.assign(this, props);
    }
  },
}));
vi.mock("@/utils/cssVarToHex", () => ({ cssVarToHex: () => "#4A90D9" }));

// ── Controllable highlight store ────────────────────────────────────────
const store = vi.hoisted(() => {
  let selected: HighlightTarget | null = null;
  const listeners = new Set<(s: { selected: HighlightTarget | null }) => void>();
  return {
    getSelected: () => selected,
    setSelected(next: HighlightTarget | null) {
      selected = next;
      listeners.forEach((fn) => fn({ selected }));
    },
    clear: vi.fn(() => {
      selected = null;
    }),
    listeners,
  };
});

vi.mock("@/store/map/highlightedFeatureStore", () => ({
  useHighlightedFeatureStore: {
    getState: () => ({ selected: store.getSelected(), clear: store.clear }),
    subscribe: (fn: (s: { selected: HighlightTarget | null }) => void) => {
      store.listeners.add(fn);
      return () => store.listeners.delete(fn);
    },
  },
}));

import { attachSelectedHighlightGraphics } from "./selectedHighlightGraphics";

interface FakeLayer {
  id: string;
  add: ReturnType<typeof vi.fn>;
  remove: ReturnType<typeof vi.fn>;
}
interface FakeMap {
  add: ReturnType<typeof vi.fn>;
  remove: ReturnType<typeof vi.fn>;
  layers: FakeLayer[];
}

const makeMap = (): FakeMap => {
  const layers: FakeLayer[] = [];
  return {
    layers,
    add: vi.fn((l: FakeLayer) => layers.push(l)),
    remove: vi.fn(),
  };
};

let seqCounter = 0;
const target = (over: Partial<HighlightTarget> = {}): HighlightTarget => ({
  lat: 46.5,
  lon: -111.5,
  label: "Holter Lake",
  kind: "waterbody",
  expiresAt: Date.now() + 60_000,
  seq: ++seqCounter,
  ...over,
});

const setReducedMotion = (reduce: boolean): void => {
  window.matchMedia = ((query: string) => ({
    matches: reduce && query.includes("reduce"),
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    onchange: null,
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
};

beforeEach(() => {
  vi.clearAllMocks();
  created.graphics.length = 0;
  created.points.length = 0;
  created.polygons.length = 0;
  created.polylines.length = 0;
  store.listeners.clear();
  store.setSelected(null);
  store.clear.mockClear();
  setReducedMotion(true); // deterministic: static ring, no interval timers
});

afterEach(() => {
  vi.useRealTimers();
});

describe("attachSelectedHighlightGraphics", () => {
  it("adds a hidden GraphicsLayer to the map and detaches it cleanly", () => {
    const map = makeMap();
    const detach = attachSelectedHighlightGraphics({ map: map as never });
    expect(map.add).toHaveBeenCalledTimes(1);
    const layer = map.layers[0];
    expect(layer.id).toBe("engage-mt-highlight");
    detach();
    expect(map.remove).toHaveBeenCalledWith(layer);
  });

  it("paints a static point halo from the initial store state (deep-link paint)", () => {
    store.setSelected(target());
    const map = makeMap();
    attachSelectedHighlightGraphics({ map: map as never });
    const layer = map.layers[0];
    expect(layer.add).toHaveBeenCalled();
    // A Point graphic was built at the target coords.
    expect(created.points[0]).toMatchObject({ longitude: -111.5, latitude: 46.5 });
  });

  it("re-renders when a new selection arrives (label change)", () => {
    const map = makeMap();
    attachSelectedHighlightGraphics({ map: map as never });
    const layer = map.layers[0];
    layer.add.mockClear();
    store.setSelected(target({ label: "Canyon Ferry", lon: -111.7 }));
    expect(layer.add).toHaveBeenCalled();
    expect(created.points.at(-1)).toMatchObject({ longitude: -111.7 });
  });

  it("flashes a polygon geometry graphic when the target carries rings", () => {
    const geometry: HighlightGeometry = {
      kind: "polygon",
      rings: [
        [
          [-111.5, 46.5],
          [-111.4, 46.5],
          [-111.4, 46.6],
          [-111.5, 46.5],
        ],
      ],
    };
    store.setSelected(target({ geometry, geometryFadesAt: Date.now() + 6000 }));
    const map = makeMap();
    attachSelectedHighlightGraphics({ map: map as never });
    expect(created.polygons.length).toBeGreaterThan(0);
    expect(created.polygons[0]).toMatchObject({ spatialReference: { wkid: 4326 } });
  });

  it("flashes a polyline geometry graphic for river paths", () => {
    const geometry: HighlightGeometry = {
      kind: "polyline",
      paths: [
        [
          [-111.5, 46.5],
          [-111.4, 46.6],
        ],
      ],
    };
    store.setSelected(target({ kind: "point", geometry, geometryFadesAt: Date.now() + 6000 }));
    const map = makeMap();
    attachSelectedHighlightGraphics({ map: map as never });
    expect(created.polylines.length).toBeGreaterThan(0);
  });

  it("does not paint a geometry flash whose fade time has already passed", () => {
    const geometry: HighlightGeometry = {
      kind: "polygon",
      rings: [
        [
          [-111, 46],
          [-110, 46],
          [-110, 47],
          [-111, 46],
        ],
      ],
    };
    store.setSelected(target({ geometry, geometryFadesAt: Date.now() - 1 }));
    const map = makeMap();
    attachSelectedHighlightGraphics({ map: map as never });
    expect(created.polygons.length).toBe(0);
  });

  it("auto-clears the store when the target TTL elapses", () => {
    vi.useFakeTimers();
    store.setSelected(target({ expiresAt: Date.now() + 1000 }));
    const map = makeMap();
    attachSelectedHighlightGraphics({ map: map as never });
    expect(store.clear).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1001);
    expect(store.clear).toHaveBeenCalledTimes(1);
  });

  it("stops reacting to store changes after detach", () => {
    const map = makeMap();
    const detach = attachSelectedHighlightGraphics({ map: map as never });
    detach();
    const layer = map.layers[0];
    layer.add.mockClear();
    store.setSelected(target({ label: "Post-detach" }));
    expect(layer.add).not.toHaveBeenCalled();
  });
});
