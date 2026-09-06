/**
 * @file proofHtml.ts
 * @module engage-mt/server/services/print
 * @description Renders the BookModel to a self-contained, print-ready HTML book that mirrors
 *              the physical FWP pamphlet: 5.5in × 8.5in trim, printed-book chapter order
 *              (front matter → CWD → definitions → important dates → licensing/fees → drawing →
 *              youth → disability → laws & rules → restricted areas → access → deer/elk maps +
 *              regs → antelope maps + regs → safety → contacts → sunrise-sunset), pamphlet-style
 *              colored section-header bars, a generated table of contents, the district table,
 *              fee charts, contacts, and the 4-zone sunrise-sunset grid. Fully self-contained
 *              (inline CSS, no external fetches) so the same HTML drives both the in-browser
 *              proof and the server-side Chromium PDF. Maps render as captioned placeholder
 *              slots until FWP's Bloomreach CMS lands. Reads current DRAFT+PUBLISHED rows.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-04
 * @updated 2026-07-07
 * @version 2.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import type { BookModel, BookContent, BookDistrict } from "./bookModel.js";
import { BOOK_SEASON_COLS, bookSeasonLabel, bookCategoryRank } from "./bookModel.js";
import { markdownToHtml, escapeHtml } from "./markdown.js";

const dollars = (cents?: number) => (cents == null ? "" : `$${(cents / 100).toLocaleString()}`);
const FEE_AUD: [string, string][] = [
  ["RES", "Resident"], ["RES_YOUTH", "Youth/Sr"], ["RES_DISABLED", "Disabled"],
  ["NR", "Nonres."], ["NR_NATIVE", "NR Native"],
];
const MONTHS = [8, 9, 10, 11, 12, 1, 2];
const MONTH_LABEL: Record<number, string> = { 8: "Aug", 9: "Sept", 10: "Oct", 11: "Nov", 12: "Dec", 1: "Jan", 2: "Feb" };
const hhmm = (m: number) => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`;

// FWP module accent per book chapter (indicative — faithful, not pixel-exact). Values mirror
// brand-tokens.css. Each chapter's header bar takes its accent so the book reads like the pamphlet.
const ACCENT = {
  frontMatter: "#744F28", cwd: "#E57200", definitions: "#B3252E", dates: "#B3252E",
  licensing: "#046A38", drawing: "#002855", youth: "#B8860B", disability: "#046A38",
  laws: "#B3252E", restricted: "#B3252E", access: "#E57200", deerElk: "#002855",
  antelope: "#E57200", safety: "#B3252E", contacts: "#744F28", sunrise: "#B3252E",
} as const;

interface Sec { id: string; title: string }

export function renderProofHtml(book: BookModel): string {
  const toc: Sec[] = [];
  const P: string[] = [];
  let secN = 0;
  // A book chapter: colored header bar + registers the section in the TOC.
  const chapter = (title: string, accent: string, opts: { break?: boolean } = {}): void => {
    const id = `sec-${++secN}`;
    toc.push({ id, title });
    P.push(`<h2 class="chapter${opts.break === false ? "" : " page-break"}" id="${id}" style="background:${accent}">${escapeHtml(title)}</h2>`);
  };
  const contentByCat = groupContent(book.content);
  const renderCat = (cat: string): void => {
    for (const s of contentByCat.get(cat) ?? []) {
      P.push(`<h3>${escapeHtml(s.title)}${s.statuteRefs ? ` <span class="ref">(${escapeHtml(s.statuteRefs)})</span>` : ""}</h3>`);
      P.push(`<div class="prose">${markdownToHtml(s.bodyMd)}</div>`);
    }
  };

  // ── Cover ──
  P.push(`<section class="cover"><div class="cover-yr">${book.seasonYear}</div>` +
    `<div class="cover-title">DEER · ELK · ANTELOPE</div>` +
    `<div class="cover-sub">MONTANA FWP · Hunting Regulations</div>` +
    `<div class="cover-note">Print proof generated from the Regs Manager. The InDesign template owns final print typography.</div></section>`);

  // TOC placeholder — filled after all chapters are known.
  const tocIndex = P.push("") - 1;

  // ── Chapters, in printed-book order ──
  chapter("Chronic Wasting Disease Management", ACCENT.cwd); renderCat("CWD");
  chapter(`${book.seasonYear} Deer · Elk · Antelope`, ACCENT.frontMatter); renderCat("FRONT_MATTER");
  chapter("Definitions", ACCENT.definitions); renderCat("DEFINITIONS");
  if (book.importantDates.length) { chapter("Important Dates", ACCENT.dates); P.push(importantDates(book)); }
  chapter("Licenses, Permits & Fees", ACCENT.licensing); if (book.fees.length) P.push(feeChart(book)); renderCat("LICENSING");
  chapter("Drawings, Bonus & Preference Points", ACCENT.drawing); renderCat("DRAWING");
  chapter("Youth Hunter", ACCENT.youth); renderCat("YOUTH");
  chapter("Hunters with a Disability", ACCENT.disability); renderCat("DISABILITY");
  chapter("Laws & Rules", ACCENT.laws); renderCat("LAWS_RULES");
  if (book.restrictedAreas.length) { chapter("Restricted Area Descriptions", ACCENT.restricted); P.push(restrictedAreas(book)); }
  chapter("General Information & Access", ACCENT.access); renderCat("ACCESS");

  // Deer/elk: maps then per-district regs.
  chapter("Deer & Elk District Maps", ACCENT.deerElk); P.push(maps(book, "HD"));
  chapter("Deer & Elk Regulations by Hunting District", ACCENT.deerElk); P.push(districtRegs(book, "HD"));
  // Antelope: maps then per-district regs.
  chapter("Antelope District Maps", ACCENT.antelope); P.push(maps(book, "ANTELOPE_HD"));
  chapter("Antelope Regulations by Hunting District", ACCENT.antelope); P.push(districtRegs(book, "ANTELOPE_HD"));

  chapter("Bear Identification & Safety", ACCENT.safety); renderCat("SAFETY"); renderCat("OTHER");
  if (book.contacts.length) { chapter("Contact List", ACCENT.contacts); P.push(contacts(book)); }
  if (book.sunrise.length) { chapter("Sunrise-Sunset Tables (Hunting Hours)", ACCENT.sunrise); P.push(sunrise(book)); }

  // Fill the TOC now that every chapter is registered.
  P[tocIndex] = `<section class="toc page-break"><h2 class="chapter" style="background:${ACCENT.frontMatter}">Table of Contents</h2>` +
    `<ol>${toc.map((s) => `<li><a href="#${s.id}">${escapeHtml(s.title)}</a></li>`).join("")}</ol></section>`;

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Montana DEA Hunting Regulations ${book.seasonYear}</title><style>${CSS}</style></head><body>${P.join("\n")}</body></html>`;
}

// ── helpers ──────────────────────────────────────────────────────────────────
function groupContent(content: BookContent[]): Map<string, BookContent[]> {
  const m = new Map<string, BookContent[]>();
  for (const c of content) { const l = m.get(c.category) ?? []; l.push(c); m.set(c.category, l); }
  // Ensure book-order iteration when a caller loops the map (categories already sorted upstream).
  return new Map([...m.entries()].sort((a, b) => bookCategoryRank(a[0]) - bookCategoryRank(b[0])));
}

function feeChart(book: BookModel): string {
  const rows = book.fees.map((f) =>
    `<tr><td class="lname"><strong>${escapeHtml(f.name)}</strong>${f.applyBy ? ` <span class="ref">apply ${escapeHtml(f.applyBy)}</span>` : ""}` +
    `${f.chartNote ? `<div class="chart-note">${escapeHtml(f.chartNote)}</div>` : ""}</td>` +
    FEE_AUD.map(([a]) => `<td class="num">${dollars(f.prices[a])}</td>`).join("") + `</tr>`).join("");
  return `<h3>License & Permit Availability Chart</h3><table class="fees"><thead><tr><th>Product</th>${FEE_AUD.map(([, l]) => `<th class="num">${l}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table>`;
}

function importantDates(book: BookModel): string {
  const KINDS: [string, string][] = [["SEASON", "Season Dates"], ["DEADLINE", "Application / Purchase Deadlines"], ["DRAWING_RESULT", "Drawing Results"], ["PURCHASE_WINDOW", "Purchase Windows"], ["REFUND", "Refunds"]];
  const out: string[] = [];
  for (const [k, label] of KINDS) {
    const rows = book.importantDates.filter((d) => d.dateKind === k);
    if (!rows.length) continue;
    out.push(`<h3>${label}</h3><table class="dates"><tbody>` + rows.map((d) => {
      const when = d.startsOn ? (d.endsOn ? `${d.startsOn} – ${d.endsOn}` : d.startsOn) : (d.note ?? "");
      return `<tr><td>${escapeHtml(d.label)}${d.speciesScope ? ` <span class="ref">${escapeHtml(d.speciesScope)}</span>` : ""}${d.note && d.startsOn ? `<div class="chart-note">${escapeHtml(d.note)}</div>` : ""}</td><td class="when">${escapeHtml(when)}</td></tr>`;
    }).join("") + `</tbody></table>`);
  }
  return out.join("");
}

function restrictedAreas(book: BookModel): string {
  return book.restrictedAreas.map((ra) =>
    `<div class="rarea"><strong>${escapeHtml(ra.areaName)}</strong> <span class="ref">${escapeHtml(ra.areaType.replace(/_/g, " ").toLowerCase())}</span>` +
    `${ra.districts.length ? ` <span class="ref">— HD ${ra.districts.join(", ")}</span>` : ""}` +
    `${ra.legalDesc ? `<div class="rarea-desc">${escapeHtml(ra.legalDesc)}</div>` : ""}</div>`).join("");
}

function maps(book: BookModel, geography: string): string {
  const kindWanted = geography === "HD" ? "deer-elk" : "antelope";
  const slots = book.assets.filter((a) => a.kind === "REGION_MAP" && (a.geography === geography || (a.geography == null && a.cmsDocId.includes(kindWanted))));
  const list = slots.length ? slots : book.assets.filter((a) => a.kind === "REGION_MAP" && a.geography === geography);
  if (!list.length) return `<p class="ref">Maps pending FWP CMS.</p>`;
  return `<div class="map-grid">` + list.map((a) =>
    `<figure class="map-slot"><div class="map-box">MAP</div><figcaption>${escapeHtml(a.title)}<span class="ref"> — pending FWP CMS</span></figcaption></figure>`).join("") + `</div>`;
}

function districtRegs(book: BookModel, geography: string): string {
  const cols = BOOK_SEASON_COLS;
  const out: string[] = [];
  for (const region of book.regions) {
    const districts = region.districts.filter((d) => d.geography === geography && d.opps.length);
    if (!districts.length) continue;
    out.push(`<h3 class="region-head">Region ${region.regionId}</h3>`);
    for (const d of districts) out.push(districtTable(d, cols));
  }
  return out.join("") || `<p class="ref">No districts.</p>`;
}

function districtTable(d: BookDistrict, cols: readonly string[]): string {
  const head = `<div class="district">HD ${escapeHtml(d.districtCode)}${d.districtName ? ` — ${escapeHtml(d.districtName)}` : ""}</div>` +
    d.notes.map((n) => `<div class="note">NOTE: ${escapeHtml(n)}</div>`).join("");
  const rows: string[] = [];
  let lastSpecies = "";
  for (const o of d.opps) {
    if (o.species !== lastSpecies) { rows.push(`<tr class="species-head"><td colspan="${5 + cols.length}">${escapeHtml(o.species.toUpperCase())}</td></tr>`); lastSpecies = o.species; }
    rows.push(`<tr><td>${escapeHtml(o.instrumentName)}</td><td>${escapeHtml(o.legalAnimal)}</td><td>${escapeHtml(o.applyBy)}</td><td class="num">${escapeHtml(o.quota)}</td>${cols.map((c) => `<td class="sd">${escapeHtml(o.windows[c] ?? "-")}</td>`).join("")}<td class="restr">${escapeHtml(o.restrictions)}</td></tr>`);
  }
  return `<div class="district-block">${head}<table class="district-table"><thead><tr><th>License / Permit</th><th>Opportunity</th><th>Apply</th><th class="num">Quota</th>${cols.map((c) => `<th class="sd">${bookSeasonLabel(c)}</th>`).join("")}<th>Restrictions</th></tr></thead><tbody>${rows.join("")}</tbody></table></div>`;
}

function contacts(book: BookModel): string {
  const KINDS: [string, string][] = [["STATE_HQ", "State Headquarters"], ["HOTLINE", "Hotlines"], ["REGIONAL_HQ", "Regional Headquarters"], ["FIELD_OFFICE", "Field Offices"], ["STATE_AGENCY", "State Agencies"], ["FEDERAL", "Federal Agencies"], ["TRIBAL", "Tribal Governments"], ["BEAR_SPECIALIST", "Bear Specialists"], ["OTHER", "Other"]];
  const out: string[] = [];
  for (const [k, label] of KINDS) {
    const rows = book.contacts.filter((c) => c.kind === k);
    if (!rows.length) continue;
    out.push(`<h3>${label}</h3><ul class="contacts">` + rows.map((c) => {
      const bits = [c.address, c.city].filter(Boolean).join(", ");
      const ph = [c.phone, c.phone2].filter(Boolean).join(" / ");
      return `<li><strong>${escapeHtml(c.name)}</strong>${ph ? ` — ${escapeHtml(ph)}` : ""}${bits ? `<span class="ref"> · ${escapeHtml(bits)}</span>` : ""}${c.note ? `<div class="chart-note">${escapeHtml(c.note)}</div>` : ""}</li>`;
    }).join("") + `</ul>`);
  }
  return out.join("");
}

function sunrise(book: BookModel): string {
  const out: string[] = [`<p class="ref">Authorized hunting hours begin one-half hour before sunrise and end one-half hour after sunset. Official Commission-adopted tables (do not use other sources).</p>`];
  for (const z of book.sunrise) {
    out.push(`<div class="ss-zone"><h3>Zone ${z.zoneNo}${z.zoneName ? ` — ${escapeHtml(z.zoneName)}` : ""}</h3>` +
      `<div class="ref ss-counties">${escapeHtml(z.counties.join(", "))}</div>`);
    const byDay = new Map<number, Record<number, { rise: number; set: number }>>();
    for (const t of z.times) { const m = byDay.get(t.day) ?? {}; m[t.month] = { rise: t.rise, set: t.set }; byDay.set(t.day, m); }
    const days = [...byDay.keys()].sort((a, b) => a - b);
    const header = `<tr><th>Day</th>${MONTHS.map((m) => `<th colspan="2">${MONTH_LABEL[m]}</th>`).join("")}</tr><tr><th></th>${MONTHS.map(() => `<th>Rise</th><th>Set</th>`).join("")}</tr>`;
    const body = days.map((day) => {
      const row = byDay.get(day)!;
      return `<tr><td class="num">${day}</td>${MONTHS.map((m) => { const v = row[m]; return v ? `<td class="num">${hhmm(v.rise)}</td><td class="num">${hhmm(v.set)}</td>` : `<td>-</td><td>-</td>`; }).join("")}</tr>`;
    }).join("");
    out.push(`<table class="ss-grid"><thead>${header}</thead><tbody>${body}</tbody></table></div>`);
  }
  return out.join("");
}

// ── stylesheet (5.5in × 8.5in trim) ──────────────────────────────────────────
const CSS = `
@page { size: 5.5in 8.5in; margin: 0.4in 0.38in; }
* { box-sizing: border-box; }
body { font-family: "Georgia", "Times New Roman", serif; color: #1a1a1a; font-size: 8pt; line-height: 1.35; margin: 0; }
h2.chapter, h3, .district, .species-head, table, figure { break-inside: avoid; }
.page-break { page-break-before: always; }
h2.chapter { font-family: "Helvetica Neue", Arial, sans-serif; font-size: 12pt; font-weight: 800; color: #fff; padding: 5px 8px; margin: 0 0 8px; letter-spacing: 0.01em; }
h3 { font-family: "Helvetica Neue", Arial, sans-serif; font-size: 10pt; color: #002855; margin: 10px 0 3px; border-bottom: 1px solid #ccc; padding-bottom: 2px; }
h3.region-head { background: #ffd8a8; color: #7a3e00; border: none; padding: 3px 6px; }
.ref { color: #666; font-weight: 400; font-size: 7pt; font-style: italic; }
.prose p { margin: 3px 0; }
.prose table { width: 100%; border-collapse: collapse; font-size: 7pt; margin: 4px 0; }
.prose th, .prose td { border: 0.5px solid #bbb; padding: 2px 4px; text-align: left; vertical-align: top; }
.prose th { background: #eceef1; }
.cover { text-align: center; padding-top: 2in; page-break-after: always; }
.cover-yr { font-family: "Helvetica Neue", Arial, sans-serif; font-size: 54pt; font-weight: 900; color: #002855; }
.cover-title { font-family: "Helvetica Neue", Arial, sans-serif; font-size: 24pt; font-weight: 800; letter-spacing: 0.06em; margin-top: 6px; }
.cover-sub { font-size: 12pt; color: #B3252E; margin-top: 6px; letter-spacing: 0.08em; }
.cover-note { font-size: 8pt; color: #888; margin-top: 1.5in; font-style: italic; }
.toc ol { columns: 2; font-size: 8.5pt; padding-left: 16px; }
.toc a { color: #002855; text-decoration: none; }
table.fees, table.dates, table.district-table, table.ss-grid { width: 100%; border-collapse: collapse; margin: 4px 0; }
.fees th, .fees td, .dates td, .district-table th, .district-table td { border: 0.5px solid #bbb; padding: 2px 4px; vertical-align: top; }
.fees th { background: #046A38; color: #fff; font-size: 6.5pt; }
.fees .lname { width: 46%; }
.chart-note { color: #666; font-size: 6.5pt; font-style: italic; margin-top: 1px; }
.num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
.dates td { border: none; border-bottom: 0.5px solid #e2e2e2; font-size: 8pt; }
.dates .when { text-align: right; white-space: nowrap; color: #002855; font-weight: 600; }
.district { background: #dfe4ea; font-weight: 700; padding: 3px 6px; margin-top: 8px; font-family: "Helvetica Neue", Arial, sans-serif; font-size: 8.5pt; }
.note { font-size: 7pt; color: #444; font-style: italic; padding: 1px 6px; }
.district-block { margin-bottom: 6px; }
.district-table { font-size: 6.2pt; }
.district-table th { background: #002855; color: #fff; font-size: 6pt; text-align: left; }
.district-table td.sd, .district-table th.sd { white-space: nowrap; }
.district-table td.restr { font-size: 6pt; color: #333; }
.species-head td { background: #046A38; color: #fff; font-weight: 700; font-size: 6.5pt; }
.rarea { margin: 4px 0; padding-bottom: 3px; border-bottom: 0.5px solid #eee; }
.rarea-desc { font-size: 7pt; color: #333; margin-top: 1px; }
.contacts { list-style: none; padding-left: 0; font-size: 8pt; }
.contacts li { margin: 2px 0; }
.map-grid { display: flex; flex-wrap: wrap; gap: 8px; }
.map-slot { margin: 0; width: 47%; }
.map-box { border: 1.5px dashed #999; background: repeating-linear-gradient(45deg,#f4f5f7,#f4f5f7 8px,#eceef1 8px,#eceef1 16px); height: 1.6in; display: flex; align-items: center; justify-content: center; color: #aaa; font-family: "Helvetica Neue", Arial, sans-serif; font-weight: 800; font-size: 10pt; }
.map-slot figcaption { font-size: 7pt; color: #444; margin-top: 2px; }
.ss-zone { break-inside: avoid; margin-top: 8px; }
.ss-counties { margin-bottom: 3px; }
.ss-grid { font-size: 5pt; }
.ss-grid th, .ss-grid td { border: 0.3px solid #ccc; padding: 0.5px 1px; text-align: center; }
.ss-grid th { background: #eceef1; }
`;
