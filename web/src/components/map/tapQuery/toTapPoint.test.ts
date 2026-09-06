/**
 * @file toTapPoint.test.ts
 * @module engage-mt/map
 * @description Unit tests for the pure Esri Point → TapPoint reducer.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-29
 * @updated 2026-06-29
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { describe, it, expect } from "vitest";
import { toTapPoint } from "./toTapPoint";

describe("toTapPoint", () => {
  it("returns null for a null or undefined point", () => {
    expect(toTapPoint(null)).toBeNull();
    expect(toTapPoint(undefined)).toBeNull();
  });

  it("returns null when latitude or longitude is missing", () => {
    const noLat = { x: 1, y: 2, latitude: null, longitude: -110 } as unknown as __esri.Point;
    const noLon = { x: 1, y: 2, latitude: 46, longitude: null } as unknown as __esri.Point;
    expect(toTapPoint(noLat)).toBeNull();
    expect(toTapPoint(noLon)).toBeNull();
  });

  it("strips an Esri point down to the plain TapPoint shape", () => {
    const mp = {
      x: -12286000,
      y: 5916000,
      latitude: 46.8797,
      longitude: -110.3626,
      spatialReference: { wkid: 102100 },
    } as unknown as __esri.Point;
    expect(toTapPoint(mp)).toEqual({
      x: -12286000,
      y: 5916000,
      latitude: 46.8797,
      longitude: -110.3626,
      spatialReferenceWkid: 102100,
    });
  });

  it("defaults the wkid to undefined when no spatial reference is present", () => {
    const mp = {
      x: 1,
      y: 2,
      latitude: 46,
      longitude: -110,
    } as unknown as __esri.Point;
    expect(toTapPoint(mp)?.spatialReferenceWkid).toBeUndefined();
  });

  it("produces a plain object with no Esri prototype", () => {
    const mp = {
      x: 1,
      y: 2,
      latitude: 46,
      longitude: -110,
      spatialReference: { wkid: 4326 },
    } as unknown as __esri.Point;
    const result = toTapPoint(mp);
    expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
  });
});
