#!/usr/bin/env node
/**
 * QC — Manifest audit. Verifies every Tier-2 dataset entry in
 * `web/public/data/data-manifest.json` carries `effectiveDate` + `source`
 * (per `docs/rules/data-freshness.md`).
 *
 * Exits non-zero on the first missing field so CI fails loudly. Use the
 * `--json` flag for machine-readable output.
 *
 * Wired to `npm run check:manifest` (part of verify).
 *
 * Usage:
 *   node scripts/qc/manifest-audit.mjs
 *   node scripts/qc/manifest-audit.mjs --json
 */

import { readFileSync } from "node:fs";

const JSON_OUT = process.argv.includes("--json");
const MANIFEST_PATH = new URL("../../web/public/data/data-manifest.json", import.meta.url);

const REQUIRED_FIELDS = ["effectiveDate", "source"];

const manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));

const violations = [];

const looksLikeDatasetEntry = (node) =>
  node && typeof node === "object" && !Array.isArray(node) && ("file" in node || "path" in node);

const walk = (node, path = "$") => {
  if (Array.isArray(node)) {
    node.forEach((item, i) => walk(item, `${path}[${i}]`));
    return;
  }
  if (looksLikeDatasetEntry(node)) {
    for (const field of REQUIRED_FIELDS) {
      if (!(field in node)) {
        violations.push({ path, file: node.file ?? node.path ?? "?", missing: field });
      }
    }
  }
  if (node && typeof node === "object") {
    for (const [k, v] of Object.entries(node)) {
      walk(v, `${path}.${k}`);
    }
  }
};

walk(manifest);

if (JSON_OUT) {
  process.stdout.write(JSON.stringify({ violations }, null, 2));
} else if (violations.length === 0) {
  console.log("OK — every Tier-2 dataset entry carries effectiveDate + source.");
} else {
  console.error(`FAIL — ${violations.length} manifest entries missing required fields:`);
  for (const v of violations) {
    console.error(`  ${v.path} (${v.file}) — missing "${v.missing}"`);
  }
}

process.exit(violations.length === 0 ? 0 : 1);
