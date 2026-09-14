/**
 * @file arcgisAttrs.test.ts
 * @module engage-mt/utils
 * @description Unit tests for the shared ArcGIS attribute narrowers. Pins the
 *              partial-data-tolerant coercions (null on missing/mistyped, not a
 *              throw) + the multi-key case-variant coalescing.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-01
 * @updated 2026-07-01
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { describe, it, expect } from "vitest";
import { asString, asNumber, asBoolean, attrStr, attrNum } from "@/utils/arcgisAttrs";

describe("asString", () => {
  it("trims non-empty strings", () => {
    expect(asString("  Madison River  ")).toBe("Madison River");
  });
  it("stringifies finite numbers (district ids arrive numeric)", () => {
    expect(asString(380)).toBe("380");
  });
  it("returns null for empty / whitespace / non-finite / non-string", () => {
    expect(asString("")).toBeNull();
    expect(asString("   ")).toBeNull();
    expect(asString(NaN)).toBeNull();
    expect(asString(null)).toBeNull();
    expect(asString(undefined)).toBeNull();
    expect(asString({})).toBeNull();
  });
});

describe("asNumber", () => {
  it("passes finite numbers through", () => {
    expect(asNumber(35181)).toBe(35181);
  });
  it("parses numeric strings", () => {
    expect(asNumber("44.7")).toBe(44.7);
  });
  it("returns null for NaN, empty, and non-numeric strings", () => {
    expect(asNumber(NaN)).toBeNull();
    expect(asNumber("")).toBeNull();
    expect(asNumber("abc")).toBeNull();
    expect(asNumber(null)).toBeNull();
  });
});

describe("asBoolean", () => {
  it("passes real booleans through", () => {
    expect(asBoolean(true)).toBe(true);
    expect(asBoolean(false)).toBe(false);
  });
  it("maps 0/1 and yes/no/true/false strings", () => {
    expect(asBoolean(1)).toBe(true);
    expect(asBoolean(0)).toBe(false);
    expect(asBoolean("Yes")).toBe(true);
    expect(asBoolean("NO")).toBe(false);
    expect(asBoolean("true")).toBe(true);
  });
  it("returns null for ambiguous values (distinguishes false from unknown)", () => {
    expect(asBoolean(2)).toBeNull();
    expect(asBoolean("maybe")).toBeNull();
    expect(asBoolean(null)).toBeNull();
  });
});

describe("attrStr", () => {
  const attrs = { NAME: "", Name: "  Holter Lake  ", name: "lower" };
  it("returns the first key that yields a non-empty string", () => {
    // NAME is empty → skip; Name wins (trimmed) before name.
    expect(attrStr(attrs, ["NAME", "Name", "name"])).toBe("Holter Lake");
  });
  it("uses the fallback when no key resolves", () => {
    expect(attrStr({ A: null, B: "" }, ["A", "B"], "Untitled feature")).toBe("Untitled feature");
  });
  it("defaults the fallback to an empty string", () => {
    expect(attrStr({}, ["X"])).toBe("");
  });
});

describe("attrNum", () => {
  it("returns the first key that yields a finite number", () => {
    expect(attrNum({ ACRES: "n/a", acres: "1200" }, ["ACRES", "acres"])).toBe(1200);
  });
  it("returns null when no key resolves", () => {
    expect(attrNum({ ACRES: "n/a" }, ["ACRES"])).toBeNull();
  });
});
