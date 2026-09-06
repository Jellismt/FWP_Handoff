/**
 * @file syncPortions.test.ts
 * @module engage-mt/server/etl
 * @description Pins the portion_code collision logic: the rare shared-SHAPECODE
 *              half-pairs (mdPt388 WRA/Outside, mdPt312 E/W) get deterministic `-n`
 *              suffixes ordered by PORTIONNAME so re-runs stay idempotent; singletons
 *              keep the bare SHAPECODE.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-14
 * @updated 2026-07-14
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { describe, it, expect } from "vitest";
import { assignPortionCodes } from "./syncPortions.js";

const feat = (DISTRICT: string, SHAPECODE: string, PORTIONNAME: string) => ({
  attributes: { DISTRICT, SHAPECODE, PORTIONNAME },
});

describe("assignPortionCodes", () => {
  it("keeps the bare SHAPECODE for a unique (district, shapecode)", () => {
    const m = assignPortionCodes([feat("314", "elPt5", "Portion of HD 314 South of Rock Creek")]);
    expect(m.get("Portion of HD 314 South of Rock Creek")).toBe("elPt5");
  });

  it("suffixes a shared-shapecode half-pair deterministically by name", () => {
    const m = assignPortionCodes([
      feat("388", "mdPt388", "Portion of HD 388 Weapons Restriction Area"),
      feat("388", "mdPt388", "Portion of HD 388 Outside Weapons Restriction Area"),
    ]);
    // "Outside…" sorts before "Weapons…" → first keeps bare code, second gets -2.
    expect(m.get("Portion of HD 388 Outside Weapons Restriction Area")).toBe("mdPt388");
    expect(m.get("Portion of HD 388 Weapons Restriction Area")).toBe("mdPt388-2");
  });

  it("is stable regardless of input order (idempotent re-runs)", () => {
    const a = assignPortionCodes([
      feat("312", "mdPt312", "Portion of HD 312 West of Springhill/Rocky Mtn Road"),
      feat("312", "mdPt312", "Portion of HD 312 East of Springhill/Rocky Mtn Road"),
    ]);
    const b = assignPortionCodes([
      feat("312", "mdPt312", "Portion of HD 312 East of Springhill/Rocky Mtn Road"),
      feat("312", "mdPt312", "Portion of HD 312 West of Springhill/Rocky Mtn Road"),
    ]);
    expect(a).toEqual(b);
    expect(a.get("Portion of HD 312 East of Springhill/Rocky Mtn Road")).toBe("mdPt312");
    expect(a.get("Portion of HD 312 West of Springhill/Rocky Mtn Road")).toBe("mdPt312-2");
  });

  it("skips features missing DISTRICT/SHAPECODE/PORTIONNAME", () => {
    const m = assignPortionCodes([feat("314", "elPt5", ""), { attributes: { DISTRICT: "314" } }]);
    expect(m.size).toBe(0);
  });
});
