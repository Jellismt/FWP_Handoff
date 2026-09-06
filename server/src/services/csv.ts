/**
 * @file csv.ts
 * @module engage-mt/server/services
 * @description Minimal RFC 4180 CSV serializer for staff exports. Every cell
 *              is quoted when it contains a comma, quote, or line break;
 *              cells that would be read as a formula by a spreadsheet
 *              (`=`, `+`, `-`, `@`, tab, carriage return) are prefixed with an
 *              apostrophe so an exported audit row can never execute on open.
 * @author Jamie Ellis / Engage MT
 * @created 2026-09-06
 * @updated 2026-09-06
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

const FORMULA_LEAD = /^[=+\-@\t\r]/;

export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let text = typeof value === "object" ? JSON.stringify(value) : String(value);
  if (FORMULA_LEAD.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Rows → CSV text with a header line, `\r\n` line ends, and the given column order. */
export function toCsv(rows: ReadonlyArray<Record<string, unknown>>, columns: readonly string[]): string {
  const lines = [columns.map(csvCell).join(",")];
  for (const row of rows) lines.push(columns.map((c) => csvCell(row[c])).join(","));
  return `${lines.join("\r\n")}\r\n`;
}
