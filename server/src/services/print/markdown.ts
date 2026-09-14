/**
 * @file markdown.ts
 * @module engage-mt/server/services/print
 * @description A tiny GFM subset renderer (headings, bold/italic, lists, pipe tables)
 *              shared by the HTML proof and the ICML exporter — which is why content-
 *              section tables live as GFM in body_md: they parse into real <table> /
 *              ICML <Table> structures, not opaque prose. Not a general markdown engine.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-04
 * @updated 2026-07-04
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

export interface MdTable { headers: string[]; rows: string[][] }
export type MdBlock =
  | { kind: "heading"; level: number; text: string }
  | { kind: "para"; text: string }
  | { kind: "list"; items: string[] }
  | { kind: "table"; table: MdTable };

/** Parse a GFM-subset string into structured blocks. */
export function parseMarkdown(md: string): MdBlock[] {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const blocks: MdBlock[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    if (line.trim() === "") { i++; continue; }
    // Table: a header row followed by a |---| separator.
    if (line.includes("|") && i + 1 < lines.length && /^\s*\|?[\s:|-]+\|?\s*$/.test(lines[i + 1]!) && lines[i + 1]!.includes("-")) {
      const headers = splitRow(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i]!.includes("|") && lines[i]!.trim() !== "") { rows.push(splitRow(lines[i]!)); i++; }
      blocks.push({ kind: "table", table: { headers, rows } });
      continue;
    }
    const h = /^(#{1,4})\s+(.*)$/.exec(line);
    if (h) { blocks.push({ kind: "heading", level: h[1]!.length, text: h[2]!.trim() }); i++; continue; }
    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i]!)) { items.push(lines[i]!.replace(/^\s*[-*]\s+/, "").trim()); i++; }
      blocks.push({ kind: "list", items });
      continue;
    }
    // Paragraph: gather until blank.
    const buf: string[] = [];
    while (i < lines.length && lines[i]!.trim() !== "" && !/^(#{1,4})\s/.test(lines[i]!) && !/^\s*[-*]\s+/.test(lines[i]!)) { buf.push(lines[i]!); i++; }
    blocks.push({ kind: "para", text: buf.join(" ") });
  }
  return blocks;
}

function splitRow(line: string): string[] {
  return line.replace(/^\s*\|/, "").replace(/\|\s*$/, "").split("|").map((c) => c.trim());
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Inline **bold** / *italic* → HTML (after escaping). */
export function inlineHtml(s: string): string {
  return escapeHtml(s)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>");
}

/** Render blocks → HTML fragment. */
export function markdownToHtml(md: string): string {
  return parseMarkdown(md).map((b) => {
    switch (b.kind) {
      case "heading": return `<h${b.level}>${inlineHtml(b.text)}</h${b.level}>`;
      case "para": return `<p>${inlineHtml(b.text)}</p>`;
      case "list": return `<ul>${b.items.map((it) => `<li>${inlineHtml(it)}</li>`).join("")}</ul>`;
      case "table": return `<table class="content-table"><thead><tr>${b.table.headers.map((h) => `<th>${inlineHtml(h)}</th>`).join("")}</tr></thead><tbody>${b.table.rows.map((r) => `<tr>${r.map((c) => `<td>${inlineHtml(c)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
    }
  }).join("\n");
}
