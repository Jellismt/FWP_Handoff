/**
 * @file colors.test.ts
 * @module engage-mt/map/symbology
 * @description Unit tests for the cartographic color helpers. Covers the
 *              tenure-overlay id lookup (every branch + the null default),
 *              the CSS-var fallback path (happy-dom returns empty computed
 *              styles, so every helper exercises its literal-hex fallback),
 *              the decimal-alpha RGBA contract, hex parsing, and the
 *              RGB→HSL→RGB lightness round-trip incl. clamping + achromatic
 *              (grey) branch.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-01
 * @updated 2026-07-01
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { describe, expect, it } from "vitest";
import type { EngageMtModule } from "@/types/layers";
import { hexToRgba, moduleAccentHex, shiftLightness, tenureOverlayFor } from "./colors";

describe("tenureOverlayFor", () => {
  it("returns the BMA lemon-lime overlay for bma-boundaries", () => {
    const o = tenureOverlayFor("bma-boundaries");
    expect(o).not.toBeNull();
    // happy-dom resolves no CSS vars, so the literal fallbacks materialize.
    expect(o?.fillHex).toBe("#C6E22D");
    expect(o?.outlineHex).toBe("#7A9112");
    expect(o?.fillAlpha).toBeCloseTo(0.4);
  });

  it("returns the WMA olive-sage overlay for wma-boundaries", () => {
    expect(tenureOverlayFor("wma-boundaries")).toMatchObject({
      fillHex: "#6A8B45",
      outlineHex: "#4A6330",
      fillAlpha: 0.4,
    });
  });

  it("returns the state-park forest-green overlay for state-parks", () => {
    expect(tenureOverlayFor("state-parks")).toMatchObject({
      fillHex: "#338033",
      outlineHex: "#1A5C1A",
    });
  });

  it("returns null for a layer id with no overlay", () => {
    expect(tenureOverlayFor("hunting-districts")).toBeNull();
    expect(tenureOverlayFor("")).toBeNull();
  });

  it("keeps fillAlpha within the 0..1 decimal-alpha contract for every overlay", () => {
    for (const id of ["bma-boundaries", "wma-boundaries", "state-parks"]) {
      const alpha = tenureOverlayFor(id)?.fillAlpha ?? -1;
      expect(alpha).toBeGreaterThan(0);
      expect(alpha).toBeLessThanOrEqual(1);
    }
  });
});

describe("moduleAccentHex", () => {
  it("maps each explicit module to its brand accent fallback hex", () => {
    const expected: Partial<Record<EngageMtModule, string>> = {
      hunt: "#B3252E",
      fish: "#002855",
      explore: "#744F28",
      access: "#046A38",
      manage: "#2D3748",
    };
    (Object.keys(expected) as EngageMtModule[]).forEach((m) => {
      expect(moduleAccentHex(m)).toBe(expected[m]);
    });
  });

  it("falls back to the CTA green for the reference / shared pseudo-modules", () => {
    // These aren't in the switch → default branch → CTA green fallback.
    expect(moduleAccentHex("reference")).toBe("#046A38");
    expect(moduleAccentHex("shared")).toBe("#046A38");
  });
});

describe("hexToRgba", () => {
  it("parses #RRGGBB into integer channels and keeps alpha DECIMAL", () => {
    expect(hexToRgba("#C6E22D", 0.4)).toEqual([198, 226, 45, 0.4]);
  });

  it("parses pure black and pure white correctly", () => {
    expect(hexToRgba("#000000", 1)).toEqual([0, 0, 0, 1]);
    expect(hexToRgba("#FFFFFF", 0)).toEqual([255, 255, 255, 0]);
  });

  it("does NOT rescale alpha — a 0..1 value passes through untouched", () => {
    // The whole point of the module: passing 0..255 here would render
    // opaque. We keep whatever the caller supplies.
    const [, , , a] = hexToRgba("#046A38", 0.25);
    expect(a).toBe(0.25);
  });
});

describe("shiftLightness", () => {
  it("lightens a saturated color toward white with a positive pct", () => {
    const lighter = shiftLightness("#046A38", 20);
    // Same 6-digit hex form, and visibly brighter than the source.
    expect(lighter).toMatch(/^#[0-9a-f]{6}$/);
    expect(lighter).not.toBe("#046a38");
    const lum = (h: string): number => {
      const n = h.replace("#", "");
      return (
        parseInt(n.slice(0, 2), 16) + parseInt(n.slice(2, 4), 16) + parseInt(n.slice(4, 6), 16)
      );
    };
    expect(lum(lighter)).toBeGreaterThan(lum("#046a38"));
  });

  it("darkens toward black with a negative pct", () => {
    const darker = shiftLightness("#C6E22D", -30);
    const lum = (h: string): number => {
      const n = h.replace("#", "");
      return (
        parseInt(n.slice(0, 2), 16) + parseInt(n.slice(2, 4), 16) + parseInt(n.slice(4, 6), 16)
      );
    };
    expect(lum(darker)).toBeLessThan(lum("#c6e22d"));
  });

  it("clamps lightness at pure white when over-lightened", () => {
    expect(shiftLightness("#808080", 100)).toBe("#ffffff");
  });

  it("clamps lightness at pure black when over-darkened", () => {
    expect(shiftLightness("#808080", -100)).toBe("#000000");
  });

  it("keeps an achromatic (grey) color grey through the HSL round-trip", () => {
    // Grey has zero saturation — the s===0 branch must produce equal
    // channels, not drift toward a hue.
    const out = shiftLightness("#808080", 10);
    const n = out.replace("#", "");
    const r = n.slice(0, 2);
    const g = n.slice(2, 4);
    const b = n.slice(4, 6);
    expect(r).toBe(g);
    expect(g).toBe(b);
  });

  it("round-trips a zero shift close to the original color", () => {
    // A 0% shift should be an (approximate) identity — HSL rounding may
    // move a channel by ±1, so assert per-channel closeness.
    const out = shiftLightness("#B3252E", 0);
    const chan = (h: string, i: number): number => parseInt(h.replace("#", "").slice(i, i + 2), 16);
    expect(chan(out, 0)).toBeCloseTo(0xb3, -1);
    expect(chan(out, 2)).toBeCloseTo(0x25, -1);
    expect(chan(out, 4)).toBeCloseTo(0x2e, -1);
  });
});
