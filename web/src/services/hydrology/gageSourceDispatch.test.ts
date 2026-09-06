/**
 * @file gageSourceDispatch.test.ts
 * @module engage-mt/services/hydrology
 * @description Coverage for the gage source dispatcher.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-14
 * @updated 2026-09-05
 * @version 2.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { describe, expect, it } from "vitest";
import { detectSource } from "@/services/hydrology/gageSourceDispatch";

describe("detectSource", () => {
  it("an explicit source stamp wins, case-insensitively", () => {
    expect(detectSource({ source: "usgs", LocationCode: "X" })).toBe("usgs");
    expect(detectSource({ source: "DNRC" })).toBe("dnrc");
  });

  it("routes a DNRC StAGE MapServer/0 feature by its LocationCode", () => {
    expect(detectSource({ LocationCode: "40A 10000", LocationName: "Big Hole R" })).toBe("dnrc");
  });

  it("defaults to USGS", () => {
    expect(detectSource({ site_no: "06054500" })).toBe("usgs");
  });
});
