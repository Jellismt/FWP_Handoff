/**
 * @file fieldMapGraphics.test.ts
 * @module engage-mt/services/field
 * @description Unit tests for the field-tools GraphicsLayer renderer. The
 *              @arcgis/core classes are mocked as recording shells and the four
 *              subscribed Zustand stores (field tools, track recorder, theme,
 *              user-graphics visibility) are mocked with controllable state, so
 *              we assert on which graphics land on the layer and with which
 *              attributes/geometry. Covers waypoint/route/shape rendering, the
 *              degenerate-geometry drop paths, the "hide my pins" branch (which
 *              still shows an in-progress track), idempotent attach, and detach.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-01
 * @updated 2026-07-03
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

interface Recorded {
  geometry: { type: string; paths?: number[][][]; rings?: number[][][] } & Record<string, unknown>;
  symbol: Record<string, unknown>;
  attributes?: Record<string, unknown>;
}
const created = vi.hoisted(() => ({ graphics: [] as Recorded[] }));

vi.mock("@arcgis/core/Map", () => ({ default: class {} }));
vi.mock("@arcgis/core/layers/GraphicsLayer", () => ({
  default: class {
    id: string;
    add = vi.fn();
    removeAll = vi.fn();
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
    constructor(props: Recorded) {
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
      Object.assign(this, props, { type: "point" });
    }
  },
}));
vi.mock("@arcgis/core/geometry/Polyline", () => ({
  default: class {
    constructor(props: unknown) {
      Object.assign(this, props, { type: "polyline" });
    }
  },
}));
vi.mock("@arcgis/core/geometry/Polygon", () => ({
  default: class {
    constructor(props: unknown) {
      Object.assign(this, props, { type: "polygon" });
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

vi.mock("@/utils/cssVarToHex", () => ({ cssVarToHex: () => "#123456" }));
vi.mock("@/utils/logger", () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

// ── Store mocks ─────────────────────────────────────────────────────────
const stores = vi.hoisted(() => ({
  tools: {
    waypoints: [] as unknown[],
    routes: [] as unknown[],
    shapes: [] as unknown[],
  },
  recorder: { status: "idle" as string, path: [] as Array<[number, number]> },
  visible: true,
  subscribeNoop: () => () => {},
}));

vi.mock("@/store/field/fieldToolsStore", () => ({
  useFieldToolsStore: { getState: () => stores.tools, subscribe: stores.subscribeNoop },
  WAYPOINT_COLOR_VAR: { red: "var(--fwp-red)", blue: "var(--fwp-blue)" },
  WAYPOINT_KIND_INFO: {
    general: { label: "Waypoint", icon: "map-pin", color: "var(--fwp-blue)" },
    camp: { label: "Camp", icon: "tent", color: "var(--fwp-accent-explore)" },
  },
}));
vi.mock("@/services/field/trackRecorder", () => ({
  useTrackRecorderStore: { getState: () => stores.recorder, subscribe: stores.subscribeNoop },
}));
vi.mock("@/store/app/themeStore", () => ({
  useThemeStore: { subscribe: stores.subscribeNoop },
}));
vi.mock("@/store/field/userGraphicsVisibleStore", () => ({
  useUserGraphicsVisibleStore: {
    getState: () => ({ visible: stores.visible }),
    subscribe: stores.subscribeNoop,
  },
}));

import { attachFieldGraphics, FIELD_GRAPHICS_LAYER_ID } from "./fieldMapGraphics";

interface FakeLayer {
  id: string;
  add: ReturnType<typeof vi.fn>;
  removeAll: ReturnType<typeof vi.fn>;
}
const makeMap = (existing: FakeLayer | null = null) => {
  const layers: FakeLayer[] = [];
  return {
    layers,
    findLayerById: vi.fn(() => existing),
    add: vi.fn((l: FakeLayer) => layers.push(l)),
    remove: vi.fn(),
  };
};

const wp = (over: Record<string, unknown> = {}) => ({
  id: "w1",
  kind: "general",
  name: "Camp A",
  notes: "note",
  lat: 46.5,
  lon: -111.5,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
  photos: [],
  tags: [],
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  created.graphics.length = 0;
  stores.tools = { waypoints: [], routes: [], shapes: [] };
  stores.recorder = { status: "idle", path: [] };
  stores.visible = true;
  // Force the synchronous rerender path in attach.
  vi.stubGlobal("requestAnimationFrame", undefined);
});

describe("attachFieldGraphics — layer lifecycle", () => {
  it("attaches a GraphicsLayer with the field-tools id and detaches it", () => {
    const map = makeMap();
    const detach = attachFieldGraphics({ map: map as never });
    expect(map.add).toHaveBeenCalledTimes(1);
    expect(map.layers[0].id).toBe(FIELD_GRAPHICS_LAYER_ID);
    detach();
    expect(map.remove).toHaveBeenCalledWith(map.layers[0]);
  });

  it("is idempotent — a second attach with the layer present is a no-op", () => {
    const existing = { id: FIELD_GRAPHICS_LAYER_ID, add: vi.fn(), removeAll: vi.fn() };
    const map = makeMap(existing);
    const detach = attachFieldGraphics({ map: map as never });
    expect(map.add).not.toHaveBeenCalled();
    // Returned detach is a safe no-op.
    expect(() => detach()).not.toThrow();
  });
});

describe("attachFieldGraphics — rendering", () => {
  it("renders a waypoint marker carrying its tap-route attributes", () => {
    stores.tools.waypoints = [wp()];
    const map = makeMap();
    attachFieldGraphics({ map: map as never });
    const g = created.graphics.find((x) => x.attributes?.__feature_kind === "waypoint");
    expect(g).toBeDefined();
    expect(g?.geometry.type).toBe("point");
    expect(g?.attributes).toMatchObject({
      id: "w1",
      name: "Camp A",
      kind: "general",
      photoCount: 0,
    });
  });

  it("renders a route polyline and drops routes with < 2 points", () => {
    stores.tools.routes = [
      {
        id: "r1",
        name: "R1",
        path: [
          [-111, 46],
          [-111.1, 46.1],
        ],
        distanceMi: 1,
        gainFt: 10,
        startedAt: "s",
        endedAt: "e",
      },
      {
        id: "r2",
        name: "R2",
        path: [[-111, 46]],
        distanceMi: 0,
        gainFt: 0,
        startedAt: "s",
        endedAt: "e",
      },
    ];
    const map = makeMap();
    attachFieldGraphics({ map: map as never });
    const routes = created.graphics.filter((x) => x.attributes?.__feature_kind === "route");
    expect(routes).toHaveLength(1);
    expect(routes[0].attributes).toMatchObject({ id: "r1", sampleCount: 2 });
  });

  it("renders a rectangle shape as a closed 5-vertex polygon ring", () => {
    stores.tools.shapes = [
      {
        id: "s1",
        name: "Zone",
        shape: "rectangle",
        vertices: [
          [-111, 46],
          [-110, 47],
        ],
        color: "blue",
        createdAt: "c",
      },
    ];
    const map = makeMap();
    attachFieldGraphics({ map: map as never });
    const shape = created.graphics.find((x) => x.attributes?.__feature_kind === "shape");
    expect(shape?.geometry.type).toBe("polygon");
    // rings[0] is the closed rectangle: 5 points, first === last.
    const ring = shape?.geometry.rings?.[0] as number[][];
    expect(ring).toHaveLength(5);
    expect(ring[0]).toEqual(ring[4]);
  });

  it("closes an open free-hand polygon", () => {
    stores.tools.shapes = [
      {
        id: "s2",
        name: "Poly",
        shape: "polygon",
        vertices: [
          [-111, 46],
          [-110.5, 46.5],
          [-110, 46],
        ],
        color: "green",
        createdAt: "c",
      },
    ];
    const map = makeMap();
    attachFieldGraphics({ map: map as never });
    const shape = created.graphics.find((x) => x.attributes?.__feature_kind === "shape");
    const ring = shape?.geometry.rings?.[0] as number[][];
    // Auto-closed: first vertex re-appended at the end.
    expect(ring[0]).toEqual(ring[ring.length - 1]);
    expect(ring).toHaveLength(4);
  });

  it("drops a degenerate polyline shape with a single vertex", () => {
    stores.tools.shapes = [
      {
        id: "s3",
        name: "Line",
        shape: "polyline",
        vertices: [[-111, 46]],
        color: "red",
        createdAt: "c",
      },
    ];
    const map = makeMap();
    attachFieldGraphics({ map: map as never });
    expect(created.graphics.filter((x) => x.attributes?.__feature_kind === "shape")).toHaveLength(
      0,
    );
  });
});

describe("attachFieldGraphics — visibility + recording", () => {
  it("renders nothing (but keeps the layer) when pins are hidden and no recording", () => {
    stores.visible = false;
    stores.tools.waypoints = [wp()];
    const map = makeMap();
    attachFieldGraphics({ map: map as never });
    expect(created.graphics).toHaveLength(0);
    expect(map.layers[0].removeAll).toHaveBeenCalled();
  });

  it("still renders an in-progress recording track while pins are hidden", () => {
    stores.visible = false;
    stores.recorder = {
      status: "recording",
      path: [
        [-111, 46],
        [-111.1, 46.1],
      ],
    };
    const map = makeMap();
    attachFieldGraphics({ map: map as never });
    const track = created.graphics.find((x) => x.attributes?.__feature_kind === "active-track");
    expect(track).toBeDefined();
    expect(track?.geometry.type).toBe("polyline");
  });

  it("renders the active recording track alongside pins when visible", () => {
    stores.recorder = {
      status: "paused",
      path: [
        [-111, 46],
        [-111.2, 46.2],
      ],
    };
    stores.tools.waypoints = [wp()];
    const map = makeMap();
    attachFieldGraphics({ map: map as never });
    expect(created.graphics.some((x) => x.attributes?.__feature_kind === "active-track")).toBe(
      true,
    );
    expect(created.graphics.some((x) => x.attributes?.__feature_kind === "waypoint")).toBe(true);
  });
});
