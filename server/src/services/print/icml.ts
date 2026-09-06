/**
 * @file icml.ts
 * @module engage-mt/server/services/print
 * @description Generates the ICML (InCopy Interchange) story package from the BookModel —
 *              one .icml story per region + front matter, fees, restricted areas, keyed to
 *              named paragraph/character/table/cell styles the designer maps in the
 *              InDesign template. Native ICML <Table> for the 10-column district layout.
 *              Images are NOT embedded — a manifest lists which CMS map goes on which story
 *              (linked placement in InDesign is correct print practice).
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-04
 * @updated 2026-07-07
 * @version 1.1.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import type { BookModel } from "./bookModel.js";
import { BOOK_SEASON_COLS, bookSeasonLabel } from "./bookModel.js";
import type { ZipEntry } from "./zip.js";

const xml = (s: string): string => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

let idCounter = 0;
const nextId = (p: string) => `${p}${++idCounter}`;

function para(styleName: string, text: string, charStyle = "$ID/[No character style]"): string {
  return `<ParagraphStyleRange AppliedParagraphStyle="ParagraphStyle/${styleName}">` +
    `<CharacterStyleRange AppliedCharacterStyle="CharacterStyle/${charStyle}"><Content>${xml(text)}</Content></CharacterStyleRange>` +
    `<Br/></ParagraphStyleRange>`;
}

function cell(row: number, col: number, styleName: string, paraStyle: string, text: string): string {
  return `<Cell Self="${nextId("cell")}" Name="${col}:${row}" AppliedCellStyle="CellStyle/${styleName}" RowSpan="1" ColumnSpan="1">` +
    `<ParagraphStyleRange AppliedParagraphStyle="ParagraphStyle/${paraStyle}"><CharacterStyleRange><Content>${xml(text)}</Content></CharacterStyleRange></ParagraphStyleRange></Cell>`;
}

function table(headers: string[], rows: string[][], widths: number[]): string {
  const self = nextId("tbl");
  const cols = headers.length;
  const colEls = headers.map((_, i) => `<Column Self="${self}c${i}" Name="${i}" SingleColumnWidth="${widths[i] ?? 60}"/>`).join("");
  const headerCells = headers.map((h, c) => cell(0, c, "Header", "TableHeader", h)).join("");
  const bodyCells = rows.map((r, ri) => r.map((v, c) => cell(ri + 1, c, "Body", "TableBody", v)).join("")).join("");
  return `<Table Self="${self}" AppliedTableStyle="TableStyle/DistrictTable" HeaderRowCount="1" FooterRowCount="0" BodyRowCount="${rows.length}" ColumnCount="${cols}">` +
    colEls + headerCells + bodyCells + `</Table>`;
}

function story(bodyXml: string): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
    `<?aid style="50" type="snippet" readerVersion="6.0" featureSet="513" product="8.0(370)" ?>\n` +
    `<?aid SnippetType="InCopyInterchange"?>\n` +
    `<Document DOMVersion="8.0" Self="d_${nextId("doc")}">` +
    `<Story Self="${nextId("story")}" AppliedTOCStyle="n" TrackChanges="false" StoryTitle="regs" AppliedNamedGrid="n">` +
    bodyXml + `</Story></Document>`;
}

const SEASON_COLS = BOOK_SEASON_COLS;
const HEADERS = ["License / Permit", "Opportunity", "Apply / OTC", "Quota", ...SEASON_COLS.map(bookSeasonLabel), "Restrictions"];
// Column widths (points) summing to the 5.5in booklet text area (5.5in − 2×0.38in ≈ 4.74in ≈
// 341pt). The InDesign template document setup is 5.5×8.5 (see styles.md); these widths fit it.
const WIDTHS = [50, 50, 30, 22, 27, 27, 27, 30, 27, 50];

export interface IcmlPackage { entries: ZipEntry[]; manifest: unknown }

export function buildIcmlPackage(book: BookModel): IcmlPackage {
  idCounter = 0;
  const entries: ZipEntry[] = [];
  const manifest: { placement: string; assetKind: string; targetStory: string }[] = [];

  // Front matter: content sections.
  let front = para("SectionTitle", `${book.seasonYear} Deer · Elk · Antelope Hunting Regulations`);
  for (const c of book.content) {
    front += para("SectionTitle", c.title + (c.statuteRefs ? ` (${c.statuteRefs})` : ""));
    for (const line of c.bodyMd.split(/\n{2,}/)) if (line.trim()) front += para("BodyText", line.replace(/\s+/g, " ").trim());
  }
  entries.push({ name: "stories/010-front-matter.icml", content: story(front) });

  // Important dates.
  if (book.importantDates.length) {
    const dRows = book.importantDates.map((d) => [d.label + (d.speciesScope ? ` (${d.speciesScope})` : ""), d.startsOn ? (d.endsOn ? `${d.startsOn} – ${d.endsOn}` : d.startsOn) : (d.note ?? "")]);
    entries.push({ name: "stories/050-important-dates.icml", content: story(para("SectionTitle", "Important Dates") + table(["Item", "When"], dRows, [230, 111])) });
  }

  // Fees.
  if (book.fees.length) {
    const aud = ["RES", "RES_YOUTH", "NR", "NR_NATIVE"];
    const feeRows = book.fees.map((f) => [f.name, ...aud.map((a) => (f.prices[a] != null ? `$${(f.prices[a]! / 100).toLocaleString()}` : "-"))]);
    entries.push({ name: "stories/100-fees.icml", content: story(para("SectionTitle", "License & Permit Fees") + table(["Product", ...aud], feeRows, [161, 45, 45, 45, 45])) });
  }

  // Contacts.
  if (book.contacts.length) {
    let cx = para("SectionTitle", "Contact List");
    for (const c of book.contacts) {
      const ph = [c.phone, c.phone2].filter(Boolean).join(" / ");
      cx += para("BodyText", `${c.name}${ph ? ` — ${ph}` : ""}${[c.address, c.city].filter(Boolean).length ? ` · ${[c.address, c.city].filter(Boolean).join(", ")}` : ""}`);
    }
    entries.push({ name: "stories/900-contacts.icml", content: story(cx) });
  }

  // One story per region.
  for (const region of book.regions) {
    let body = para("RegionHeader", `Region ${region.regionId} — Deer & Elk / Antelope Regulations`);
    for (const d of region.districts) {
      body += para("DistrictHeader", `HD ${d.districtCode}${d.districtName ? ` — ${d.districtName}` : ""}`);
      for (const n of d.notes) body += para("NoteText", `NOTE: ${n}`);
      const rows = d.opps.map((o) => [o.instrumentName, o.legalAnimal, o.applyBy, o.quota, ...SEASON_COLS.map((c) => o.windows[c] ?? "-"), o.restrictions]);
      body += table(HEADERS, rows, WIDTHS);
    }
    const storyName = `stories/${200 + region.regionId}-region-${region.regionId}.icml`;
    entries.push({ name: storyName, content: story(body) });
    manifest.push({ placement: `region-${region.regionId}`, assetKind: "REGION_MAP", targetStory: storyName });
  }

  // Restricted areas.
  if (book.restrictedAreas.length) {
    let ra = para("SectionTitle", "Restricted Area Descriptions");
    for (const a of book.restrictedAreas) {
      ra += para("DistrictHeader", `${a.areaName} (${a.areaType})`);
      if (a.legalDesc) ra += para("BodyText", a.legalDesc);
    }
    entries.push({ name: "stories/230-restricted-areas.icml", content: story(ra) });
  }

  const styleSheet = STYLE_SHEET_MD;
  entries.push({ name: "styles.md", content: styleSheet });
  entries.push({ name: "manifest.json", content: JSON.stringify(manifest, null, 2) });
  return { entries, manifest };
}

const STYLE_SHEET_MD = `# ICML style sheet — map these named styles in your InDesign template

## Document setup (the printed booklet)
Page size: **5.5 in wide × 8.5 in tall** (portrait). Margins ~0.38–0.4 in. The ICML tables are
sized to this text area (~341 pt wide); if your template uses a different trim, adjust the
DistrictTable column widths to match.

## Styles
Paragraph styles: SectionTitle, RegionHeader, DistrictHeader, TableHeader, TableBody, NoteText, BodyText.
Character styles: (default).
Table styles: DistrictTable.
Cell styles: Header, Body.

Each stories/*.icml is placed (File > Place) into the template; styles bind by NAME.
manifest.json lists which CMS map asset goes on which region story (place as a linked image).
`;
