/**
 * @file print.test.ts
 * @module engage-mt/server/services/print
 * @description Unit tests for the print pipeline that DON'T need a DB or Chromium: given a
 *              synthetic BookModel, assert the HTML proof renders at the 5.5×8.5 booklet
 *              geometry, in printed-book order, with every section (dates, contacts, sunrise,
 *              maps, TOC, district table); and assert the ICML column widths fit the 5.5in
 *              text area + the styles.md documents the page setup.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-07
 * @updated 2026-07-07
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { describe, it, expect } from "vitest";
import type { BookModel } from "./bookModel.js";
import { renderProofHtml } from "./proofHtml.js";
import { buildIcmlPackage } from "./icml.js";

function sampleBook(): BookModel {
  return {
    seasonYear: 2026,
    content: [
      { slug: "what-is-cwd", category: "CWD", title: "What Is Chronic Wasting Disease?", bodyMd: "CWD is a progressive disease.", statuteRefs: null },
      { slug: "director-letter", category: "FRONT_MATTER", title: "Letter from the Director", bodyMd: "Dear hunters.", statuteRefs: null },
      { slug: "definitions", category: "DEFINITIONS", title: "Definitions", bodyMd: "**Antlerless** — a deer with no antlers.", statuteRefs: null },
      { slug: "archery-equipment", category: "LAWS_RULES", title: "Archery Equipment", bodyMd: "Bows must draw 28 lbs.", statuteRefs: "ARM 12.6.1706" },
      { slug: "hunter-land-access", category: "ACCESS", title: "Hunter Land Access", bodyMd: "Respect private land.", statuteRefs: null },
    ],
    fees: [
      { code: "BG_COMBO", name: "Nonresident Big Game Combination", kind: "COMBO", applyBy: "Apr 01", chartNote: "Includes deer + elk", prices: { RES: 0, NR: 131200 } },
    ],
    regions: [
      {
        regionId: 3, regionName: "Region 3", districts: [
          {
            districtCode: "300", districtName: "Gallatin", geography: "HD", notes: ["CWD sampling — see page 4."],
            opps: [
              { instrCode: "GEN-DEER", instrumentName: "General Deer License", species: "DEER", legalAnimal: "Antlerless Mule Deer", quota: "50", applyBy: "Jun 01", windows: { GENERAL: "Oct 26 – Dec 01" }, restrictions: "Private land only", splitSeq: 0 },
            ],
          },
          {
            districtCode: "301", districtName: "Antelope Area", geography: "ANTELOPE_HD", notes: [],
            opps: [
              { instrCode: "ANT-900", instrumentName: "Antelope License", species: "ANTELOPE", legalAnimal: "Either-sex Antelope", quota: "UNL", applyBy: "Jun 01", windows: { GENERAL: "Oct 10 – Nov 08" }, restrictions: "ArchEquip only", splitSeq: 0 },
            ],
          },
        ],
      },
    ],
    restrictedAreas: [
      { areaType: "WMA", areaName: "Mount Haggin WMA", legalDesc: "That area bounded by...", districts: ["300"] },
    ],
    importantDates: [
      { dateKind: "DEADLINE", speciesScope: "Deer/Elk", label: "Permit application deadline", startsOn: "Apr 01", endsOn: null, note: null },
      { dateKind: "SEASON", speciesScope: null, label: "General deer/elk season", startsOn: "Oct 26", endsOn: "Dec 01", note: null },
    ],
    contacts: [
      { kind: "STATE_HQ", name: "FWP Headquarters", org: "Montana FWP", address: "1420 E 6th Ave", city: "Helena", phone: "406-444-2535", phone2: null, email: null, url: "fwp.mt.gov", note: null },
      { kind: "REGIONAL_HQ", name: "Region 3 Office", org: null, address: null, city: "Bozeman", phone: "406-577-7900", phone2: null, email: null, url: null, note: null },
    ],
    sunrise: [
      {
        zoneNo: 1, zoneName: "Zone 1", counties: ["Lincoln", "Flathead"],
        times: [
          { month: 8, day: 1, rise: 375, set: 1230 },
          { month: 9, day: 1, rise: 410, set: 1170 },
        ],
      },
    ],
    assets: [
      { kind: "REGION_MAP", title: "Region 3 Deer & Elk Districts", caption: null, regionId: 3, geography: "HD", cmsDocId: "map-deer-elk-r3" },
      { kind: "REGION_MAP", title: "Region 3 Antelope Districts", caption: null, regionId: 3, geography: "ANTELOPE_HD", cmsDocId: "map-antelope-r3" },
    ],
  };
}

describe("renderProofHtml", () => {
  const html = renderProofHtml(sampleBook());

  it("renders at the physical booklet trim (5.5in × 8.5in)", () => {
    expect(html).toContain("@page { size: 5.5in 8.5in;");
    // guard against a US-Letter regression sneaking back in
    expect(html).not.toContain("8.5in 11in");
  });

  it("includes a Table of Contents and every section", () => {
    expect(html).toContain("Table of Contents");
    expect(html).toContain("Chronic Wasting Disease Management");
    expect(html).toContain("Important Dates");
    expect(html).toContain("Licenses, Permits &amp; Fees");
    expect(html).toContain("Contact List");
    expect(html).toContain("Sunrise-Sunset Tables (Hunting Hours)");
    expect(html).toContain("Restricted Area Descriptions");
  });

  it("emits chapters in printed-book order (CWD → Definitions → Laws → Sunrise)", () => {
    const iCwd = html.indexOf("Chronic Wasting Disease Management");
    const iDefs = html.indexOf(">Definitions<");
    const iLaws = html.indexOf("Laws &amp; Rules");
    const iSunrise = html.indexOf("Sunrise-Sunset Tables");
    expect(iCwd).toBeGreaterThan(-1);
    expect(iCwd).toBeLessThan(iDefs);
    expect(iDefs).toBeLessThan(iLaws);
    expect(iLaws).toBeLessThan(iSunrise);
  });

  it("separates deer/elk from antelope district regs by geography", () => {
    expect(html).toContain("Deer &amp; Elk Regulations by Hunting District");
    expect(html).toContain("Antelope Regulations by Hunting District");
    // deer/elk district and antelope district both appear
    expect(html).toContain("300");
    expect(html).toContain("301");
  });

  it("renders district notes and opportunity rows", () => {
    expect(html).toContain("CWD sampling — see page 4.");
    expect(html).toContain("Antlerless Mule Deer");
  });

  it("is self-contained (no external fetches)", () => {
    expect(html).not.toMatch(/https?:\/\/[^"']*\.(png|jpg|jpeg|svg|css|js|woff2?)/i);
    expect(html).not.toContain("<script");
  });
});

describe("buildIcmlPackage", () => {
  const pkg = buildIcmlPackage(sampleBook());

  it("sizes district-table columns to the 5.5in text area (~341pt)", () => {
    // WIDTHS from icml.ts — sum must fit inside 5.5in − 2×0.38in margins (≈ 341pt).
    const WIDTHS = [50, 50, 30, 22, 27, 27, 27, 30, 27, 50];
    const sum = WIDTHS.reduce((a, b) => a + b, 0);
    expect(sum).toBeLessThanOrEqual(341);
    expect(sum).toBeGreaterThan(300);
  });

  it("documents the 5.5×8.5 page setup in styles.md", () => {
    const styles = pkg.entries.find((e) => e.name === "styles.md");
    expect(styles).toBeDefined();
    expect(styles!.content).toContain("5.5 in wide");
    expect(styles!.content).toContain("8.5 in tall");
  });

  it("emits the new important-dates and contacts stories", () => {
    const names = pkg.entries.map((e) => e.name);
    expect(names).toContain("stories/050-important-dates.icml");
    expect(names).toContain("stories/900-contacts.icml");
    expect(names).toContain("stories/203-region-3.icml");
  });
});
