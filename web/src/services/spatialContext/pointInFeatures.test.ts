/**
 * @file pointInFeatures.test.ts
 * @module engage-mt/services/spatialContext
 * @description Unit tests for the shared point-in-polygon primitive.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-14
 * @updated 2026-07-14
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { describe, it, expect } from "vitest";
import { pointInCachedFeatures, type RingFeature } from "./pointInFeatures";

// A 1×1 degree square around Bozeman-ish coords, [lon, lat] order.
const square = (name: string, minLon: number, minLat: number): RingFeature & { name: string } => ({
  name,
  rings: [
    [
      [minLon, minLat],
      [minLon + 1, minLat],
      [minLon + 1, minLat + 1],
      [minLon, minLat + 1],
      [minLon, minLat],
    ],
  ],
});

describe("pointInCachedFeatures", () => {
  it("returns the containing feature for a point inside", async () => {
    const features = [square("west", -112, 45), square("east", -110, 45)];
    const hit = await pointInCachedFeatures(-111.5, 45.5, features);
    expect(hit?.name).toBe("west");
  });

  it("returns null when the point is outside every feature", async () => {
    const features = [square("west", -112, 45)];
    const hit = await pointInCachedFeatures(-100, 30, features);
    expect(hit).toBeNull();
  });

  it("returns the first match when features overlap", async () => {
    const features = [square("a", -112, 45), square("b", -111.5, 45.5)];
    // Point falls inside both; first in array wins.
    const hit = await pointInCachedFeatures(-111.4, 45.6, features);
    expect(hit?.name).toBe("a");
  });

  it("skips features with empty rings", async () => {
    const features: Array<RingFeature & { name: string }> = [
      { name: "empty", rings: [] },
      square("real", -112, 45),
    ];
    const hit = await pointInCachedFeatures(-111.5, 45.5, features);
    expect(hit?.name).toBe("real");
  });

  it("returns null for an empty feature list", async () => {
    const hit = await pointInCachedFeatures(-111.5, 45.5, []);
    expect(hit).toBeNull();
  });
});
