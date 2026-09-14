/**
 * @file deaParse.test.ts
 * @module engage-mt/server/etl
 * @description Unit tests for the pure DEA parsing helpers — no DB needed, so these
 *              run in CI everywhere. Cover the tricky bits: license parsing, the
 *              Nov→Feb season-year wrap, and restriction classification.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-03
 * @updated 2026-07-03
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { describe, it, expect } from "vitest";
import { parseInstrument, resolveRange, classifyRestriction, classCodeFor } from "./deaParse.js";

describe("parseInstrument", () => {
  it("parses a General license and splits the bled-in class label", () => {
    const p = parseInstrument("General Deer License Antlered Buck White-tailed Deer", "deer");
    expect(p?.instrTypeCode).toBe("GENERAL");
    expect(p?.instrCode).toBe("GEN-DEER");
    expect(p?.isDraw).toBe(false);
    expect(p?.trailingLabel).toBe("Antlered Buck White-tailed Deer");
  });

  it("parses a drawn B license with its NNN-NN code", () => {
    const p = parseInstrument("Deer B License: 210-00 Antlerless White-tailed Deer", "deer");
    expect(p?.instrTypeCode).toBe("B_LICENSE");
    // instr_code is species-namespaced (deer/elk reuse the same printed numbers); the printed
    // number stays verbatim in display_name.
    expect(p?.instrCode).toBe("D-210-00");
    expect(p?.displayName).toBe("Deer B License: 210-00");
  });

  it("namespaces deer vs elk B-license codes so identical printed numbers don't collide", () => {
    // Deer B 100-00 and Elk B 100-00 are DIFFERENT licenses sharing a printed number.
    const deer = parseInstrument("Deer B License: 100-00 Antlerless White-tailed Deer", "deer");
    const elk = parseInstrument("Elk B License: 100-00 Antlerless Elk", "elk");
    expect(deer?.instrCode).toBe("D-100-00");
    expect(elk?.instrCode).toBe("E-100-00");
    expect(deer?.instrCode).not.toBe(elk?.instrCode);
  });

  it("parses an Elk Permit as a draw", () => {
    const p = parseInstrument("Elk Permit: 217-10 Brow-tined Bull or Antlerless Elk", "elk");
    expect(p?.instrTypeCode).toBe("PERMIT");
    expect(p?.instrCode).toBe("E-217-10");
    expect(p?.isDraw).toBe(true);
  });

  it("returns null for an unrecognized license", () => {
    expect(parseInstrument("Some Nonsense", "deer")).toBeNull();
  });
});

describe("resolveRange (season-year wrap)", () => {
  it("keeps a fall range in the season year", () => {
    expect(resolveRange("Sep 05-Oct 18", 2026)).toEqual({ starts_on: "2026-09-05", ends_on: "2026-10-18" });
  });

  it("wraps a Dec→Jan late-season range into the next calendar year", () => {
    expect(resolveRange("Dec 01-Jan 15", 2026)).toEqual({ starts_on: "2026-12-01", ends_on: "2027-01-15" });
  });

  it("maps Jan/Feb-only ranges to season year + 1", () => {
    expect(resolveRange("Jan 01-Feb 28", 2026)).toEqual({ starts_on: "2027-01-01", ends_on: "2027-02-28" });
  });

  it("returns null for an unparseable range", () => {
    expect(resolveRange("-", 2026)).toBeNull();
  });

  // Guards the loadAntelope fix: resolveRange keys on a 3-letter month, so the antelope
  // constants must use "Sep" (not "Sept", which fails to parse and silently drops the window).
  it("resolves the antelope archery + statewide windows", () => {
    expect(resolveRange("Sep 05-Oct 09", 2026)).toEqual({ starts_on: "2026-09-05", ends_on: "2026-10-09" });
    expect(resolveRange("Aug 15-Nov 08", 2026)).toEqual({ starts_on: "2026-08-15", ends_on: "2026-11-08" });
  });
  it("returns null for the 4-letter 'Sept' token (the bug the fix avoids)", () => {
    expect(resolveRange("Sept 05-Oct 09", 2026)).toBeNull();
  });
});

describe("classifyRestriction", () => {
  it("extracts youth age band", () => {
    expect(classifyRestriction("Only youth ages 10-15.")).toEqual({ restrCode: "YOUTH_ONLY", valueText: "10-15" });
  });
  it("detects PTHFV, private land, archery", () => {
    expect(classifyRestriction("hunters with a PTHFV.").restrCode).toBe("PTHFV");
    expect(classifyRestriction("Only valid on private land.").restrCode).toBe("PRIVATE_LAND_ONLY");
    expect(classifyRestriction("ArchEquip only.").restrCode).toBe("ARCHERY_EQUIP_ONLY");
  });
  it("falls back to OTHER", () => {
    expect(classifyRestriction("Some bespoke rule.").restrCode).toBe("OTHER");
  });
});

describe("classCodeFor", () => {
  it("slugifies with WTD/MD abbreviations", () => {
    expect(classCodeFor("Antlerless White-tailed Deer")).toBe("ANTLERLESS_WTD_DEER");
    expect(classCodeFor("Either-sex")).toBe("EITHER_SEX");
  });
});
