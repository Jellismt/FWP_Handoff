/**
 * @file weaponRestriction.test.ts
 * @module engage-mt/services/public
 * @description Unit coverage for the weapon-restriction / big-game restricted
 *              area resolver. The live FWP MapServer query is mocked at the
 *              queryAtPoint seam; tests assert the attribute → RestrictedArea
 *              mapping and the null-tolerance contract.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-08
 * @updated 2026-07-08
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

import { resolveWeaponRestrictionAtPoint, restrictedAreaFromAttrs } from "./weaponRestriction";

describe("restrictedAreaFromAttrs", () => {
  it("maps the FWP service attributes into a RestrictedArea", () => {
    expect(
      restrictedAreaFromAttrs({
        PORTIONNAME: "Gallatin Valley Weapons Restriction Area",
        COMMENTS: "Weapon Restrictions see regulations.",
        REG: "3",
      }),
    ).toEqual({
      portionName: "Gallatin Valley Weapons Restriction Area",
      comments: "Weapon Restrictions see regulations.",
      region: "3",
    });
  });

  it("null-fills a missing COMMENTS field (comment is optional)", () => {
    const a = restrictedAreaFromAttrs({ PORTIONNAME: "Deckard Flats to Trail Creek", REG: "3" });
    expect(a?.portionName).toBe("Deckard Flats to Trail Creek");
    expect(a?.comments).toBeNull();
  });

  it("returns null when there is no usable area name (drops the row)", () => {
    expect(restrictedAreaFromAttrs({ COMMENTS: "Closed to hunting.", REG: "3" })).toBeNull();
  });
});

describe("resolveWeaponRestrictionAtPoint", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns null when the tap falls outside every restricted polygon", async () => {
    h.queryAttributesAtPoint.mockResolvedValue(null);
    expect(await resolveWeaponRestrictionAtPoint({ latitude: 46, longitude: -111 })).toBeNull();
  });

  it("resolves the covering restricted area's name + verbatim comment", async () => {
    h.queryAttributesAtPoint.mockResolvedValue({
      PORTIONNAME: "Townsend Weapons Restriction Area",
      COMMENTS: "Weapon Restrictions see regulations.",
      REG: "3",
    });
    const area = await resolveWeaponRestrictionAtPoint({ latitude: 46.3, longitude: -111.5 });
    expect(area).toMatchObject({
      portionName: "Townsend Weapons Restriction Area",
      comments: "Weapon Restrictions see regulations.",
    });
  });
});
