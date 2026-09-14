/**
 * @file iconSymbols.test.ts
 * @module engage-mt/map/symbology
 * @description Snapshot + coverage tests for the
 *              per-layer icon registry. Verifies (a) every registered
 *              layer produces a usable PictureMarkerSymbol shape, (b)
 *              theme variations produce distinct cached outputs, (c)
 *              representative SVG payloads match snapshot baselines so
 *              accidental visual regressions surface in code review.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-01
 * @updated 2026-06-10
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { describe, expect, it, beforeEach } from "vitest";
import {
  REGISTERED_ICON_LAYERS,
  hasIconForLayer,
  iconColorForLayer,
  pictureMarkerForLayer,
  clearIconCache,
} from "./iconSymbols";

beforeEach(() => {
  clearIconCache();
});

describe("iconSymbols registry", () => {
  it("registers icons for every expected point layer", () => {
    const expected = [
      "fishing-access-sites",
      "usgs-gages",
      "dnrc-stage-gages",
      "ais-inspection-stations",
      "fwp-access-program",
      "blm-recreation-sites",
      "bor-recreation-sites",
      "usfs-recreation-sites",
    ];
    for (const id of expected) {
      expect(REGISTERED_ICON_LAYERS).toContain(id);
      expect(hasIconForLayer(id)).toBe(true);
    }
  });

  it("returns null for unregistered layers", () => {
    expect(hasIconForLayer("unknown-layer")).toBe(false);
    expect(pictureMarkerForLayer("unknown-layer", "light")).toBeNull();
    expect(iconColorForLayer("unknown-layer")).toBeNull();
  });

  it("returns valid picture-marker symbol props for FAS", () => {
    // FAS is a packaged PNG sprite (see iconSymbols.ts ICON_REGISTRY entry,
    // kind: "png"). The
    // returned `url` is therefore a flat asset path, not an svg+xml
    // data URI. Width/height still come from sizeFor(spec).
    const sym = pictureMarkerForLayer("fishing-access-sites", "light");
    expect(sym).not.toBeNull();
    expect(sym?.type).toBe("picture-marker");
    expect(sym?.url).toMatch(/\/icons\/layers\/fishing-access-sites\.png\?v=/);
    expect(sym?.width).toBe(28);
    expect(sym?.height).toBe(28);
  });

  it("PNG icons resolve to the same packaged asset across themes", () => {
    // The registry is PNG-only — the packaged sprites are designed to read on
    // both light and dark basemaps, so theme flips return the same asset path.
    const light = pictureMarkerForLayer("cwd-check-stations", "light");
    const dark = pictureMarkerForLayer("cwd-check-stations", "dark");
    expect(light?.url).toEqual(dark?.url);
    expect(light?.url).toContain("/icons/layers/cwd-check-stations.png");
  });

  it("caches identical (layer, theme) lookups", () => {
    const a = pictureMarkerForLayer("active-fires-points", "light");
    const b = pictureMarkerForLayer("active-fires-points", "light");
    expect(a).toBe(b); // identity, not just equality — cached object
  });

  it("resolves agency-specific colors for recreation sites", () => {
    // BLM = orange, BOR = blue, USFS = green; per agency brand guides.
    expect(iconColorForLayer("blm-recreation-sites")).toBe("#E57200");
    expect(iconColorForLayer("bor-recreation-sites")).toBe("#1976D2");
    expect(iconColorForLayer("usfs-recreation-sites")).toBe("#2D5016");
  });

  it("snapshot — FAS light points at the packaged PNG sprite", () => {
    // Post-migration FAS is a flat PNG asset reference; no inline SVG,
    // no per-theme variation. Snapshot guards against regressions in
    // the asset path or accidental data-URI re-introduction.
    const sym = pictureMarkerForLayer("fishing-access-sites", "light");
    expect(sym?.url).toContain("/icons/layers/fishing-access-sites.png");
  });

  it("snapshot — the custom layer icons point at their packaged PNG sprites", () => {
    expect(pictureMarkerForLayer("cwd-check-stations", "light")?.url).toContain(
      "/icons/layers/cwd-check-stations.png",
    );
    expect(pictureMarkerForLayer("usgs-gages", "light")?.url).toContain(
      "/icons/layers/stream-gages.png",
    );
    expect(pictureMarkerForLayer("fwp-access-program", "light")?.url).toContain(
      "/icons/layers/fwp-access-program.png",
    );
    expect(pictureMarkerForLayer("license-ambassadors", "light")?.url).toContain(
      "/icons/layers/license-ambassadors.png",
    );
    expect(pictureMarkerForLayer("mountain-ranges", "light")?.url).toContain(
      "/icons/layers/mountain-ranges.png",
    );
    expect(pictureMarkerForLayer("engage-mt:wind-stations", "light")?.url).toContain(
      "/icons/layers/wind-arrows.png",
    );
    // River mile markers render at ~1/4 the standard size on the map.
    const rm = pictureMarkerForLayer("river-mile-markers", "light");
    expect(rm?.url).toContain("/icons/layers/river-mile-markers.png");
    expect(rm?.width).toBe(7);
  });
});
