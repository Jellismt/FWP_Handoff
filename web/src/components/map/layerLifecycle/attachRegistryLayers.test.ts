/**
 * @file attachRegistryLayers.test.ts
 * @module engage-mt/map
 * @description Unit tests for the registry-layer construction + async-mount
 *              lifecycle. `@/config/layers` is replaced with a small controlled
 *              registry so we can exercise each branch deterministically:
 *              deferred / unavailable / composite skips, the non-ArcGIS URL
 *              skip, z-order sorting, the FeatureLayer build + load-status
 *              watch (failure → setFailed + up to 3 backoff retries; loaded → clear),
 *              the raster + portal-item async paths, the async GraphicsLayer
 *              mounts (gages), and detach cleanup.
 *              ArcGIS classes + build helpers are mocked as recording shells.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-01
 * @updated 2026-07-07
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LayerDef } from "@/types/layers";
import type Layer from "@arcgis/core/layers/Layer";

// ── Hoisted controllable state ───────────────────────────────────────────
const h = vi.hoisted(() => ({
  registry: [] as LayerDef[],
  visible: {} as Record<string, boolean>,
  setFailed: vi.fn(),
  themeResolved: "light" as string,
  // reactiveUtils.watch records its getter + callback so tests can fire it.
  watchers: [] as Array<{ getter: () => unknown; cb: (v: unknown) => void; remove: () => void }>,
  builtLayers: [] as Array<{ def: LayerDef; visible: boolean; instance: FakeBuiltLayer }>,
  // Counts destroy() on layers whose async construction outlived teardown.
  destroyCalls: 0,
  // Fake async-mounted GraphicsLayer families (used inside hoisted mock factories).
  gagesLayer: {
    id: "usgs-gages",
    destroy: () => {
      h.destroyCalls += 1;
    },
  } as unknown as Layer,
}));

// A FeatureLayer stand-in whose loadStatus the watch getter reads.
interface FakeBuiltLayer {
  id: string;
  loadStatus: string;
  loadError?: Error;
  load: ReturnType<typeof vi.fn>;
}

vi.mock("@arcgis/core/layers/FeatureLayer", () => ({ default: class FeatureLayer {} }));
vi.mock("@arcgis/core/core/reactiveUtils", () => ({
  watch: vi.fn((getter: () => unknown, cb: (v: unknown) => void) => {
    const handle = { getter, cb, remove: vi.fn() };
    h.watchers.push(handle);
    return handle;
  }),
}));

vi.mock("@/config/layers", () => ({
  get LAYER_REGISTRY() {
    return h.registry;
  },
}));
vi.mock("@/store/map/layerVisibilityStore", () => ({
  useLayerVisibilityStore: { getState: () => ({ visible: h.visible }) },
}));
vi.mock("@/store/map/layerLoadStatusStore", () => ({
  useLayerLoadStatusStore: { getState: () => ({ setFailed: h.setFailed }) },
}));
vi.mock("@/store/app/themeStore", () => ({
  useThemeStore: { getState: () => ({ resolved: h.themeResolved }) },
}));
vi.mock("@/utils/esriCast", () => ({ asPortalItem: (id: string) => ({ id }) }));

vi.mock("../buildLayer", () => ({
  buildLayer: vi.fn((def: LayerDef, visible: boolean): FakeBuiltLayer => {
    const instance: FakeBuiltLayer = {
      id: def.id,
      loadStatus: "loading",
      load: vi.fn().mockResolvedValue(undefined),
    };
    h.builtLayers.push({ def, visible, instance });
    return instance;
  }),
}));

// Async GraphicsLayer families — resolve to a fake layer with the expected id.
vi.mock("../usgsGagesLayer", () => ({
  buildUsgsGagesLayer: vi.fn().mockResolvedValue({ layer: h.gagesLayer }),
}));

// Dynamic ArcGIS imports used inside the portal-item + raster branches.
vi.mock("@arcgis/core/layers/Layer", () => ({
  default: class {
    static fromPortalItem = vi.fn().mockImplementation(async () => ({
      id: "",
      title: "",
      visible: false,
      opacity: 1,
      destroy: () => {
        h.destroyCalls += 1;
      },
    }));
  },
}));
vi.mock("@arcgis/core/layers/ImageryLayer", () => ({
  default: class {
    id: string;
    constructor(props: { id: string }) {
      this.id = props.id;
    }
    destroy(): void {
      h.destroyCalls += 1;
    }
  },
}));

import { attachRegistryLayers } from "./attachRegistryLayers";
import { buildLayer } from "../buildLayer";
import { buildUsgsGagesLayer } from "../usgsGagesLayer";

// ── Fakes ────────────────────────────────────────────────────────────────
interface FakeMap {
  add: ReturnType<typeof vi.fn>;
  remove: ReturnType<typeof vi.fn>;
  added: Layer[];
}

const makeMap = (): FakeMap => {
  const added: Layer[] = [];
  return {
    added,
    add: vi.fn((l: Layer) => added.push(l)),
    remove: vi.fn(),
  };
};

const makeView = (): __esri.MapView => ({}) as unknown as __esri.MapView;

// Minimal LayerDef factory — only the fields the source reads.
const def = (over: Partial<LayerDef> & { id: string }): LayerDef =>
  ({
    module: "fish",
    title: over.id,
    url: "https://example.arcgis.com/FeatureServer/0",
    source: "fwp-public-hub",
    geometry: "point",
    defaultVisible: false,
    freshness: "static",
    ...over,
  }) as unknown as LayerDef;

const flush = async (): Promise<void> => {
  // The raster + portal branches chain dynamic `import()` promises
  // (each an extra microtask hop even when mocked); drain generously.
  for (let i = 0; i < 40; i++) await Promise.resolve();
};

beforeEach(() => {
  vi.clearAllMocks();
  h.registry = [];
  h.visible = {};
  h.watchers.length = 0;
  h.builtLayers.length = 0;
  h.destroyCalls = 0;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("attachRegistryLayers — skip branches", () => {
  it("skips deferred-load, unavailable, and composite layers", async () => {
    h.registry = [
      def({ id: "deferred", deferredLoad: true }),
      def({ id: "unavail", unavailable: { note: "out of season" } }),
      def({ id: "composite", composite: ["child-a", "child-b"] }),
    ];
    const map = makeMap();
    attachRegistryLayers({ map: map as unknown as never, view: makeView(), alive: () => true });
    await flush();

    // None of the three were built via buildLayer.
    expect(buildLayer).not.toHaveBeenCalled();
  });

  it("skips a layer whose URL is not an ArcGIS REST endpoint", async () => {
    h.registry = [def({ id: "fixture", url: "/data/some-fixture.json" })];
    const map = makeMap();
    attachRegistryLayers({ map: map as unknown as never, view: makeView(), alive: () => true });
    await flush();
    expect(buildLayer).not.toHaveBeenCalled();
  });
});

describe("attachRegistryLayers — z-order", () => {
  it("sorts point layers above polygons (points drawn last = on top)", async () => {
    h.registry = [
      def({ id: "points", geometry: "point" }),
      def({ id: "polys", geometry: "polygon" }),
    ];
    const map = makeMap();
    attachRegistryLayers({ map: map as unknown as never, view: makeView(), alive: () => true });
    await flush();

    // buildLayer is called in ascending priority order: polygon (3) before point (6).
    const order = (buildLayer as ReturnType<typeof vi.fn>).mock.calls.map(
      (c) => (c[0] as LayerDef).id,
    );
    expect(order.indexOf("polys")).toBeLessThan(order.indexOf("points"));
  });

  it("inserts a vector-tile portal layer at the BOTTOM (index 0)", async () => {
    h.registry = [def({ id: "ownership-vtl", geometry: "vector-tile", portalItemId: "abc123" })];
    const map = makeMap();
    attachRegistryLayers({ map: map as unknown as never, view: makeView(), alive: () => true });
    await flush();

    // The async portal-item add must pass index 0 so it lands beneath the
    // synchronously-mounted boundary + district layers (not appended on top).
    const addCall = map.add.mock.calls.find(
      (c) => (c[0] as { id?: string })?.id === "ownership-vtl",
    );
    expect(addCall).toBeDefined();
    expect(addCall![1]).toBe(0);
  });

  it("still appends a non-vector-tile portal layer on top (no index)", async () => {
    h.registry = [def({ id: "wind", geometry: "point", portalItemId: "wind123" })];
    const map = makeMap();
    attachRegistryLayers({ map: map as unknown as never, view: makeView(), alive: () => true });
    await flush();

    const addCall = map.add.mock.calls.find((c) => (c[0] as { id?: string })?.id === "wind");
    expect(addCall).toBeDefined();
    expect(addCall![1]).toBeUndefined();
  });
});

describe("attachRegistryLayers — FeatureLayer build + load-status watch", () => {
  it("builds each eligible layer, adds it to the map, and indexes it", async () => {
    h.registry = [def({ id: "fas", geometry: "point" })];
    h.visible = { fas: true };
    const map = makeMap();
    const { layerIndex } = attachRegistryLayers({
      map: map as unknown as never,
      view: makeView(),
      alive: () => true,
    });
    await flush();

    expect(buildLayer).toHaveBeenCalledWith(expect.objectContaining({ id: "fas" }), true);
    expect(layerIndex.get("fas")).toBeDefined();
    expect(map.add).toHaveBeenCalled();
  });

  it("marks a layer failed AND retries up to 3 times with backoff on load failure", async () => {
    vi.useFakeTimers();
    h.registry = [def({ id: "fas", geometry: "point" })];
    const map = makeMap();
    attachRegistryLayers({ map: map as unknown as never, view: makeView(), alive: () => true });

    const built = h.builtLayers[0].instance;
    const watch = h.watchers.find((w) => w.getter() === "loading");
    expect(watch).toBeDefined();

    built.loadStatus = "failed";
    built.loadError = new Error("503 upstream");

    // 1st failure → retry after 1500ms (base * 1).
    watch!.cb("failed");
    expect(h.setFailed).toHaveBeenCalledWith("fas", true);
    expect(built.load).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1500);
    expect(built.load).toHaveBeenCalledTimes(1);

    // 2nd failure → retry after 3000ms (base * 2).
    watch!.cb("failed");
    vi.advanceTimersByTime(3000);
    expect(built.load).toHaveBeenCalledTimes(2);

    // 3rd failure → retry after 4500ms (base * 3).
    watch!.cb("failed");
    vi.advanceTimersByTime(4500);
    expect(built.load).toHaveBeenCalledTimes(3);

    // 4th failure → no more retries (MAX_LOAD_RETRIES reached).
    watch!.cb("failed");
    vi.advanceTimersByTime(10000);
    expect(built.load).toHaveBeenCalledTimes(3);

    vi.useRealTimers();
  });

  it("clears the failed flag when the layer transitions to loaded", async () => {
    h.registry = [def({ id: "fas", geometry: "point" })];
    const map = makeMap();
    attachRegistryLayers({ map: map as unknown as never, view: makeView(), alive: () => true });

    const watch = h.watchers.find((w) => w.getter() === "loading");
    watch!.cb("loaded");
    expect(h.setFailed).toHaveBeenCalledWith("fas", false);
  });
});

describe("attachRegistryLayers — raster + async GraphicsLayer families", () => {
  it("mounts a raster layer via the ImageryLayer async path", async () => {
    h.registry = [def({ id: "radar", geometry: "raster", url: "https://x/ImageServer" })];
    h.visible = { radar: true };
    const map = makeMap();
    const { layerIndex } = attachRegistryLayers({
      map: map as unknown as never,
      view: makeView(),
      alive: () => true,
    });
    await flush();

    expect(buildLayer).not.toHaveBeenCalled(); // raster branch bypasses buildLayer
    expect(layerIndex.get("radar")).toBeDefined();
  });

  it("mounts the USGS gages GraphicsLayer into the index", async () => {
    h.registry = [];
    const map = makeMap();
    const { layerIndex } = attachRegistryLayers({
      map: map as unknown as never,
      view: makeView(),
      alive: () => true,
    });
    await flush();

    expect(buildUsgsGagesLayer).toHaveBeenCalledOnce();
    expect(layerIndex.get("usgs-gages")).toBe(h.gagesLayer);
  });

  it("passes the current theme to the gages builder", async () => {
    h.themeResolved = "dark";
    const map = makeMap();
    attachRegistryLayers({ map: map as unknown as never, view: makeView(), alive: () => true });
    await flush();
    expect(buildUsgsGagesLayer).toHaveBeenCalledWith(expect.any(Boolean), "dark");
  });
});

describe("attachRegistryLayers — detach", () => {
  it("removes every load-status watch handle", async () => {
    h.registry = [def({ id: "fas", geometry: "point" })];
    const map = makeMap();
    const { detach } = attachRegistryLayers({
      map: map as unknown as never,
      view: makeView(),
      alive: () => true,
    });
    await flush();

    const loadWatch = h.watchers.find((w) => w.getter() === "loading");
    detach();

    expect(loadWatch!.remove).toHaveBeenCalledTimes(1);
  });
});

describe("attachRegistryLayers — teardown during an async mount", () => {
  // Every async-mounted layer resolves after the caller may already have torn
  // down. Mounting then would attach a layer to a map whose view is destroyed,
  // so it would never be destroyed with it.
  const cases: ReadonlyArray<{ what: string; layer: LayerDef }> = [
    {
      what: "a portal-item layer",
      layer: def({ id: "vtl", geometry: "vector-tile", portalItemId: "abc" } as never),
    },
    { what: "a raster layer", layer: def({ id: "radar", geometry: "raster" }) },
  ];

  for (const c of cases) {
    it(`does not mount ${c.what} after teardown, and destroys it`, async () => {
      h.registry = [c.layer];
      const map = makeMap();
      let alive = true;
      attachRegistryLayers({
        map: map as unknown as never,
        view: makeView(),
        alive: () => alive,
      });
      alive = false;
      await flush();

      // The layer under test plus the always-mounted gage layer.
      expect(map.added).toHaveLength(0);
      expect(h.destroyCalls).toBe(2);
    });
  }

  it("does not mount the gage layer after teardown, and destroys it", async () => {
    h.registry = [];
    const map = makeMap();
    let alive = true;
    attachRegistryLayers({ map: map as unknown as never, view: makeView(), alive: () => alive });
    alive = false;
    await flush();

    expect(buildUsgsGagesLayer).toHaveBeenCalledTimes(1);
    expect(map.added).toHaveLength(0);
    expect(h.destroyCalls).toBe(1);
  });

  it("still mounts each async layer when the caller is alive", async () => {
    h.registry = [def({ id: "radar", geometry: "raster" })];
    const map = makeMap();
    attachRegistryLayers({ map: map as unknown as never, view: makeView(), alive: () => true });
    await flush();

    // The raster layer plus the always-mounted gage layer.
    expect(map.added).toHaveLength(2);
    expect(h.destroyCalls).toBe(0);
  });
});

describe("attachRegistryLayers — detach", () => {
  it("clears a pending load retry so it cannot fire after teardown", () => {
    vi.useFakeTimers();
    h.registry = [def({ id: "fas", geometry: "point" })];
    const map = makeMap();
    const { detach } = attachRegistryLayers({
      map: map as unknown as never,
      view: makeView(),
      alive: () => true,
    });

    const built = h.builtLayers[0].instance;
    const watch = h.watchers.find((w) => w.getter() === "loading");
    built.loadStatus = "failed";
    built.loadError = new Error("503 upstream");
    watch!.cb("failed");

    detach();
    vi.advanceTimersByTime(10_000);
    expect(built.load).not.toHaveBeenCalled();

    vi.useRealTimers();
  });
});
