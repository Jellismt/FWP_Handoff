/**
 * @file conformance.test.ts
 * @module engage-mt/shared
 * @description Contract guard: the shared `NormalizedRegulation` MUST stay assignable
 *              to the web app's `NormalizedRegulation` (web/src/services/hunt/regsTypes.ts).
 *              If the web shape changes, this test fails to compile — the tripwire that
 *              keeps the cutover seam honest. Type-level assertions + a zod round-trip.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-03
 * @updated 2026-07-03
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { describe, it, expect } from "vitest";
import { normalizedRegulationSchema, type NormalizedRegulation } from "./normalizedRegulation.js";
import type { NormalizedRegulation as WebNormalizedRegulation } from "../../web/src/services/hunt/regsTypes";

/** Compile-time: each shape must be assignable to the other (structural identity). */
type AssertAssignable<A extends B, B> = true;
// If these lines fail to compile, the server contract has drifted from the web app.
const _sharedToWeb: AssertAssignable<NormalizedRegulation, WebNormalizedRegulation> = true;
const _webToShared: AssertAssignable<WebNormalizedRegulation, NormalizedRegulation> = true;
void _sharedToWeb;
void _webToShared;

describe("NormalizedRegulation contract", () => {
  it("accepts a well-formed row and infers the web-compatible shape", () => {
    const row: NormalizedRegulation = {
      rule_id: "deer:hd:210:210-00:1",
      species: "deer",
      species_group: "dea",
      geography_type: "hd",
      geography_id: "210",
      region: 2,
      district_name: "John Long Range",
      legal_animal: "Antlerless White-tailed Deer",
      required_license: "Deer B License: 210-00",
      is_draw: true,
      weapon_windows: [{ weapon: "General", range: "Oct 25-Nov 30" }],
      quota: 75,
      apply_by_date: "Jun 01",
      opportunity_specific: null,
      effective_date: "2025-03-01",
      expires_date: "2026-02-28",
      source_reg_id: "dea-2025",
    };
    const parsed = normalizedRegulationSchema.parse(row);
    expect(parsed).toEqual(row);
    // Structural: a shared row is usable where the web type is expected.
    const asWeb: WebNormalizedRegulation = parsed;
    expect(asWeb.rule_id).toBe(row.rule_id);
  });
});
