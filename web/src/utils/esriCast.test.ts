/**
 * @file esriCast.test.ts
 * @module engage-mt/utils
 * @description Unit tests for the ArcGIS SDK type-narrowing casts. They are
 *              identity functions at runtime, so the contract under test is
 *              simply: each returns its input unchanged (no copy, no mutation).
 *              Guards against a future refactor accidentally cloning the value.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-10
 * @updated 2026-06-10
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { describe, expect, it } from "vitest";
import {
  asFeatureReductionProps,
  asGeometryUnionArray,
  asPortalItem,
  asRendererProps,
  asSimpleFillSymbol,
} from "./esriCast";

describe("esriCast identity helpers", () => {
  it("asPortalItem wraps an id literal without copying", () => {
    const out = asPortalItem("abc123") as unknown as { id: string };
    expect(out.id).toBe("abc123");
  });

  it("asRendererProps returns the same object reference", () => {
    const cfg = { type: "simple" };
    expect(asRendererProps(cfg)).toBe(cfg);
  });

  it("asFeatureReductionProps returns the same object reference", () => {
    const cfg = { type: "cluster" };
    expect(asFeatureReductionProps(cfg)).toBe(cfg);
  });

  it("asGeometryUnionArray returns the same array reference", () => {
    const arr: never[] = [];
    expect(asGeometryUnionArray(arr as never)).toBe(arr);
  });

  it("asSimpleFillSymbol returns the same object reference", () => {
    const cfg = { type: "simple-fill" as const, color: [0, 0, 0] };
    expect(asSimpleFillSymbol(cfg)).toBe(cfg);
  });
});
