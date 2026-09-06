/**
 * @file regionContacts.test.ts
 * @module engage-mt/services/hunt
 * @description Coverage for the FWP regional
 *              contacts table. Invariants on the dataset (7 regions,
 *              monotonic numbering, valid tel hrefs, in-bounds Montana
 *              coordinates) + the resolveRegionContact lookup.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-06
 * @updated 2026-06-10
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { describe, it, expect } from "vitest";
import { FWP_REGIONS, resolveRegionContact } from "./regionContacts";

describe("FWP_REGIONS dataset invariants", () => {
  it("contains exactly 7 regions (R1..R7)", () => {
    expect(FWP_REGIONS.length).toBe(7);
    expect(FWP_REGIONS.map((r) => r.region)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("every region has a non-empty name/city/address/phone/url", () => {
    for (const r of FWP_REGIONS) {
      expect(r.name).toBeTruthy();
      expect(r.city).toBeTruthy();
      expect(r.address).toBeTruthy();
      expect(r.phone).toBeTruthy();
      expect(r.url).toMatch(/^https:\/\/fwp\.mt\.gov\//);
    }
  });

  it("phoneHref is a valid tel: URI matching the phone digits", () => {
    for (const r of FWP_REGIONS) {
      expect(r.phoneHref).toMatch(/^tel:\+1\d{10}$/);
      const digits = r.phone.replace(/\D/g, "");
      expect(r.phoneHref).toContain(digits);
    }
  });

  it("region centroids fall inside Montana's lat/lon bounding box", () => {
    for (const r of FWP_REGIONS) {
      // Montana lat range ~44.3° to 49.0°, lon range ~-116.1° to -104.0°.
      expect(r.centroid.lat).toBeGreaterThan(44);
      expect(r.centroid.lat).toBeLessThan(49.5);
      expect(r.centroid.lon).toBeGreaterThan(-116.5);
      expect(r.centroid.lon).toBeLessThan(-103.5);
    }
  });
});

describe("resolveRegionContact", () => {
  it.each([1, 2, 3, 4, 5, 6, 7])("resolves numeric region %s", (n) => {
    expect(resolveRegionContact(n)?.region).toBe(n);
  });

  it("resolves a numeric-string region", () => {
    expect(resolveRegionContact("3")?.city).toBe("Bozeman");
  });

  it.each([null, undefined])("returns null for %s", (v) => {
    expect(resolveRegionContact(v)).toBeNull();
  });

  it("returns null for out-of-range numbers", () => {
    expect(resolveRegionContact(0)).toBeNull();
    expect(resolveRegionContact(8)).toBeNull();
    expect(resolveRegionContact(-1)).toBeNull();
  });

  it("returns null for non-numeric strings", () => {
    expect(resolveRegionContact("Bozeman")).toBeNull();
    expect(resolveRegionContact("")).toBeNull();
  });
});
