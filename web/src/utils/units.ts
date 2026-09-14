/**
 * @file units.ts
 * @module engage-mt/utils
 * @description Canonical unit conversions and imperial display formatters
 *              for Engage MT. Internal storage stays SI where the upstream
 *              data ships SI (fish lengths in mm, weights in g, water temp
 *              in °C); every value the user sees is imperial (inches,
 *              pounds, feet, miles, acres, cfs, °F, mph, inHg).
 *
 *              Components MUST NOT inline conversion factors. The literal
 *              25.4 / 453.592 / 1.8 etc. only appear in this file. A
 *              stylelint / grep guard in CI bans " mm", " cm", " kg",
 *              "°C", "m/s" in component JSX so a regression that tries
 *              to print a metric value to the UI is caught at PR time.
 *
 *              Return types of the `format*` functions are branded so that
 *              "this is already a user-facing inches string" can't be
 *              re-formatted as feet by mistake. The brand is a phantom
 *              type — zero runtime cost.
 *
 *              When upstream attribution lies (an FWP MapServer shipping
 *              `LENUNITS="in"` against values that are
 *              actually mm), `detectLengthUnit` distrusts the claim if
 *              the magnitude is impossibly large for the claimed unit and
 *              falls back to mm — preventing the classic double-conversion
 *              bug where a mm value formatted as if it were inches.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-08
 * @updated 2026-07-07
 * @version 1.1.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { createLogger } from "./logger";

const log = createLogger("units");

// ── Branded display types ─────────────────────────────────────────────
// Phantom brands so a `Feet` string can't be accidentally fed into a
// formatter that expects `Inches`. Strip with `as string` if you really
// need to concatenate (e.g. logger output).

declare const __brand: unique symbol;
type Branded<T, B> = T & { readonly [__brand]: B };

export type Inches = Branded<string, "in">;
export type Pounds = Branded<string, "lb">;
export type Feet = Branded<string, "ft">;
export type Miles = Branded<string, "mi">;
export type Acres = Branded<string, "ac">;
export type Cfs = Branded<string, "cfs">;
export type Fahrenheit = Branded<string, "°F">;
export type Mph = Branded<string, "mph">;
export type InHg = Branded<string, "inHg">;

// ── Pure numeric conversions ──────────────────────────────────────────

/** Millimeters → inches. */
export const mmToIn = (mm: number): number => mm / 25.4;

/** Centimeters → inches. */
export const cmToIn = (cm: number): number => cm / 2.54;

/** Meters → feet. */
export const mToFt = (m: number): number => m * 3.28084;

/** Meters → miles. */
export const mToMi = (m: number): number => m * 0.000621371;

/** Meters → yards. */
const mToYd = (m: number): number => m * 1.0936133;

/** Kilometers → miles. */
export const kmToMi = (km: number): number => km * 0.621371;

/** Square meters → acres. */
export const m2ToAcres = (m2: number): number => m2 * 0.000247105;

/**
 * On-map measure label: yards under half a mile, miles
 * above. 880 yd = 0.5 mi exactly, so the unit flip lands on a round number in
 * both — hunters think in yards at stalk range and miles beyond.
 */
export const formatMeasureDistance = (meters: number): string => {
  const miles = mToMi(meters);
  if (miles < 0.5) return `${Math.round(mToYd(meters))} yd`;
  return `${miles.toFixed(2)} mi`;
};

/** On-map area label — acres, 2 decimals under 10 ac then 1. */
export const formatMeasureArea = (sqMeters: number): string => {
  const acres = m2ToAcres(sqMeters);
  return `${acres.toFixed(acres < 10 ? 2 : 1)} ac`;
};

/** Square kilometers → acres. */
export const km2ToAcres = (km2: number): number => km2 * 247.105;

/** Grams → pounds. */
export const gToLb = (g: number): number => g / 453.592;

/** Kilograms → pounds. */
export const kgToLb = (kg: number): number => kg * 2.20462;

/** Ounces → pounds. */
export const ozToLb = (oz: number): number => oz / 16;

/** Celsius → Fahrenheit. */
export const cToF = (c: number): number => c * 1.8 + 32;

/** Meters/second → miles/hour. */
export const mpsToMph = (mps: number): number => mps * 2.23694;

/** Cubic meters/second → cubic feet/second. */
export const cmsToCfs = (cms: number): number => cms * 35.3147;

const MM_PER_INCH = 25.4;
const GRAMS_PER_POUND = 453.592;

// ── Upstream-attribution heuristic ────────────────────────────────────

/**
 * Some FWP MapServer layers occasionally ship a `LENUNITS` field
 * whose value disagrees with the magnitude in `AVG_LENGTH` /
 * `MAX_LENGTH`. We've observed rows tagged `"in"` carrying values like
 * 708.7 (which would imply an 18 m fish if multiplied by 25.4). When the
 * claim is implausible, treat the value as mm — the dominant FWP
 * convention. A small console hint helps the data team chase the
 * upstream mislabeling without spamming the log.
 *
 * Thresholds match the largest fish documented in Montana waters with
 * generous headroom: 80 in (~2 m) is bigger than any plausible game
 * species (the standing IGFA all-tackle paddlefish record is ~62 in).
 */
const PLAUSIBLE_MAX_INCHES = 80;
const warned = new Set<string>();

export const detectLengthUnit = (
  value: number,
  claimedUnits: string | null | undefined,
): "mm" | "cm" | "in" => {
  const claim = (claimedUnits ?? "mm").toLowerCase().trim();
  if (claim === "in" || claim === "inch" || claim === "inches") {
    if (value > PLAUSIBLE_MAX_INCHES) {
      const key = `len:${claimedUnits}:${value > 1000 ? "huge" : "big"}`;
      if (!warned.has(key)) {
        warned.add(key);
        log.warn(
          `Upstream claimed LENUNITS="${claimedUnits}" but value ${value} ` +
            `exceeds plausible inches; treating as millimeters.`,
        );
      }
      return "mm";
    }
    return "in";
  }
  if (claim === "cm" || claim === "centimeter" || claim === "centimeters") return "cm";
  return "mm";
};

/** Normalize a length to millimeters using upstream-attribution heuristic. */
export const lengthToMm = (value: number, claimedUnits: string | null | undefined): number => {
  const u = detectLengthUnit(value, claimedUnits);
  if (u === "in") return value * MM_PER_INCH;
  if (u === "cm") return value * 10;
  return value;
};

/**
 * Species-aware length normalization. Same contract as `lengthToMm` plus
 * a species-cap second-pass: when the upstream claim is `"in"` and the
 * converted result (value × 25.4) exceeds a biologically plausible
 * maximum for the species, treat the raw value as mm instead. Catches
 * FWP rows that mislabel a 73.7 mm sculpin as `"in"` — `lengthToMm`
 * alone honors the claim because 73.7 falls under the generic
 * `PLAUSIBLE_MAX_INCHES = 80` ceiling.
 *
 * `bioMaxMm` is the species cap (mm). Callers pass `null` for unknown
 * species, in which case this degrades gracefully to `lengthToMm`.
 */
export const lengthToMmForSpecies = (
  value: number,
  claimedUnits: string | null | undefined,
  bioMaxMm: number | null,
): number => {
  const baseline = lengthToMm(value, claimedUnits);
  if (bioMaxMm === null || !Number.isFinite(bioMaxMm) || bioMaxMm <= 0) return baseline;
  // If the inches interpretation produced an impossibly big fish but the
  // raw value would be plausible as mm, the upstream `LENUNITS` is wrong.
  if (baseline > bioMaxMm && value <= bioMaxMm) return value;
  return baseline;
};

/**
 * Largest plausible single-fish weight in Montana waters. Paddlefish
 * (Montana state record ≈ 142 lb) is the absolute outlier; for AVG
 * weights pulled from electrofishing / gill-net surveys the realistic
 * cap is closer to 50 lb. We pick 200 lb as the absurdity threshold to
 * stay well clear of legitimate paddlefish without honoring obviously
 * mislabeled rows where the value is actually grams.
 */
const PLAUSIBLE_MAX_POUNDS = 200;

/**
 * Normalize a weight to grams. Uses the same upstream-attribution
 * heuristic as `detectLengthUnit`: when the FWP service ships
 * `WEIGHTUNITS="lb"` but the magnitude implies an absurd fish (e.g. a
 * "376 lb" walleye that's actually 376 g), treat the raw value as grams
 * instead. A single console hint per (units, magnitude class) helps the
 * data team chase the upstream mislabeling without spamming the log.
 */
export const weightToGrams = (value: number, claimedUnits: string | null | undefined): number => {
  const u = (claimedUnits ?? "g").toLowerCase().trim();
  if (u === "kg" || u === "kilogram" || u === "kilograms") return value * 1000;
  if (u === "lb" || u === "lbs" || u === "pound" || u === "pounds") {
    if (value > PLAUSIBLE_MAX_POUNDS) {
      const key = `wt:${claimedUnits}:${value > 5000 ? "huge" : "big"}`;
      if (!warned.has(key)) {
        warned.add(key);
        log.warn(
          `Upstream claimed WEIGHTUNITS="${claimedUnits}" but value ${value} ` +
            `exceeds plausible pounds; treating as grams.`,
        );
      }
      return value;
    }
    return value * GRAMS_PER_POUND;
  }
  if (u === "oz" || u === "ounce" || u === "ounces") return value * 28.3495;
  return value;
};

// ── Imperial display formatters (branded return types) ────────────────

type FormatOpts = { precision?: number };

const isFiniteNumber = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);

/** Inches with single decimal by default. `formatInches(708.7) → "27.9″"` */
export const formatInches = (mm: number | null | undefined, opts: FormatOpts = {}): Inches => {
  if (!isFiniteNumber(mm)) return "—" as Inches;
  const p = opts.precision ?? 1;
  return `${mmToIn(mm).toFixed(p)}″` as Inches;
};

/** Inch range. Hides the lower bound if 0 or null. */
export const formatInchRange = (
  minMm: number | null | undefined,
  maxMm: number,
  opts: FormatOpts = {},
): Inches => {
  if (!isFiniteNumber(maxMm)) return "—" as Inches;
  const p = opts.precision ?? 1;
  const hi = mmToIn(maxMm).toFixed(p);
  if (!isFiniteNumber(minMm) || minMm <= 0) return `≤ ${hi}″` as Inches;
  const lo = mmToIn(minMm).toFixed(p);
  return `${lo}–${hi}″` as Inches;
};

/** Pounds with single decimal by default. */
export const formatPounds = (grams: number | null | undefined, opts: FormatOpts = {}): Pounds => {
  if (!isFiniteNumber(grams)) return "—" as Pounds;
  const p = opts.precision ?? 1;
  return `${gToLb(grams).toFixed(p)} lb` as Pounds;
};

/** Feet, no decimals. `formatFeet(1500) → "4,921 ft"` */
export const formatFeet = (meters: number | null | undefined): Feet => {
  if (!isFiniteNumber(meters)) return "—" as Feet;
  return `${Math.round(mToFt(meters)).toLocaleString()} ft` as Feet;
};

/** Elevation feet input. Useful when the source already ships feet. */
export const formatFeetFromFeet = (ft: number | null | undefined): Feet => {
  if (!isFiniteNumber(ft)) return "—" as Feet;
  return `${Math.round(ft).toLocaleString()} ft` as Feet;
};

/** Miles. */
export const formatMiles = (meters: number | null | undefined, opts: FormatOpts = {}): Miles => {
  if (!isFiniteNumber(meters)) return "—" as Miles;
  const p = opts.precision ?? 1;
  const mi = mToMi(meters);
  return `${mi.toFixed(p)} mi` as Miles;
};

/** Acres, with locale grouping above 1000. */
export const formatAcres = (m2: number | null | undefined): Acres => {
  if (!isFiniteNumber(m2)) return "—" as Acres;
  const ac = m2ToAcres(m2);
  return `${Math.round(ac).toLocaleString()} ac` as Acres;
};

/** cfs — input already in cfs (USGS native). */
export const formatCfs = (cfs: number | null | undefined): Cfs => {
  if (!isFiniteNumber(cfs)) return "—" as Cfs;
  return `${Math.round(cfs).toLocaleString()} cfs` as Cfs;
};

/** °F from °C. */
export const formatFahrenheit = (
  c: number | null | undefined,
  opts: FormatOpts = {},
): Fahrenheit => {
  if (!isFiniteNumber(c)) return "—" as Fahrenheit;
  const p = opts.precision ?? 0;
  return `${cToF(c).toFixed(p)}°F` as Fahrenheit;
};

/** mph. Input meters/second. */
export const formatMph = (mps: number | null | undefined): Mph => {
  if (!isFiniteNumber(mps)) return "—" as Mph;
  return `${Math.round(mpsToMph(mps))} mph` as Mph;
};

/** mph. Input already in mph (NWS native). */
export const formatMphFromMph = (mph: number | null | undefined): Mph => {
  if (!isFiniteNumber(mph)) return "—" as Mph;
  return `${Math.round(mph)} mph` as Mph;
};

/** inHg — input already inHg (NWS native). */
export const formatInHg = (inHg: number | null | undefined, opts: FormatOpts = {}): InHg => {
  if (!isFiniteNumber(inHg)) return "—" as InHg;
  const p = opts.precision ?? 2;
  return `${inHg.toFixed(p)} inHg` as InHg;
};
