/**
 * @file year.test.ts
 * @module engage-mt/services/regsApi
 * @description Unit tests for the regs season-year helpers.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-14
 * @updated 2026-07-14
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { describe, it, expect } from "vitest";
import { currentRegsYear, seasonWindow } from "./year";

describe("currentRegsYear", () => {
  // Local-time constructors (currentRegsYear reads getMonth(), which is local).
  it("uses the calendar year Mar–Dec", () => {
    expect(currentRegsYear(new Date(2026, 6, 14))).toBe(2026); // Jul
    expect(currentRegsYear(new Date(2026, 2, 1))).toBe(2026); // Mar 1
  });
  it("uses the previous year in Jan/Feb (MT license year runs Mar–Feb)", () => {
    expect(currentRegsYear(new Date(2026, 0, 15))).toBe(2025); // Jan
    expect(currentRegsYear(new Date(2026, 1, 28))).toBe(2025); // Feb
  });
});

describe("seasonWindow", () => {
  it("returns Mar 1 → end of Feb next year", () => {
    expect(seasonWindow(2026)).toEqual({ effectiveDate: "2026-03-01", validUntil: "2027-02-28" });
  });
  it("uses Feb 29 when the following year is a leap year", () => {
    // 2028 is a leap year → the 2027 season runs through
    expect(seasonWindow(2027)).toEqual({ effectiveDate: "2027-03-01", validUntil: "2028-02-29" });
  });
  it("handles century non-leap rule (2100 is not a leap year)", () => {
    expect(seasonWindow(2099).validUntil).toBe("2100-02-28");
  });
});
