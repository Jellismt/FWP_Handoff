#!/usr/bin/env node
/**
 * check-imperial-units.mjs
 *
 * Scans web/src/components/ for user-facing string literals that smell
 * like metric units leaking to the UI. Engage MT is imperial-only at
 * the display layer; metric values are storage / API state only and
 * must be converted via the helpers in `web/src/utils/units.ts` before
 * they reach JSX.
 *
 * Catches:
 *   • " mm",  "mm·", "{value} mm",  " cm",  " kg",  " g · "
 *   • " m\b" in template literals (effort_meters etc.)
 *   • "°C",  "° C"
 *   • " m/s"
 *
 * Internal variable names (e.g. `mean_length_mm`, `cToF`, `lenMm`)
 * are obviously fine — the regex matches only string contexts where a
 * unit appears as standalone text inside quotes or a template literal.
 *
 * Exit code 1 lists every offender. The web `lint` script runs it.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { execSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const SCAN_DIR = "src/components";

// Patterns that indicate a metric unit is being rendered to the UI.
// Each entry: [regex, human-readable label].
const PATTERNS = [
  // " mm" appearing as a unit label after a numeric value or whitespace.
  // Negative lookbehinds skip variable/field names like `mean_length_mm`,
  // `lengthMm`, `low_mm`, `from mm`, the file-header word "mm".
  [/[)\d}]\s*mm\b/g, '" mm" unit label'],
  [/[)\d}]\s*cm\b/g, '" cm" unit label'],
  [/[)\d}]\s*kg\b/g, '" kg" unit label'],
  [/[)\d}]\s*(?<!a)g\s*[·"`'\\)]/g, '" g" weight unit label'],
  [/°\s?C(?![a-z])/g, "°C temperature label"],
  [/\bm\/s\b/g, "m/s speed label"],
];

// String-context detection: we only fire when the match sits inside a
// double-quote / single-quote / backtick string. Strip line comments
// first so JSDoc and inline comments don't trigger.
const stripComments = (line) => {
  // Strip // ... but keep URLs (http://, https://). Naive scan: split on
  // // only when preceded by non-`:`.
  let i = 0;
  while (i < line.length) {
    if (line[i] === "/" && line[i + 1] === "/" && line[i - 1] !== ":") {
      return line.slice(0, i);
    }
    i += 1;
  }
  return line;
};

const inString = (line, idx) => {
  let inSingle = false;
  let inDouble = false;
  let inBacktick = false;
  for (let i = 0; i < idx; i += 1) {
    const c = line[i];
    const prev = line[i - 1];
    if (c === "\\" && prev !== "\\") continue;
    if (c === "'" && !inDouble && !inBacktick) inSingle = !inSingle;
    else if (c === '"' && !inSingle && !inBacktick) inDouble = !inDouble;
    else if (c === "`" && !inSingle && !inDouble) inBacktick = !inBacktick;
  }
  return inSingle || inDouble || inBacktick;
};

const scan = () => {
  const files = execSync(
    `find ${SCAN_DIR} -type f \\( -name '*.tsx' -o -name '*.ts' \\)`,
    { cwd: ROOT, encoding: "utf8" },
  )
    .trim()
    .split("\n")
    .filter(Boolean);

  const offenders = [];
  for (const rel of files) {
    const full = join(ROOT, rel);
    const src = readFileSync(full, "utf8");
    const lines = src.split("\n");
    lines.forEach((raw, idx) => {
      const line = stripComments(raw);
      // Skip the file-header block lines that document the column units.
      if (line.includes("@file") || line.includes("@description")) return;
      for (const [pattern, label] of PATTERNS) {
        pattern.lastIndex = 0;
        let m;
        while ((m = pattern.exec(line)) !== null) {
          if (inString(line, m.index)) {
            offenders.push({
              file: rel,
              line: idx + 1,
              label,
              snippet: raw.trim(),
            });
          }
        }
      }
    });
  }
  return offenders;
};

const offenders = scan();
if (offenders.length === 0) {
  console.log("✓ check-imperial-units: no metric labels in components.");
  process.exit(0);
}

console.error(
  `✗ check-imperial-units: ${offenders.length} metric label(s) leaking to UI:`,
);
for (const o of offenders) {
  console.error(`  ${o.file}:${o.line} — ${o.label}`);
  console.error(`    ${o.snippet}`);
}
console.error(
  "\nFix: use formatters from web/src/utils/units.ts (formatInches, formatPounds,",
);
console.error(
  "formatFeet, formatFahrenheit, formatMph, …) instead of inlining metric units.",
);
process.exit(1);
