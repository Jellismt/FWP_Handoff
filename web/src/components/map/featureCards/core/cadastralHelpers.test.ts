/**
 * @file cadastralHelpers.test.ts
 * @module engage-mt/map/featureCards
 * @description Coverage for the parcel-classification
 *              predicates that drive CadastralCard's intent (public-
 *              vs-private warning, SRUL chip).
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-02
 * @version 1.0.0
 * @updated 2026-07-03
 */

import { describe, expect, it } from "vitest";
import {
  isPublicPropType,
  isStateTrust,
} from "@/components/map/featureCards/core/cadastralHelpers";

describe("isPublicPropType", () => {
  it("returns false for null", () => {
    expect(isPublicPropType(null)).toBe(false);
  });

  it("returns true for federal / state / county / city / municipal / public / exempt", () => {
    expect(isPublicPropType("Federal")).toBe(true);
    expect(isPublicPropType("State")).toBe(true);
    expect(isPublicPropType("County")).toBe(true);
    expect(isPublicPropType("City")).toBe(true);
    expect(isPublicPropType("Municipal")).toBe(true);
    expect(isPublicPropType("Public")).toBe(true);
    expect(isPublicPropType("Exempt")).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(isPublicPropType("FEDERAL")).toBe(true);
    expect(isPublicPropType("federal")).toBe(true);
    expect(isPublicPropType("Federal Land")).toBe(true);
  });

  it("returns false for private / agricultural / residential / industrial / commercial", () => {
    expect(isPublicPropType("Residential")).toBe(false);
    expect(isPublicPropType("Agricultural")).toBe(false);
    expect(isPublicPropType("Industrial")).toBe(false);
    expect(isPublicPropType("Commercial")).toBe(false);
    expect(isPublicPropType("Other")).toBe(false);
  });
});

describe("isStateTrust", () => {
  it("returns false when both inputs are null", () => {
    expect(isStateTrust(null, null)).toBe(false);
  });

  it("matches DNRC ownership", () => {
    expect(isStateTrust(null, "Montana DNRC")).toBe(true);
    expect(isStateTrust(null, "DNRC")).toBe(true);
    expect(isStateTrust("State", "DNRC Trust Lands")).toBe(true);
  });

  it("matches trust-land phrases regardless of casing", () => {
    expect(isStateTrust(null, "Trust Land")).toBe(true);
    expect(isStateTrust("Trust land", null)).toBe(true);
    expect(isStateTrust(null, "STATE TRUST")).toBe(true);
  });

  it("matches the 'State of Montana' canonical owner string", () => {
    expect(isStateTrust(null, "State of Montana")).toBe(true);
    expect(isStateTrust(null, "STATE OF MONTANA - TRUST LANDS")).toBe(true);
  });

  it("returns false for non-trust public land (USFS, BLM, NPS)", () => {
    expect(isStateTrust("Federal", "U.S. Forest Service")).toBe(false);
    expect(isStateTrust("Federal", "Bureau of Land Management")).toBe(false);
    expect(isStateTrust("Federal", "National Park Service")).toBe(false);
  });

  it("returns false for private owners", () => {
    expect(isStateTrust("Residential", "Jane Doe")).toBe(false);
    expect(isStateTrust("Agricultural", "ABC Ranch LLC")).toBe(false);
  });

  it("matches when only one of propType / ownerName carries the signal", () => {
    expect(isStateTrust("Trust Land", "Some County Treasurer")).toBe(true);
    expect(isStateTrust("Exempt", "DNRC Forestry Division")).toBe(true);
  });
});
