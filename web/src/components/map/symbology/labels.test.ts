/**
 * @file labels.test.ts
 * @module engage-mt/map/symbology
 * @description Coverage for the zoom-gated label classes — with a focus on the
 * District numbers use the real `DISTRICT` field (the
 *              prior `HUNT_DIST` never existed, so labels never rendered) and
 *              draw at the layer's own scale; cadastral parcels get empty-guarded
 *              OwnerName labels at a deep zoom gate; non-labeled layers return null.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-07
 * @updated 2026-07-07
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { describe, it, expect } from "vitest";
import { labelClassesFor } from "./labels";
import type { LayerDef } from "@/types/layers";

const def = (id: string): LayerDef => ({ id }) as unknown as LayerDef;

interface LabelClass {
  labelExpressionInfo: { expression: string };
  minScale: number;
  maxScale: number;
  deconflictionStrategy: string;
}

const firstClass = (id: string): LabelClass => {
  const classes = labelClassesFor(def(id));
  expect(classes).not.toBeNull();
  expect(classes!.length).toBeGreaterThan(0);
  return classes![0] as LabelClass;
};

describe("labelClassesFor — district numbers", () => {
  const districtLayers = [
    "hunting-districts",
    "hunting-districts-antelope",
    "hunting-districts-sheep",
    "hunting-districts-moose",
    "hunting-districts-goat",
    "hunting-districts-upland-bird",
    "hunting-districts-black-bear",
    "hunting-districts-mountain-lion",
  ];

  it.each(districtLayers)("%s labels on the real DISTRICT field", (id) => {
    const cls = firstClass(id);
    // The live FWP services expose DISTRICT, not HUNT_DIST — the old expression
    // silently produced zero labels.
    expect(cls.labelExpressionInfo.expression).toBe("$feature.DISTRICT");
    expect(cls.labelExpressionInfo.expression).not.toContain("HUNT_DIST");
  });

  it("shows district numbers from the layer's own draw scale (2.5M), not super-zoom", () => {
    expect(firstClass("hunting-districts").minScale).toBe(2_500_000);
  });
});

describe("labelClassesFor — cadastral owner names", () => {
  it("labels OwnerName with an empty guard at a deep zoom gate", () => {
    const cls = firstClass("mt-cadastral");
    expect(cls.labelExpressionInfo.expression).toContain("$feature.OwnerName");
    expect(cls.labelExpressionInfo.expression).toContain("IsEmpty");
    expect(cls.minScale).toBe(36_000);
    // Dense parcels must drop colliding labels rather than overlap.
    expect(cls.deconflictionStrategy).toBe("static");
  });
});

describe("labelClassesFor — unchanged behavior", () => {
  it("keeps stream / WMA labels at the super-zoom gate", () => {
    expect(firstClass("major-rivers").minScale).toBe(150_000);
    expect(firstClass("wildlife-management-areas").minScale).toBe(150_000);
  });

  it("returns null for layers that must never be labeled", () => {
    expect(labelClassesFor(def("fishing-access-sites"))).toBeNull();
    expect(labelClassesFor(def("some-random-layer"))).toBeNull();
  });
});
