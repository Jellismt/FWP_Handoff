/**
 * @file PublicLandOwnershipHintCard.test.ts
 * @module engage-mt/map/featureCards
 * @description Coverage for the agency-string → hint
 *              resolver. Substring matching means an unintended change
 *              to the AGENCY_HINTS table (e.g., dropping "USFS" because
 *              someone adds "USFSREGION" earlier in the iteration) would
 *              silently route a click to the wrong hint. These tests
 *              lock the canonical agencies.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-02
 * @version 1.0.0
 * @updated 2026-07-03
 */

import { describe, expect, it } from "vitest";
import { resolveAgencyHint } from "@/components/map/featureCards/cards/PublicLandOwnershipHintCard";

describe("resolveAgencyHint", () => {
  it("returns null for null + empty input", () => {
    expect(resolveAgencyHint(null)).toBeNull();
    expect(resolveAgencyHint("")).toBeNull();
  });

  it("maps BLM to the BLM hint", () => {
    // Substring matching: the input must CONTAIN the agency code
    // (the resolver doesn't reverse-look-up full names). FWP / MSDI
    // attribute layers typically ship the short code, so a value of
    // "BLM" or "BLM-MT" hits cleanly; the full "Bureau of Land
    // Management" string does NOT (no literal "BLM" substring).
    expect(resolveAgencyHint("BLM")?.label).toMatch(/Bureau of Land/i);
    expect(resolveAgencyHint("BLM-MT")?.label).toMatch(/Bureau of Land/i);
  });

  it("maps USFS to the Forest Service hint", () => {
    expect(resolveAgencyHint("USFS")?.label).toMatch(/Forest Service/i);
    expect(resolveAgencyHint("USFS-Lolo")?.label).toMatch(/Forest Service/i);
  });

  it("maps USFW to the Fish & Wildlife hint", () => {
    expect(resolveAgencyHint("USFW")?.label).toMatch(/Fish & Wildlife/i);
  });

  it("maps NPS to the National Park hint", () => {
    expect(resolveAgencyHint("NPS")?.label).toMatch(/National Park/i);
  });

  it("maps STATE to the state-of-Montana hint", () => {
    expect(resolveAgencyHint("STATE")?.label).toMatch(/State of Montana/i);
    expect(resolveAgencyHint("MT STATE")?.label).toMatch(/State of Montana/i);
  });

  it("maps BOR to the Bureau of Reclamation hint", () => {
    expect(resolveAgencyHint("BOR")?.label).toMatch(/Reclamation/i);
  });

  it("maps COE to the Army Corps hint", () => {
    expect(resolveAgencyHint("COE")?.label).toMatch(/Army Corps/i);
  });

  it("maps TRIBAL to the Tribal land hint", () => {
    expect(resolveAgencyHint("TRIBAL")?.label).toMatch(/Tribal/i);
    expect(resolveAgencyHint("Tribal-NCheyenne")?.label).toMatch(/Tribal/i);
  });

  it("returns null for unmapped agencies", () => {
    expect(resolveAgencyHint("UNKNOWN")).toBeNull();
    expect(resolveAgencyHint("PRIVATE")).toBeNull();
  });

  it("is case-insensitive", () => {
    expect(resolveAgencyHint("blm")?.label).toMatch(/Bureau of Land/i);
    expect(resolveAgencyHint("usfs")?.label).toMatch(/Forest Service/i);
  });

  it("every hint carries a non-empty suggest line", () => {
    const agencies = ["BLM", "USFS", "USFW", "NPS", "STATE", "STL", "COE", "BOR", "TRIBAL"];
    for (const a of agencies) {
      const h = resolveAgencyHint(a);
      expect(h?.suggest, `suggest text for ${a}`).toBeTruthy();
      expect((h?.suggest ?? "").length).toBeGreaterThan(8);
    }
  });
});
