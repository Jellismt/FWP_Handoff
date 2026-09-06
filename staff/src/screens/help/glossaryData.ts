/**
 * @file glossaryData.ts
 * @module engage-mt/staff
 * @description The Regs Manager glossary — every term of art used in the app, defined in
 *              plain English. Definitions are traced to the domain model (seed.ts, the
 *              0001–0018 migrations, shared/domain.ts) and the staff user guide, not
 *              invented. Consumed by GlossaryScreen and deep-linked from screen intros
 *              via the `#id` anchors.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-05
 * @updated 2026-07-14
 * @version 1.2.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

/** One glossary entry. `id` is the URL anchor; `seeAlso` lists related entry ids. */
export interface GlossaryTerm {
  id: string;
  term: string;
  group: string;
  definition: string;
  example?: string;
  seeAlso?: string[];
}

export const GLOSSARY_GROUPS = [
  "Geography",
  "Licenses & instruments",
  "Opportunities & seasons",
  "Restrictions & areas",
  "Fees",
  "Reference content",
  "Workflow & publishing",
  "Roles",
] as const;

export const GLOSSARY: GlossaryTerm[] = [
  // ── Geography ─────────────────────────────────────────────────────────────
  {
    id: "region", term: "Region", group: "Geography",
    definition: "One of FWP's seven administrative regions (1–7), each headquartered in a city. The district browser groups districts by region.",
    example: "Region 3 — Bozeman.",
    seeAlso: ["district"],
  },
  {
    id: "district", term: "District", group: "Geography",
    definition: "A hunting district — the smallest geographic unit regulations are written for. Each district belongs to one region and one geography (deer/elk or antelope). It is stored as a code, not a shape: the map boundary lives in FWP's external GIS and is joined by that code.",
    seeAlso: ["region", "hd", "antelope-hd", "portion", "spatial-key", "district-code"],
  },
  {
    id: "hd", term: "HD (Hunting District)", group: "Geography",
    definition: "The deer/elk hunting-district geography. Deer and elk share the same district map, so an HD carries opportunities for both species.",
    seeAlso: ["district", "antelope-hd", "district-code"],
  },
  {
    id: "antelope-hd", term: "Antelope HD", group: "Geography",
    definition: "The antelope hunting-district geography. Antelope has its own separate district map, distinct from the deer/elk HDs, and is keyed to FWP's antelope ESRI layer.",
    seeAlso: ["hd", "district", "gis-layer"],
  },
  {
    id: "portion", term: "Portion", group: "Geography",
    definition: "A named part of a district, for a reg valid in only part of a district rather than the whole thing (e.g. \"Portion of HD 314 South of Rock Creek\"). Portions are synced from FWP's public ESRI portion layers (joined to the geometry by SHAPECODE), not hand-authored — browse them on the District portions screen and attach one to a regulation from Hunt areas → Members → Add portion. They sit alongside whole districts as hunt-area members. Like a district, a portion is stored as a code that joins to FWP's GIS, never as a stored shape.",
    seeAlso: ["district", "hunt-area", "spatial-key"],
  },
  {
    id: "hunt-area", term: "Hunt area", group: "Geography",
    definition: "The set of districts (or portions) an opportunity is valid in. It collapses single-district, multi-district, and portion cases into one shape, so one opportunity can span many districts without repeating rows.",
    example: "A MULTI hunt area 201-204-240 means the opportunity is valid in HDs 201, 204, and 240.",
    seeAlso: ["district", "portion", "opportunity", "re-point", "spatial-key"],
  },
  {
    id: "spatial-key", term: "Spatial key", group: "Geography",
    definition: "The code that ties a tabular regulation to a shape on the map. The Regs Manager stores no geometry — every district, portion, and restricted area carries a code that joins to FWP's live public ESRI map layers, where the boundary shapes actually live. The public app resolves a tapped point to a code, then asks this system for that code's regulations; only the code crosses the wire, never a shape.",
    example: "District 380's regulations join to the DISTRICT=380 feature in FWP's hunting-districts ESRI layer.",
    seeAlso: ["district-code", "gis-layer", "district", "portion", "restricted-area"],
  },
  {
    id: "district-code", term: "District code", group: "Geography",
    definition: "The verbatim ArcGIS DISTRICT string (e.g. \"380\") that identifies a district in FWP's ESRI layer and serves as its join key here. Stored as text so leading zeros are preserved. A few geographies key on a name field instead of DISTRICT — the layer registry records which for each.",
    seeAlso: ["spatial-key", "gis-layer", "district"],
  },
  {
    id: "gis-layer", term: "GIS layer (FWP ESRI)", group: "Geography",
    definition: "One of FWP's live public ESRI/ArcGIS map layers that the geography codes resolve against — the system of record for the boundary shapes. This database links to it by code and holds no geometry of its own, so the map stays FWP's and there is nothing spatial to migrate. A single registry binds each code space to its layer and join field, and an automated probe re-checks the live layers so an FWP field rename can't silently break the join.",
    seeAlso: ["spatial-key", "district-code", "antelope-hd", "re-point"],
  },

  // ── Licenses & instruments ────────────────────────────────────────────────
  {
    id: "instrument", term: "Instrument (license/permit instrument)", group: "Licenses & instruments",
    definition: "The license, permit, or B-license a hunter buys or draws to hunt. It carries the quota, apply-by/OTC dates, draw flag, and display name. One instrument is shared across every opportunity that uses it — editing it changes all of them.",
    seeAlso: ["general", "permit", "b-license", "opportunity", "quota"],
  },
  {
    id: "general", term: "General (license)", group: "Licenses & instruments",
    definition: "The GENERAL instrument type — the standard over-the-counter deer or elk license, not a limited drawing.",
    seeAlso: ["instrument", "otc", "permit"],
  },
  {
    id: "permit", term: "Permit", group: "Licenses & instruments",
    definition: "The PERMIT instrument type — a limited entry issued by drawing. Permits have a quota and an apply-by date.",
    seeAlso: ["instrument", "draw", "quota", "apply-by"],
  },
  {
    id: "b-license", term: "B license", group: "Licenses & instruments",
    definition: "The B_LICENSE instrument type — a supplemental antlerless or extra-animal license held in addition to a general license.",
    seeAlso: ["instrument", "general"],
  },
  {
    id: "quota", term: "Quota (current / min / max)", group: "Licenses & instruments",
    definition: "The number of an instrument issued. `quota_current` is this year's count; `quota_min` and `quota_max` are the commission-set range it must stay within. The database rejects a current quota outside min–max.",
    example: "Quota 250 (200–300) — 250 issued this year, bounded to 200–300 by the commission.",
    seeAlso: ["instrument", "unlimited"],
  },
  {
    id: "unlimited", term: "Unlimited (UNL)", group: "Licenses & instruments",
    definition: "An instrument with no numeric cap. Shown as UNL in the quota column instead of a count.",
    seeAlso: ["quota"],
  },
  {
    id: "draw", term: "Draw", group: "Licenses & instruments",
    definition: "A limited-entry lottery. An instrument flagged as draw is awarded by random drawing among applicants rather than sold over the counter.",
    seeAlso: ["permit", "apply-by", "otc"],
  },
  {
    id: "otc", term: "OTC (over-the-counter)", group: "Licenses & instruments",
    definition: "Sold over the counter (or online) without a drawing. The `otc_from` date is when it becomes available for purchase.",
    seeAlso: ["general", "draw"],
  },
  {
    id: "apply-by", term: "Apply-by date", group: "Licenses & instruments",
    definition: "The deadline to apply for a draw instrument. Set on the instrument alongside the quota.",
    seeAlso: ["draw", "permit"],
  },

  // ── Opportunities & seasons ───────────────────────────────────────────────
  {
    id: "opportunity", term: "Opportunity", group: "Opportunities & seasons",
    definition: "One printed row in the regulations: a license instrument × a legal animal class × a hunt area (× a split number). It carries the five season windows and any restrictions. This is the unit editors work with on the district detail screen.",
    example: "GEN-elk × Brow-tined Bull Elk × hunt area 380 = one opportunity.",
    seeAlso: ["instrument", "legal-animal-class", "hunt-area", "split", "season-window"],
  },
  {
    id: "split", term: "Split #", group: "Opportunities & seasons",
    definition: "A sequence number that lets the same instrument × animal class × hunt area appear as more than one printed row — used when a single license has distinct season blocks that print separately.",
    seeAlso: ["opportunity"],
  },
  {
    id: "legal-animal-class", term: "Legal animal class", group: "Opportunities & seasons",
    definition: "What may legally be taken under an opportunity — the sex/age/antler category. Drawn from a fixed, species-specific vocabulary.",
    example: "Antlerless Mule Deer; Either-sex Elk; Doe/Fawn (antelope).",
    seeAlso: ["either-sex", "brow-tined-bull", "opportunity"],
  },
  {
    id: "either-sex", term: "Either-sex", group: "Opportunities & seasons",
    definition: "A legal animal class allowing take of either a male or female of the species.",
    example: "Either-sex White-tailed Deer.",
    seeAlso: ["legal-animal-class"],
  },
  {
    id: "brow-tined-bull", term: "Brow-tined bull", group: "Opportunities & seasons",
    definition: "An elk legal animal class restricting take to a bull with a brow tine — used to protect younger bulls.",
    seeAlso: ["legal-animal-class"],
  },
  {
    id: "season-window", term: "Season window", group: "Opportunities & seasons",
    definition: "A date range an opportunity is open, filed under one of the five season types. An opportunity can have windows in several season types at once.",
    seeAlso: ["season-types", "opportunity"],
  },
  {
    id: "season-types", term: "The five season types", group: "Opportunities & seasons",
    definition: "The columns each opportunity's windows are filed under: Early, Archery, General, Muzzleloader (Heritage Muzzleloader), and Late. Antelope uses a single General \"Season\" column.",
    seeAlso: ["season-window"],
  },
  {
    id: "validity-note", term: "Validity note", group: "Opportunities & seasons",
    definition: "Free-text on an opportunity qualifying where or when it is valid, printed alongside its restrictions.",
    seeAlso: ["opportunity", "restriction"],
  },

  // ── Restrictions & areas ──────────────────────────────────────────────────
  {
    id: "restriction", term: "Restriction", group: "Restrictions & areas",
    definition: "A structured limit on an opportunity, chosen from a fixed coded vocabulary (e.g. Private land only, Archery equipment only, Youth only). Each restriction has a code and verbatim printed text; some carry a value.",
    seeAlso: ["restriction-value", "opportunity", "pthfv", "youth-only"],
  },
  {
    id: "restriction-value", term: "Restriction value", group: "Restrictions & areas",
    definition: "A parameter some restriction codes need (marked \"needs value\"). The editor only enables the value field for those codes.",
    example: "Per-hunter limit needs a number; Youth only needs an age cutoff.",
    seeAlso: ["restriction"],
  },
  {
    id: "restricted-area", term: "Restricted area", group: "Restrictions & areas",
    definition: "A named area with special rules that districts reference — weapons-restricted, closure, archery-only, or a management zone. Created once, then linked to the districts it applies to.",
    seeAlso: ["restricted-area-types", "district"],
  },
  {
    id: "restricted-area-types", term: "Restricted-area types", group: "Restrictions & areas",
    definition: "The kinds of restricted area: Restricted, Weapons restricted, Closure, Archery only, and Management zone.",
    seeAlso: ["restricted-area"],
  },
  {
    id: "district-note", term: "District note", group: "Restrictions & areas",
    definition: "Free-text guidance attached to a district (optionally scoped to one species), printed with that district's tables.",
    seeAlso: ["district"],
  },
  {
    id: "pthfv", term: "PTHFV", group: "Restrictions & areas",
    definition: "Permit to Hunt From a Vehicle — a restriction limiting an opportunity to holders of that permit.",
    seeAlso: ["restriction"],
  },
  {
    id: "youth-only", term: "Youth only", group: "Restrictions & areas",
    definition: "A restriction limiting an opportunity to youth hunters, with an age cutoff as its value.",
    seeAlso: ["restriction", "restriction-value"],
  },

  // ── Fees ──────────────────────────────────────────────────────────────────
  {
    id: "product", term: "Product (fee product)", group: "Fees",
    definition: "A priced item on the license fee chart. Each product carries a per-audience price grid rather than separate rows for discounted variants.",
    seeAlso: ["product-kind", "audience"],
  },
  {
    id: "product-kind", term: "Product kind", group: "Fees",
    definition: "The category of a fee product: Prerequisite, License, Permit, Combo, B-license, or Surcharge.",
    seeAlso: ["product"],
  },
  {
    id: "audience", term: "Audience", group: "Fees",
    definition: "The buyer category a price applies to. Discounted variants (youth, senior, native, college) are audience columns on the same product, mirroring the printed chart.",
    example: "RES_YOUTH = Resident Youth 12-17; NR = Nonresident.",
    seeAlso: ["resident-nonresident", "product"],
  },
  {
    id: "resident-nonresident", term: "Resident / nonresident tiers", group: "Fees",
    definition: "The two residency families every audience belongs to — Resident (RES*) and Nonresident (NR*) — which set the base price tier.",
    seeAlso: ["audience"],
  },

  // ── Workflow & publishing ─────────────────────────────────────────────────
  {
    id: "season-year", term: "Season year", group: "Workflow & publishing",
    definition: "The license year everything is scoped to, running Mar 1 → end of Feb. The top-right switcher chooses which season year every screen shows.",
    example: "Season year 2026 runs 2026-03-01 → 2027-02-28.",
    seeAlso: ["draft", "publish", "clone-forward"],
  },
  {
    id: "draft", term: "Draft", group: "Workflow & publishing",
    definition: "The editable working state. Every edit saves as DRAFT and does not affect the public app until the year is published.",
    seeAlso: ["publish", "snapshot", "season-year"],
  },
  {
    id: "validation", term: "Validation (blocking vs warning)", group: "Workflow & publishing",
    definition: "Automated checks on the active year. Blocking errors (e.g. an instrument with no opportunities, a window outside the year, a quota outside the commission range) must be cleared before publishing. Warnings are advisory and don't block.",
    seeAlso: ["publish"],
  },
  {
    id: "publish", term: "Publish", group: "Workflow & publishing",
    definition: "The approver action that flips the year's draft rows to published, writes an immutable versioned snapshot the public app reads, and records the event with a changelog note. Requires green validation.",
    seeAlso: ["snapshot", "version", "changelog-note", "validation"],
  },
  {
    id: "snapshot", term: "Snapshot", group: "Workflow & publishing",
    definition: "The immutable copy of a year's regulations, fees, and content written at publish time. The public API and Engage MT app read only snapshots — never your drafts.",
    seeAlso: ["publish", "version", "live-snapshot"],
  },
  {
    id: "live-snapshot", term: "Live snapshot", group: "Workflow & publishing",
    definition: "The published snapshot version the public app is serving right now (the latest version of the year). The Live snapshot screen shows the D/E/A regulations exactly as hunters see them — read-only, so you can confirm what's live without risk of editing it.",
    seeAlso: ["snapshot", "version", "mid-year-correction"],
  },
  {
    id: "version", term: "Version", group: "Workflow & publishing",
    definition: "The snapshot number for a season year. The first publish is v1; each mid-year re-publish adds v2, v3, … each with its own changelog note.",
    seeAlso: ["snapshot", "publish", "mid-year-correction"],
  },
  {
    id: "changelog-note", term: "Changelog note", group: "Workflow & publishing",
    definition: "The required one-line reason recorded with each publish, describing what changed in that version.",
    seeAlso: ["publish", "version"],
  },
  {
    id: "mid-year-correction", term: "Mid-year correction", group: "Workflow & publishing",
    definition: "Fixing an already-published year: edit the rows (they become draft revisions without touching the live snapshot), then have an approver re-publish as a new version (v2, v3, …). The re-publish is flagged a correction — you can add a plain-English summary + the affected species/districts, which appear in Corrections & updates and in the Engage MT app as “what changed since the book.”",
    seeAlso: ["publish", "version", "live-snapshot", "changelog-note"],
  },
  {
    id: "clone-forward", term: "Clone forward", group: "Workflow & publishing",
    definition: "Deep-copies every instrument, opportunity, season, restriction, and note from a previous year into a new empty draft year, with dates shifted forward a year — so you edit only what changed instead of re-entering everything.",
    seeAlso: ["season-year", "draft"],
  },
  {
    id: "archive-restore", term: "Archive / restore", group: "Workflow & publishing",
    definition: "Soft-delete. Archiving hides a row (opportunity, content section) without removing its history; it can be restored. Draft-only archiving keeps the published snapshot untouched.",
    seeAlso: ["draft"],
  },
  {
    id: "optimistic-lock", term: "Optimistic lock (\"changed by someone else\")", group: "Workflow & publishing",
    definition: "Concurrency guard: every editable record carries a last-updated timestamp, and a save is rejected if someone else changed the record since you loaded it. When that happens you'll be told to reload and retry.",
    seeAlso: ["audit-log"],
  },
  {
    id: "re-point", term: "Re-point", group: "Workflow & publishing",
    definition: "Moves every opportunity on one hunt area onto another hunt area. Use it before deleting an area that still has opportunities.",
    seeAlso: ["hunt-area"],
  },
  {
    id: "audit-log", term: "Audit log", group: "Workflow & publishing",
    definition: "The read-only trail of every insert, update, delete, and publish, with the acting user and a field-level before/after diff. Open to every role.",
    seeAlso: ["optimistic-lock"],
  },

  // ── Roles ─────────────────────────────────────────────────────────────────
  {
    id: "roles", term: "Roles (viewer / editor / approver / admin)", group: "Roles",
    definition: "The access ladder, each including the ones below it: viewer reads everything; editor also creates/edits/soft-deletes draft regulations; approver also publishes a year and approves corrections; admin also manages staff accounts. The server enforces them — the UI just hides what you can't do.",
    seeAlso: ["publish", "draft"],
  },

  // ── Reference content ───────────────────────────────────────────────────────
  {
    id: "important-date", term: "Important date", group: "Reference content",
    definition: "A row from the book's Important Dates page (p.11): a season window, an application/purchase deadline, a drawing-result date, or a purchase window (e.g. OTC B-license June 15, bonus-point July 1-Sept 30). Edited on the Important dates screen; published into the immutable snapshot with the rest of the book.",
    seeAlso: ["publish", "draft"],
  },
  {
    id: "contact", term: "Contact", group: "Reference content",
    definition: "A row from the book's Contact List (pp.143-144): FWP headquarters, a hotline, a regional/field office, a state or federal agency, or a tribal government. Grouped by contact kind on the Contacts screen. Bear-management-specialist proper names are intentionally not stored (a wrong name is worse than a pointer to 1-800-TIP-MONT and p.47).",
  },
  {
    id: "content-category", term: "Content category (incl. FRONT_MATTER, CWD)", group: "Reference content",
    definition: "The bucket a reference content section belongs to: FRONT_MATTER (director's letter, highlights, how-to-use, commission adoption), CWD, DEFINITIONS, LICENSING, LAWS_RULES, YOUTH, DISABILITY, DRAWING, SAFETY, ACCESS, or OTHER. Adding a category means updating the DB CHECK, the route's zod enum, and the Content screen dropdown together.",
    seeAlso: ["draft"],
  },
  {
    id: "cwd-zone", term: "CWD Management Zone", group: "Reference content",
    definition: "A restricted area with area_type MGMT_ZONE (e.g. the Libby CWD Management Zone referenced by Deer B 199-20) that delineates where chronic-wasting-disease management regulations and carcass-transport rules apply.",
    seeAlso: ["restricted-area"],
  },
  {
    id: "antelope-hd", term: "Antelope HD", group: "Reference content",
    definition: "A hunting district with geography_code ANTELOPE_HD — antelope districts are numbered and mapped separately from deer/elk HDs and are keyed to FWP's antelope ESRI layer (ArcGIS /3). The 2026 book regulates antelope in regions 2-7.",
    seeAlso: ["district"],
  },
  {
    id: "statewide-archery-license", term: "Statewide archery license (900-20 / 399-20)", group: "Reference content",
    definition: "A single either-sex antelope archery license valid across many hunting districts: 399-20 across Region 3 HDs and 900-20 across Regions 4-7. Modeled as one instrument on a MULTI hunt area with the \"First and only choice / ArchEquip only\" restrictions, so its single quota is shared across every HD it lists under.",
    seeAlso: ["hunt-area", "antelope-hd"],
  },
  {
    id: "continuation-row", term: "Continuation row", group: "Reference content",
    definition: "A district-regulation row the PDF-table extraction split off from its license: the General License's extra opportunity rows arrive with an empty license column ahead of the license-bearing row. The ETL recovers them as General License opportunities. A residual handful of Permit rows whose animal class was dropped by the extraction remain a documented limitation.",
  },
  {
    id: "placeholder-asset", term: "Placeholder asset", group: "Reference content",
    definition: "A cms_asset row (region map, figure, or cover) registered with a placeholder cms_doc_id so the map/figure surface is populated and swappable one env-flip later, before FWP wires the real Bloomreach maps (STUB-035).",
  },
];
