/**
 * @file plss.test.ts
 * @module engage-mt/services/spatialContext
 * @description Unit coverage for the PLSS TRS formatter + the
 *              lookup's null-tolerance. The live BLM CadNSDI query is mocked at
 *              the queryAtPoint seam.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-06
 * @updated 2026-07-07
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ queryAttributesAtPoint: vi.fn() }));
vi.mock("./queryAtPoint", () => ({ queryAttributesAtPoint: h.queryAttributesAtPoint }));

import { formatTrs, lookupPlssAtPoint } from "./plss";

describe("formatTrs", () => {
  it("formats township label + section into the canonical descriptor", () => {
    expect(formatTrs("10N 3W", "30")).toBe("T10N R3W Sec 30");
  });

  it("drops the section when absent", () => {
    expect(formatTrs("12S 8E", null)).toBe("T12S R8E");
  });

  it("returns the raw label when it doesn't parse into two tokens", () => {
    expect(formatTrs("weird", null)).toBe("Tweird");
  });
});

describe("lookupPlssAtPoint", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns null when the service reports no feature", async () => {
    h.queryAttributesAtPoint.mockResolvedValue(null);
    expect(await lookupPlssAtPoint(-111, 46)).toBeNull();
  });

  it("maps the BLM CadNSDI attributes into a PlssLocation", async () => {
    h.queryAttributesAtPoint.mockResolvedValue({
      TWNSHPLAB: "10N 3W",
      FRSTDIVLAB: "30",
      PRINMER: "Montana Meridian",
    });
    const res = await lookupPlssAtPoint(-112.03, 46.59);
    expect(res).toEqual({
      trs: "T10N R3W Sec 30",
      townshipLabel: "10N 3W",
      section: "30",
      meridian: "Montana Meridian",
    });
  });

  it("scopes the query to Montana", async () => {
    h.queryAttributesAtPoint.mockResolvedValue(null);
    await lookupPlssAtPoint(-111, 46);
    expect(h.queryAttributesAtPoint).toHaveBeenCalledWith(
      expect.objectContaining({ where: "STATEABBR='MT'" }),
    );
  });
});
