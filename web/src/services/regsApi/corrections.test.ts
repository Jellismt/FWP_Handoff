/**
 * @file corrections.test.ts
 * @module engage-mt/services/regsApi
 * @description District parsing and the served-version split.
 * @author Jamie Ellis / Engage MT
 * @created 2026-09-06
 * @updated 2026-09-06
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { describe, expect, it } from "vitest";
import { affectsDistrict, splitCorrections, type RegsCorrection } from "./corrections";

const c = (version: number, districts: string | null = null): RegsCorrection => ({
  version,
  published_at: `2026-0${version}-01T00:00:00Z`,
  summary: `v${version}`,
  affected_species: null,
  affected_districts: districts,
  note: null,
});

describe("corrections", () => {
  it("matches districts by code and treats an empty scope as statewide", () => {
    expect(affectsDistrict(c(2, "HD 380, 410"), "380")).toBe(true);
    expect(affectsDistrict(c(2, "380"), "410")).toBe(false);
    expect(affectsDistrict(c(2, null), "999")).toBe(true);
  });

  it("splits corrections around the served version, newest first", () => {
    const split = splitCorrections([c(2), c(4), c(3)], 3);
    expect(split.missing.map((x) => x.version)).toEqual([4]);
    expect(split.included.map((x) => x.version)).toEqual([3, 2]);
  });

  it("claims nothing is missing when the served version is unknown", () => {
    const split = splitCorrections([c(2), c(3)], null);
    expect(split.missing).toEqual([]);
    expect(split.included).toHaveLength(2);
  });
});
