/**
 * @file myFwpLicenses.stub.ts
 * @module engage-mt/services/stubs
 * @description STUB-001 — MyFWP License Wallet. Returns mock licenses, e-tags, permits.
 *              Fixture v3 — rebuilt as a single legally-coherent persona
 *              (Resident Sportsman) that honors the app's own license model
 *              (Conservation + AIS Pass), the Sportsman combo's bundled
 *              coverage (no separate fishing/upland/deer/elk), and a backing
 *              license for every e-tag. See docs/stubs/STUB-001.md for the rules.
 *              License `type` strings match catalog `name` values exactly so
 *              the wizard's wallet-dedup ("already in wallet ✓") works.
 * @author Jamie Ellis / Engage MT
 * @created 2026-05-29
 * @updated 2026-06-29
 * @version 1.2.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

// TODO: REPLACE_STUB — Awaiting FWP endpoint access
// Stub ID: STUB-001 | Expected: GET /api/myfwp/licenses | Auth: OAuth Bearer (XMT)
// See: docs/stubs/STUB-001.md for full contract

import { fakeLatency } from "./stubFixtures";

export interface License {
  id: string;
  type: string;
  validFrom: string;
  validTo: string;
  number: string;
  species?: string[];
}

export interface ETag {
  id: string;
  species: string;
  region: number;
  district: string;
  status: "Issued" | "Tagged" | "Validated" | "Expired";
  issuedAt: string;
}

export interface Permit {
  id: string;
  type: string;
  number: string;
  validFrom: string;
  validTo: string;
}

export interface LicenseWalletResponse {
  user: { id: string; name: string; alsId: string };
  licenses: License[];
  etags: ETag[];
  permits: Permit[];
}

export const fetchLicenseWalletStub = async (): Promise<LicenseWalletResponse> => {
  await fakeLatency();
  return {
    user: { id: "u_42", name: "Jamie Hunter", alsId: "ALS123456" },
    // Persona: a Montana RESIDENT who bought the Sportsman combo, then added
    // the drawn/weapon-specific tags the combo does NOT cover. Every license
    // here is one a real purchase flow would produce together — see
    // licenseCatalog.ts for the authoritative model.
    licenses: [
      // ── Universal prereqs (required before any fish/hunt license) ──
      {
        id: "L1",
        type: "Conservation License",
        validFrom: "2026-03-01",
        validTo: "2027-02-28",
        number: "CON-2026-001124",
      },
      {
        id: "L2",
        type: "AIS Prevention Pass",
        validFrom: "2026-03-01",
        validTo: "2027-02-28",
        number: "AIS-2026-004417",
      },
      // ── The combo: bundles base hunt + general deer + general elk +
      //    black bear + upland + season fishing. Nothing it covers is
      //    listed separately. ──
      {
        id: "L3",
        type: "Resident Sportsman Combo",
        validFrom: "2026-03-01",
        validTo: "2027-02-28",
        number: "SPM-2026-000891",
        species: [
          "General Deer",
          "General Elk",
          "Black Bear",
          "Upland Game Birds",
          "Season Fishing",
        ],
      },
      // ── Drawn tags the combo does NOT include ──
      {
        id: "L4",
        type: "Antelope License",
        validFrom: "2026-08-15",
        validTo: "2026-11-30",
        number: "ANT-2026-002310",
      },
      {
        id: "L5",
        type: "Deer B License (Antlerless)",
        validFrom: "2026-09-01",
        validTo: "2026-12-15",
        number: "DBL-2026-003051",
      },
      // ── Weapon add-on (archery-only seasons) ──
      {
        id: "L6",
        type: "Bow and Arrow License",
        validFrom: "2026-09-01",
        validTo: "2026-12-15",
        number: "BOW-2026-003402",
      },
    ],
    // Each e-tag is backed by a license above:
    //   Whitetail Deer  → General Deer (via Sportsman combo)
    //   Antelope (Buck) → Antelope License
    //   Mule Deer (Doe) → Deer B License (antlerless)
    etags: [
      {
        id: "E1",
        species: "Whitetail Deer",
        region: 3,
        district: "380",
        status: "Issued",
        issuedAt: "2026-09-01T10:00:00Z",
      },
      {
        id: "E2",
        species: "Antelope (Buck)",
        region: 7,
        district: "700",
        status: "Validated",
        issuedAt: "2026-08-20T10:00:00Z",
      },
      {
        id: "E3",
        species: "Mule Deer (Doe)",
        region: 5,
        district: "510",
        status: "Tagged",
        issuedAt: "2026-09-10T10:00:00Z",
      },
    ],
    permits: [
      // Requires a valid elk license — provided by the Sportsman combo.
      {
        id: "P1",
        type: "Elk Shoulder Season",
        number: "ESS-2026-000789",
        validFrom: "2026-11-01",
        validTo: "2027-02-15",
      },
      // A draw preference point — accumulated toward a future bighorn tag.
      // Holding a point requires no underlying bighorn license.
      {
        id: "P2",
        type: "Bighorn Sheep Preference Point",
        number: "BHS-PP-2026-000142",
        validFrom: "2026-03-01",
        validTo: "2027-02-28",
      },
    ],
  };
};
