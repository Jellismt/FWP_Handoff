/**
 * @file agencyResolver.test.ts
 * @module engage-mt/map/featureCards
 * @description Table-driven tests for the agency
 *              classifier. Covers every agency precedence row + the
 *              empty/unmatched fallthrough cases.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-03
 * @updated 2026-07-03
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { describe, expect, it } from "vitest";
import {
  resolveAgency,
  resolveAgencyFromString,
} from "@/components/map/featureCards/core/agencyResolver";
import type { AgencyKey } from "@/components/map/featureCards/core/agencyResolver";

interface Case {
  owner: string | null;
  propType?: string | null;
  expect: AgencyKey | null;
  note?: string;
}

const CASES: readonly Case[] = [
  // FWP must beat USFWS — "Wildlife" appears in both.
  { owner: "MT FWP — Wildlife Management Area", expect: "FWP" },
  { owner: "Montana Fish, Wildlife & Parks", expect: "FWP" },
  { owner: "Department of Fish, Wildlife and Parks", expect: "FWP" },

  // BLM
  { owner: "BLM", expect: "BLM" },
  { owner: "Bureau of Land Management", expect: "BLM" },
  { owner: "USDOI BLM Lewistown FO", expect: "BLM" },

  // USFS
  { owner: "USDA Forest Service", expect: "USFS" },
  { owner: "U.S. Forest Service — Custer Gallatin NF", expect: "USFS" },
  { owner: "Helena National Forest", expect: "USFS" },
  { owner: "USFS", expect: "USFS" },

  // USFWS (must not match FWP)
  { owner: "U.S. Fish & Wildlife Service", expect: "USFWS" },
  { owner: "USFWS — Charles M. Russell NWR", expect: "USFWS" },
  { owner: "National Wildlife Refuge", expect: "USFWS" },

  // NPS
  { owner: "National Park Service", expect: "NPS" },
  { owner: "Yellowstone National Park", expect: "NPS" },
  { owner: "Glacier National Park", expect: "NPS" },

  // BOR
  { owner: "Bureau of Reclamation", expect: "BOR" },
  { owner: "USBR", expect: "BOR" },

  // USACE
  { owner: "U.S. Army Corps of Engineers", expect: "USACE" },
  { owner: "USACE Omaha District", expect: "USACE" },

  // DOD
  { owner: "Malmstrom Air Force Base", expect: "DOD" },
  { owner: "Department of Defense", expect: "DOD" },

  // DNRC / state trust (must beat MT_STATE)
  { owner: "State of Montana — DNRC Trust Land", expect: "DNRC" },
  { owner: "Montana DNRC", expect: "DNRC" },
  { owner: "Common Schools Trust", expect: "DNRC" },
  { owner: "School Trust", expect: "DNRC" },
  { owner: null, propType: "STATE TRUST LAND", expect: "DNRC" },

  // Generic state (no trust signal)
  { owner: "State of Montana", expect: "MT_STATE" },
  { owner: "Montana State Library", expect: "MT_STATE" },

  // University
  { owner: "Montana State University", expect: "UNIVERSITY" },
  { owner: "Board of Regents", expect: "UNIVERSITY" },
  { owner: "University of Montana", expect: "UNIVERSITY" },

  // Tribal
  { owner: "Confederated Salish & Kootenai Tribes", expect: "TRIBAL" },
  { owner: "Blackfeet Tribe", expect: "TRIBAL" },
  { owner: "Crow Tribe", expect: "TRIBAL" },
  { owner: "Northern Cheyenne Reservation", expect: "TRIBAL" },
  { owner: "Fort Belknap Indian Community", expect: "TRIBAL" },
  { owner: "Fort Peck Assiniboine and Sioux Tribes", expect: "TRIBAL" },
  { owner: "Rocky Boy's Reservation", expect: "TRIBAL" },

  // County / municipal
  { owner: "Gallatin County", expect: "COUNTY" },
  { owner: "City of Bozeman", expect: "MUNICIPAL" },
  { owner: "Town of Wisdom", expect: "MUNICIPAL" },

  // Private fallthrough
  // An owner string that matches nothing is reported, not guessed private
  { owner: "John Smith", expect: "UNDETERMINED" },
  { owner: "BIG SKY RANCH LLC", expect: "UNDETERMINED" },
  { owner: "Smith Family Trust", propType: "RESIDENTIAL", expect: "PRIVATE" },

  // PII redaction — owner null + private propType still resolves
  { owner: null, propType: "RESIDENTIAL", expect: "PRIVATE" },

  // PropType-only public signal → generic public when no agency match
  { owner: null, propType: "EXEMPT — PUBLIC", expect: "GENERIC_PUBLIC" },

  // Total absence of signal → null (caller renders nothing)
  { owner: null, propType: null, expect: null },
  { owner: "", propType: "", expect: null },
];

describe("resolveAgency", () => {
  for (const c of CASES) {
    const label = `${c.owner ?? "∅"} / ${c.propType ?? "∅"} → ${c.expect}${
      c.note ? ` — ${c.note}` : ""
    }`;
    it(label, () => {
      const result = resolveAgency(c.owner, c.propType ?? null);
      if (c.expect === null) {
        expect(result).toBeNull();
      } else {
        expect(result).not.toBeNull();
        expect(result?.agency).toBe(c.expect);
      }
    });
  }

  it("FWP match exposes the expected metadata flags", () => {
    const m = resolveAgency("MT FWP — Wildlife Management Area");
    expect(m).toMatchObject({
      agency: "FWP",
      isPublic: true,
      isState: true,
      isFederal: false,
      isPrivate: false,
    });
  });

  it("DNRC match flags isTrust", () => {
    const m = resolveAgency("Common Schools Trust");
    expect(m?.isTrust).toBe(true);
    expect(m?.suggestLayerId).toBeNull();
  });

  it("Tribal match flags isTribal and is not public", () => {
    const m = resolveAgency("Blackfeet Nation");
    expect(m?.isTribal).toBe(true);
    expect(m?.isPublic).toBe(false);
  });

  it("an unclassified owner string is UNDETERMINED with low confidence, not guessed private", () => {
    const m = resolveAgency("John Smith");
    expect(m?.agency).toBe("UNDETERMINED");
    expect(m?.confidence).toBe("low");
    expect(m?.isPrivate).toBe(false);
    expect(m?.isPublic).toBe(false);
  });

  it("a private property type is PRIVATE with medium confidence", () => {
    const m = resolveAgency("John Smith", "Residential");
    expect(m?.agency).toBe("PRIVATE");
    expect(m?.confidence).toBe("medium");
    expect(m?.suggestLabel).toContain("Landowner Request");
  });

  it("confidence is high from the owner string and medium from the property type", () => {
    expect(resolveAgency("Bureau of Land Management")?.confidence).toBe("high");
    expect(resolveAgency("REDACTED", "FEDERAL — USFS")?.confidence).toBe("medium");
    expect(resolveAgency(null, "Exempt")?.confidence).toBe("medium");
  });
});

describe("resolveAgencyFromString", () => {
  it("delegates to resolveAgency with null propType", () => {
    expect(resolveAgencyFromString("BLM")?.agency).toBe("BLM");
    expect(resolveAgencyFromString(null)).toBeNull();
    expect(resolveAgencyFromString("")).toBeNull();
  });
});
