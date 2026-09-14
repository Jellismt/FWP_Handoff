/**
 * @file resolvePortion.test.ts
 * @module engage-mt/services/spatialContext
 * @description Unit coverage for the district-portion tap resolver. The four live
 *              FWP portion-layer queries are mocked at the queryAtPoint seam; tests
 *              assert the multi-layer collect (a point can be in several species'
 *              portions), the attribute→PortionHit mapping, and the never-reject
 *              null-tolerance contract.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-14
 * @updated 2026-07-14
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ queryAttributesAtPoint: vi.fn() }));
vi.mock("@/services/spatialContext/queryAtPoint", () => ({
  queryAttributesAtPoint: h.queryAttributesAtPoint,
}));

import { resolvePortionsAtPoint } from "./resolvePortion";

describe("resolvePortionsAtPoint", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns [] when the tap is outside every portion (all four layers miss)", async () => {
    h.queryAttributesAtPoint.mockResolvedValue(null);
    expect(await resolvePortionsAtPoint({ latitude: 46, longitude: -111 })).toEqual([]);
  });

  it("collects a hit from a matching species layer", async () => {
    h.queryAttributesAtPoint.mockImplementation(({ url }: { url: string }) =>
      url.endsWith("/14")
        ? Promise.resolve({
            DISTRICT: "314",
            SHAPECODE: "elPt5",
            PORTIONNAME: "Portion of HD 314 South of Rock Creek",
          })
        : Promise.resolve(null),
    );
    const hits = await resolvePortionsAtPoint({ latitude: 46.1, longitude: -113.2 });
    expect(hits).toEqual([
      { district: "314", shapecode: "elPt5", portionName: "Portion of HD 314 South of Rock Creek" },
    ]);
  });

  it("collects hits from multiple overlapping species layers", async () => {
    h.queryAttributesAtPoint.mockImplementation(({ url }: { url: string }) => {
      if (url.endsWith("/14"))
        return Promise.resolve({
          DISTRICT: "388",
          SHAPECODE: "elPt12",
          PORTIONNAME: "Portion of HD 388 Outside Weapons Restriction Area",
        });
      if (url.endsWith("/12"))
        return Promise.resolve({
          DISTRICT: "388",
          SHAPECODE: "mdPt388",
          PORTIONNAME: "Portion of HD 388 Weapons Restriction Area",
        });
      return Promise.resolve(null);
    });
    const hits = await resolvePortionsAtPoint({ latitude: 46.5, longitude: -112 });
    expect(hits.map((h2) => h2.shapecode).sort()).toEqual(["elPt12", "mdPt388"]);
  });

  it("drops a hit missing a required field, and never rejects on a layer error", async () => {
    h.queryAttributesAtPoint.mockImplementation(({ url }: { url: string }) => {
      if (url.endsWith("/13"))
        return Promise.resolve({ DISTRICT: "201", PORTIONNAME: "no shapecode" });
      if (url.endsWith("/12")) return Promise.reject(new Error("service down"));
      return Promise.resolve(null);
    });
    expect(await resolvePortionsAtPoint({ latitude: 47, longitude: -114 })).toEqual([]);
  });
});
