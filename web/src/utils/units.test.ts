/**
 * @file units.test.ts
 * @module engage-mt/utils
 * @description Unit tests for the canonical conversion + formatter module.
 *              Reference values come from NIST tables.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-08
 * @updated 2026-07-07
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  cToF,
  cmToIn,
  cmsToCfs,
  detectLengthUnit,
  formatAcres,
  formatCfs,
  formatFahrenheit,
  formatFeet,
  formatFeetFromFeet,
  formatInchRange,
  formatInches,
  formatInHg,
  formatMiles,
  formatMph,
  formatMphFromMph,
  formatPounds,
  gToLb,
  kgToLb,
  kmToMi,
  km2ToAcres,
  lengthToMm,
  lengthToMmForSpecies,
  m2ToAcres,
  mToFt,
  mToMi,
  mmToIn,
  mpsToMph,
  ozToLb,
  weightToGrams,
  formatMeasureDistance,
  formatMeasureArea,
} from "./units";

describe("units — on-map measure formatters", () => {
  it("shows yards below half a mile", () => {
    expect(formatMeasureDistance(100)).toBe("109 yd");
    // Just under 0.5 mi (804.67 m) stays in yards.
    expect(formatMeasureDistance(804)).toBe("879 yd");
  });

  it("flips to miles just past half a mile and above", () => {
    // A hair past 0.5 mi → miles (the exact float boundary rounds to yards).
    expect(formatMeasureDistance(805)).toBe("0.50 mi");
    expect(formatMeasureDistance(1609.344)).toBe("1.00 mi");
  });

  it("formats area in acres (2 decimals under 10 ac, 1 above)", () => {
    // 1 acre = 4046.86 m².
    expect(formatMeasureArea(4046.86)).toBe("1.00 ac");
    expect(formatMeasureArea(4046.86 * 25)).toBe("25.0 ac");
  });
});

describe("units — numeric conversions", () => {
  it("mmToIn: 25.4 mm = 1 inch", () => {
    expect(mmToIn(25.4)).toBeCloseTo(1, 6);
  });
  it("mmToIn: 708.7 mm ≈ 27.9 in (the screenshot bug reference)", () => {
    expect(mmToIn(708.7)).toBeCloseTo(27.9, 1);
  });
  it("cmToIn: 2.54 cm = 1 inch", () => {
    expect(cmToIn(2.54)).toBeCloseTo(1, 6);
  });
  it("mToFt: 1 m = 3.28084 ft", () => {
    expect(mToFt(1)).toBeCloseTo(3.28084, 5);
  });
  it("kmToMi: 1 km = 0.621371 mi", () => {
    expect(kmToMi(1)).toBeCloseTo(0.621371, 6);
  });
  it("mToMi: 1609.344 m ≈ 1 mi", () => {
    expect(mToMi(1609.344)).toBeCloseTo(1, 4);
  });
  it("m2ToAcres: 4046.86 m² ≈ 1 acre", () => {
    expect(m2ToAcres(4046.86)).toBeCloseTo(1, 3);
  });
  it("km2ToAcres: 1 km² = 247.105 acres", () => {
    expect(km2ToAcres(1)).toBeCloseTo(247.105, 3);
  });
  it("gToLb: 453.592 g = 1 lb", () => {
    expect(gToLb(453.592)).toBeCloseTo(1, 6);
  });
  it("kgToLb: 1 kg = 2.20462 lb", () => {
    expect(kgToLb(1)).toBeCloseTo(2.20462, 5);
  });
  it("ozToLb: 16 oz = 1 lb", () => {
    expect(ozToLb(16)).toBeCloseTo(1, 6);
  });
  it("cToF: 0°C = 32°F, 100°C = 212°F", () => {
    expect(cToF(0)).toBe(32);
    expect(cToF(100)).toBe(212);
  });
  it("mpsToMph: 1 m/s ≈ 2.23694 mph", () => {
    expect(mpsToMph(1)).toBeCloseTo(2.23694, 5);
  });
  it("cmsToCfs: 1 m³/s ≈ 35.31 ft³/s", () => {
    expect(cmsToCfs(1)).toBeCloseTo(35.3147, 4);
  });
});

describe("units — detectLengthUnit heuristic", () => {
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });
  it("trusts a plausible 'in' claim", () => {
    expect(detectLengthUnit(20, "in")).toBe("in");
  });
  it("trusts an 'inches' claim near the threshold", () => {
    expect(detectLengthUnit(60, "inches")).toBe("in");
  });
  it("distrusts an implausible 'in' claim (the size-distribution bug case)", () => {
    expect(detectLengthUnit(708.7, "in")).toBe("mm");
    expect(detectLengthUnit(500.4, "IN")).toBe("mm");
  });
  it("defaults to mm when units is missing", () => {
    expect(detectLengthUnit(300, null)).toBe("mm");
    expect(detectLengthUnit(300, undefined)).toBe("mm");
    expect(detectLengthUnit(300, "")).toBe("mm");
  });
  it("recognizes cm", () => {
    expect(detectLengthUnit(45, "cm")).toBe("cm");
  });
});

describe("units — lengthToMm normalization", () => {
  it("passes mm through", () => {
    expect(lengthToMm(708.7, "mm")).toBe(708.7);
  });
  it("converts inches when plausible", () => {
    expect(lengthToMm(20, "in")).toBeCloseTo(508, 1);
  });
  it("rejects implausible inches and treats as mm (regression)", () => {
    // The exact case from the broken chart: Brown Trout maxLength 708.7
    // with LENUNITS="in" must not become 18,000 mm.
    expect(lengthToMm(708.7, "in")).toBe(708.7);
  });
  it("converts cm", () => {
    expect(lengthToMm(45, "cm")).toBe(450);
  });
});

describe("units — lengthToMmForSpecies species-aware guard", () => {
  it("flips small-fish values to mm when inches would yield an absurd length", () => {
    // The Mottled Sculpin case from the size-distribution chart: a raw
    // value of 73.7 with LENUNITS="in" slips under the generic 80-inch
    // guard, but 1872 mm of sculpin is impossible. Species cap kicks in.
    expect(lengthToMmForSpecies(73.7, "in", 200)).toBe(73.7);
  });
  it("keeps plausible inches when species cap allows", () => {
    // Lake Trout max 23.1" → 587 mm, well under the 1520 mm species cap.
    expect(lengthToMmForSpecies(23.1, "in", 1520)).toBeCloseTo(586.74, 1);
  });
  it("degrades to lengthToMm when species is unknown", () => {
    expect(lengthToMmForSpecies(73.7, "in", null)).toBeCloseTo(1872, 0);
  });
  it("passes mm values through unchanged regardless of species cap", () => {
    expect(lengthToMmForSpecies(150, "mm", 200)).toBe(150);
  });
  it("does not flip when the raw value is itself larger than the species cap", () => {
    // A raw value of 79 with LENUNITS="in" and a 50 mm species cap: the
    // value alone exceeds the cap, so reinterpreting as mm wouldn't save
    // the row. Honor the inches claim and let downstream sanity-bounds
    // collapse the absurdity.
    expect(lengthToMmForSpecies(79, "in", 50)).toBeCloseTo(2006.6, 1);
  });
});

describe("units — weightToGrams normalization", () => {
  it("passes g through", () => {
    expect(weightToGrams(500, "g")).toBe(500);
  });
  it("converts kg", () => {
    expect(weightToGrams(2, "kg")).toBe(2000);
  });
  it("converts lb", () => {
    expect(weightToGrams(1, "lb")).toBeCloseTo(453.592, 3);
  });
  it("converts oz", () => {
    expect(weightToGrams(16, "oz")).toBeCloseTo(453.592, 3);
  });
});

describe("units — formatters", () => {
  it("formatInches renders the fix for the chart bug", () => {
    expect(formatInches(708.7)).toBe("27.9″");
  });
  it("formatInches honors precision", () => {
    expect(formatInches(500.4, { precision: 0 })).toBe("20″");
  });
  it("formatInchRange shows both bounds", () => {
    expect(formatInchRange(125, 708.7)).toBe("4.9–27.9″");
  });
  it("formatInchRange collapses missing min to ≤ max", () => {
    expect(formatInchRange(null, 500)).toBe("≤ 19.7″");
    expect(formatInchRange(0, 500)).toBe("≤ 19.7″");
  });
  it("formatPounds: 453.592 g → '1.0 lb'", () => {
    expect(formatPounds(453.592)).toBe("1.0 lb");
  });
  it("formatFeet from meters", () => {
    expect(formatFeet(1000)).toBe("3,281 ft");
  });
  it("formatFeetFromFeet passes through", () => {
    expect(formatFeetFromFeet(7452)).toBe("7,452 ft");
  });
  it("formatMiles from meters", () => {
    expect(formatMiles(1609.344)).toBe("1.0 mi");
  });
  it("formatAcres from m²", () => {
    expect(formatAcres(4046.86 * 1000)).toBe("1,000 ac");
  });
  it("formatCfs rounds + groups", () => {
    expect(formatCfs(8275.2)).toBe("8,275 cfs");
  });
  it("formatFahrenheit from °C", () => {
    expect(formatFahrenheit(0)).toBe("32°F");
    expect(formatFahrenheit(20.5, { precision: 1 })).toBe("68.9°F");
  });
  it("formatMph from m/s and mph", () => {
    expect(formatMph(10)).toBe("22 mph");
    expect(formatMphFromMph(15.7)).toBe("16 mph");
  });
  it("formatInHg passes through with 2 decimals", () => {
    expect(formatInHg(29.92)).toBe("29.92 inHg");
  });
  it("every formatter returns em-dash for null/NaN/undefined", () => {
    expect(formatInches(null)).toBe("—");
    expect(formatPounds(undefined)).toBe("—");
    expect(formatFeet(NaN)).toBe("—");
    expect(formatMiles(null)).toBe("—");
    expect(formatAcres(null)).toBe("—");
    expect(formatCfs(null)).toBe("—");
    expect(formatFahrenheit(null)).toBe("—");
  });
});
