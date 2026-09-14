/**
 * @file pathSegments.test.ts
 * @module engage-mt/services/field
 * @description Segment normalisation and path splitting.
 * @author Jamie Ellis / Engage MT
 * @created 2026-09-06
 * @updated 2026-09-06
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { describe, expect, it } from "vitest";
import { isSegmentStart, normalizeSegments, splitPath } from "./pathSegments";

describe("pathSegments", () => {
  it("normalises starts: always 0, sorted, unique, in range", () => {
    expect(normalizeSegments(5)).toEqual([0]);
    expect(normalizeSegments(5, [3, 1, 3, 0, 9, -1])).toEqual([0, 1, 3]);
  });

  it("splits a path at its segment starts", () => {
    const path = ["a", "b", "c", "d", "e"];
    expect(splitPath(path)).toEqual([["a", "b", "c", "d", "e"]]);
    expect(splitPath(path, [2, 4])).toEqual([["a", "b"], ["c", "d"], ["e"]]);
    expect(splitPath([], [2])).toEqual([[]]);
  });

  it("knows which links are gaps", () => {
    expect(isSegmentStart(2, [0, 2])).toBe(true);
    expect(isSegmentStart(1, [0, 2])).toBe(false);
    expect(isSegmentStart(0, [0])).toBe(false);
  });
});
