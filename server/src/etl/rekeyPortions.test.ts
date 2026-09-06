/**
 * @file rekeyPortions.test.ts
 * @module engage-mt/server/etl
 * @description Pins the high-precision portion matcher: positive phrase links, the
 *              polarity guard that refuses to link an "outside/not valid in X" note to the
 *              positive X polygon (spatial inversion → review), ambiguity → review, and
 *              short single-word cores ("South") linking only on an explicit phrase.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-14
 * @updated 2026-07-14
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { describe, it, expect } from "vitest";
import { normalize, portionCore, matchPortion, type PortionCandidate } from "./rekeyPortions.js";

const p = (portion_code: string, portion_name: string): PortionCandidate => ({ portion_id: portion_code, portion_code, portion_name });

describe("normalize / portionCore", () => {
  it("strips filler + the 'Portion of HD N' prefix", () => {
    expect(portionCore("Portion of HD 314 South of Rock Creek")).toBe("south rock creek");
    expect(normalize("Only valid south of Rock Creek.")).toBe("only valid south rock creek");
  });
});

describe("matchPortion", () => {
  const rockCreek = [p("elPt5", "Portion of HD 314 South of Rock Creek"), p("elPt6", "Portion of HD 314 North of Rock Creek")];

  it("links a positive phrase to the right half (disambiguates N vs S)", () => {
    const m = matchPortion("Only valid south of Rock Creek.", rockCreek);
    expect(m.status).toBe("link");
    expect(m.status === "link" && m.portion.portion_code).toBe("elPt5");
  });

  it("refuses to invert: 'outside the North Fisher Portion' → review, not a link", () => {
    const m = matchPortion("Only valid outside the North Fisher Portion, see legal description.", [p("mdPt103", "Portion of HD 103 North Fisher")]);
    expect(m.status).toBe("review");
    expect(m.status === "review" && m.reason).toBe("complement-no-polygon");
  });

  it("links a genuine complement when its own polygon exists", () => {
    const m = matchPortion("Only valid outside National Forest boundary.", [p("mdPt213", "Portion of HD 213 Outside of the National Forest Boundary")]);
    expect(m.status).toBe("link");
  });

  it("links a short single-word core only via an explicit phrase", () => {
    const m = matchPortion("Only valid on private lands in south portion of HD 293.", [p("elPt15", "Portion of HD 293 South")]);
    expect(m.status).toBe("link");
    expect(m.status === "link" && m.portion.portion_code).toBe("elPt15");
  });

  it("returns none when no core phrase is present", () => {
    expect(matchPortion("NOT valid on FWP WMAs or BLM lands.", rockCreek).status).toBe("none");
  });
});
