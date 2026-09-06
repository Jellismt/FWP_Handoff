#!/usr/bin/env node
/**
 * QC — Stub-registry audit. Asserts the three contracts that keep the
 * stub system honest:
 *
 *   1. Every `.stub.ts` file under `web/src/services/stubs/` is
 *      registered in `web/src/services/stubs/registry.ts` (catches
 *      orphaned stub files that ship without a swap-status entry).
 *   2. Every entry in the registry whose `file` is non-null exists on
 *      disk (catches deleted-but-not-unregistered drift).
 *   3. Every registry entry whose `swapDoc` is non-null exists in
 *      `docs/stubs/` (catches doc-drift — a stub without a contract
 *      doc has no way for FWP to plan the swap).
 *
 * Wired to `npm run check:stubs` (part of verify).
 *
 * Per docs/rules/data-stubs.md.
 *
 * Usage:
 *   node scripts/qc/stub-registry-audit.mjs
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "..", "..");
const STUBS_DIR = resolve(REPO_ROOT, "web", "src", "services", "stubs");
const REGISTRY_PATH = resolve(STUBS_DIR, "registry.ts");
const STUB_DOCS_DIR = resolve(REPO_ROOT, "docs", "stubs");

const registry = readFileSync(REGISTRY_PATH, "utf8");

// Cheap extraction — parse `file: "x"` and `swapDoc: "y"` literal
// occurrences from the registry. The registry is hand-edited and these
// fields are always string literals, so this works without spinning up
// a TS parser.
const fileRegex = /file:\s*"([^"]+)"/g;
const swapDocRegex = /swapDoc:\s*"([^"]+)"/g;
const idRegex = /id:\s*"(STUB-\d{3})"/g;

const registeredFiles = new Set();
const registeredDocs = new Set();
const ids = [];

for (const m of registry.matchAll(fileRegex)) registeredFiles.add(m[1]);
for (const m of registry.matchAll(swapDocRegex)) registeredDocs.add(m[1]);
for (const m of registry.matchAll(idRegex)) ids.push(m[1]);

const violations = [];

// (1) Every .stub.ts file is in the registry (except the registry itself
// and any test/README peers).
const onDiskStubs = readdirSync(STUBS_DIR).filter((f) => f.endsWith(".stub.ts"));
for (const f of onDiskStubs) {
  if (!registeredFiles.has(f)) {
    violations.push({ kind: "orphan-stub-file", file: f });
  }
}

// (2) Every registry `file` points to a real path.
for (const f of registeredFiles) {
  const abs = resolve(STUBS_DIR, f);
  if (!existsSync(abs)) {
    violations.push({ kind: "missing-stub-file", file: f });
  }
}

// (3) Every registry `swapDoc` points to a real path.
for (const d of registeredDocs) {
  const abs = resolve(REPO_ROOT, d);
  if (!existsSync(abs)) {
    violations.push({ kind: "missing-swap-doc", doc: d });
  }
}

// (4) Stub IDs are unique.
const seen = new Set();
for (const id of ids) {
  if (seen.has(id)) {
    violations.push({ kind: "duplicate-id", id });
  }
  seen.add(id);
}

if (violations.length === 0) {
  console.log(
    `OK — registry holds ${ids.length} stubs, ` +
      `${onDiskStubs.length} *.stub.ts on disk, ` +
      `${registeredDocs.size} swap docs all present.`,
  );
  process.exit(0);
}

console.error("Stub registry violations:");
for (const v of violations) {
  console.error("  •", JSON.stringify(v));
}
process.exit(1);
