/**
 * @file arcgisLayers.test.ts
 * @module engage-mt/shared
 * @description Invariants for the canonical FWP ESRI layer registry — the single
 *              source of truth the server seed/ETL and the web layer registry both
 *              depend on. Guards the shape so a bad edit fails the suite, not seeding.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-05
 * @updated 2026-07-05
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { describe, it, expect } from "vitest";
import {
  ARCGIS_HD_LAYERS,
  ARCGIS_DISTRICT_LAYERS,
  ARCGIS_HUNTING_DISTRICTS_SERVICE,
  arcgisLayerUrl,
  arcgisLayerByKey,
} from "./arcgisLayers.js";

const KINDS = new Set(["district", "portion", "restricted_area"]);

describe("ARCGIS_HD_LAYERS registry invariants", () => {
  it("has unique keys", () => {
    const keys = ARCGIS_HD_LAYERS.map((l) => l.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("has unique layer ids", () => {
    const ids = ARCGIS_HD_LAYERS.map((l) => l.layerId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("uses only the three known entity kinds", () => {
    for (const l of ARCGIS_HD_LAYERS) expect(KINDS.has(l.entityKind)).toBe(true);
  });

  it("gives every entry a non-empty display name + join key field", () => {
    for (const l of ARCGIS_HD_LAYERS) {
      expect(l.displayName.length).toBeGreaterThan(0);
      expect(l.keyField.length).toBeGreaterThan(0);
    }
  });

  it("ties every district layer to a geography code and every portion/restricted to none", () => {
    for (const l of ARCGIS_HD_LAYERS) {
      if (l.entityKind === "district") expect(l.geographyCode).toBeTruthy();
      else expect(l.geographyCode).toBeNull();
    }
  });

  it("maps each geography code to exactly one district layer", () => {
    const geos = ARCGIS_DISTRICT_LAYERS.map((l) => l.geographyCode);
    expect(new Set(geos).size).toBe(geos.length);
  });

  it("exposes district layers as the entityKind==district subset", () => {
    expect(ARCGIS_DISTRICT_LAYERS).toEqual(ARCGIS_HD_LAYERS.filter((l) => l.entityKind === "district"));
    expect(ARCGIS_DISTRICT_LAYERS.length).toBe(8);
  });
});

describe("registry helpers", () => {
  it("builds the layer URL from the service base + id", () => {
    const hd = arcgisLayerByKey("hd-district");
    expect(hd).toBeDefined();
    expect(arcgisLayerUrl(hd!)).toBe(`${ARCGIS_HUNTING_DISTRICTS_SERVICE}/${hd!.layerId}`);
  });

  it("resolves a known key and returns undefined for an unknown one", () => {
    expect(arcgisLayerByKey("hd-district")?.layerId).toBe(11);
    expect(arcgisLayerByKey("no-such-key")).toBeUndefined();
  });

  it("records the NAME-keyed exceptions (Mtn Lion + Upland districts)", () => {
    expect(arcgisLayerByKey("lion-mu")?.keyField).toBe("NAME");
    expect(arcgisLayerByKey("upland-district")?.keyField).toBe("NAME");
  });
});
