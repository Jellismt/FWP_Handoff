/**
 * @file selectionPulse.test.ts
 * @module engage-mt/map
 * @description Unit tests for the tap selection-pulse microinteraction. The
 *              @arcgis/core Graphic / GraphicsLayer classes are mocked as
 *              recording shells and the haptics seam is mocked. Covers the
 *              reduced-motion static-ring path (single ring, fades via timeout),
 *              the animated expanding-pulse path (rAF-driven symbol mutation +
 *              self-clear at the end), the pulse-layer reuse + single-pulse
 *              rule (a second tap cancels the prior animation), and the light
 *              haptic that accompanies every pulse.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-01
 * @updated 2026-07-02
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const created = vi.hoisted(() => ({
  layers: [] as FakeLayer[],
}));

interface FakeLayer {
  listMode: string;
  add: ReturnType<typeof vi.fn>;
  remove: ReturnType<typeof vi.fn>;
  removeAll: ReturnType<typeof vi.fn>;
  graphics: unknown[];
}

vi.mock("@arcgis/core/layers/GraphicsLayer", () => ({
  default: class {
    listMode: string;
    graphics: unknown[] = [];
    add = vi.fn((g: unknown) => this.graphics.push(g));
    remove = vi.fn();
    removeAll = vi.fn(() => {
      this.graphics = [];
    });
    constructor(props: { listMode: string }) {
      this.listMode = props.listMode;
      created.layers.push(this as unknown as FakeLayer);
    }
  },
}));

vi.mock("@arcgis/core/Graphic", () => ({
  default: class {
    geometry: unknown;
    symbol: { clone: () => unknown } & Record<string, unknown>;
    constructor(props: { geometry: unknown; symbol: Record<string, unknown> }) {
      this.geometry = props.geometry;
      // Give the symbol a clone() so the animation's redraw-trigger works.
      this.symbol = {
        ...props.symbol,
        clone() {
          return { ...this };
        },
      };
    }
  },
}));

const haptics = vi.hoisted(() => ({ impact: vi.fn(async () => {}) }));
vi.mock("@/services/mobile/haptics", () => ({ impact: haptics.impact }));

import { pulseAtPoint } from "./selectionPulse";

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

interface FakeView {
  map: {
    layers: { includes: (l: unknown) => boolean };
    add: ReturnType<typeof vi.fn>;
  };
}

const makeView = (): FakeView => {
  const layers: unknown[] = [];
  return {
    map: {
      layers: { includes: (l: unknown) => layers.includes(l) },
      add: vi.fn((l: unknown) => layers.push(l)),
    },
  };
};

const POINT = { longitude: -111.5, latitude: 46.5 } as never;

beforeEach(() => {
  vi.clearAllMocks();
  created.layers.length = 0;
  haptics.impact.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("pulseAtPoint — reduced motion", () => {
  beforeEach(() => setReducedMotion(true));

  it("adds a single static ring and fires a light haptic", () => {
    const view = makeView();
    pulseAtPoint(view as never, POINT);
    const layer = created.layers[0];
    expect(layer.add).toHaveBeenCalledTimes(1);
    expect(haptics.impact).toHaveBeenCalledWith("light");
  });

  it("clears the static ring after the fade timeout", () => {
    vi.useFakeTimers();
    const view = makeView();
    pulseAtPoint(view as never, POINT);
    const layer = created.layers[0];
    expect(layer.remove).not.toHaveBeenCalled();
    vi.advanceTimersByTime(600);
    expect(layer.remove).toHaveBeenCalledTimes(1);
  });

  it("reuses the same pulse layer across taps (single layer created)", () => {
    const view = makeView();
    pulseAtPoint(view as never, POINT);
    pulseAtPoint(view as never, POINT);
    expect(created.layers).toHaveLength(1);
    // Each tap clears the layer before drawing its own ring.
    expect(created.layers[0].removeAll).toHaveBeenCalledTimes(2);
  });
});

describe("pulseAtPoint — animated", () => {
  beforeEach(() => setReducedMotion(false));

  it("starts an rAF-driven pulse and self-clears at the end of the animation", () => {
    vi.useFakeTimers();
    const rafSpy = vi.spyOn(window, "requestAnimationFrame");
    const nowSpy = vi.spyOn(performance, "now");
    nowSpy.mockReturnValue(0);

    const view = makeView();
    pulseAtPoint(view as never, POINT);
    const layer = created.layers[0];
    expect(layer.add).toHaveBeenCalledTimes(1);
    expect(rafSpy).toHaveBeenCalled();

    // Drive one mid-animation frame: symbol mutates, graphic stays.
    nowSpy.mockReturnValue(300);
    rafSpy.mock.calls.at(-1)![0](300);
    expect(layer.remove).not.toHaveBeenCalled();

    // Drive a frame past the total duration (600ms * 2 repeats = 1200ms).
    nowSpy.mockReturnValue(1300);
    rafSpy.mock.calls.at(-1)![0](1300);
    expect(layer.remove).toHaveBeenCalledTimes(1);

    rafSpy.mockRestore();
    nowSpy.mockRestore();
  });

  it("cancels the prior in-flight animation when a second tap arrives", () => {
    const cancelSpy = vi.spyOn(window, "cancelAnimationFrame");
    const view = makeView();
    pulseAtPoint(view as never, POINT);
    pulseAtPoint(view as never, POINT);
    expect(cancelSpy).toHaveBeenCalled();
    cancelSpy.mockRestore();
  });
});
