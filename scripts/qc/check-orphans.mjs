#!/usr/bin/env node
/**
 * @file check-orphans.mjs
 * @module engage-mt/scripts
 * @description — ADVISORY orphan-file detector (NOT wired into
 *              `verify`; run before releases or monthly). Walks the import
 *              graph from the app entries and reports web/src files nothing
 *              reaches — deletion candidates, each to be
 *              VERIFIED by hand before deletion (dynamic import(), test-only
 *              helpers, and vite-glob patterns can fool a static walk).
 *
 *              Resolution understands: the `@/` alias, relative paths,
 *              index files, and .ts/.tsx extension inference. Roots: main.tsx
 *              + App.tsx + every *.test.* file (a file only reached by its
 *              test still shows up — as reachable-from-tests-only via the
 *              second pass) + config files Vite loads directly.
 *
 *              Usage: node scripts/qc/check-orphans.mjs   (always exits 0)
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-03
 * @updated 2026-07-03
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { REPO_ROOT, listSourceFiles } from "./sourceFiles.mjs";

const SRC = "web/src";

// fs-walk of web/src (git-free build) + the same extension filter.
const files = listSourceFiles().filter((f) => /\.(ts|tsx)$/.test(f));
const fileSet = new Set(files);

/** Resolve an import specifier from `fromFile` to a repo-relative file, or null. */
const resolve = (fromFile, spec) => {
  let base = null;
  if (spec.startsWith("@/")) base = `${SRC}/${spec.slice(2)}`;
  else if (spec.startsWith(".")) {
    const dir = fromFile.slice(0, fromFile.lastIndexOf("/"));
    const parts = `${dir}/${spec}`.split("/");
    const out = [];
    for (const p of parts) {
      if (p === "." || p === "") continue;
      else if (p === "..") out.pop();
      else out.push(p);
    }
    base = out.join("/");
  } else return null; // package import
  for (const cand of [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`]) {
    if (fileSet.has(cand)) return cand;
  }
  return null;
};

const IMPORT_RE = /(?:from|import|vi\.mock)\s*\(?\s*["']([^"']+)["']/g;

const edges = new Map();
for (const f of files) {
  const src = readFileSync(join(REPO_ROOT, f), "utf8");
  const targets = new Set();
  for (const m of src.matchAll(IMPORT_RE)) {
    const t = resolve(f, m[1]);
    if (t) targets.add(t);
  }
  edges.set(f, targets);
}

const walk = (roots) => {
  const seen = new Set(roots.filter((r) => fileSet.has(r)));
  const queue = [...seen];
  while (queue.length) {
    for (const t of edges.get(queue.pop()) ?? []) {
      if (!seen.has(t)) {
        seen.add(t);
        queue.push(t);
      }
    }
  }
  return seen;
};

const appRoots = [`${SRC}/main.tsx`, `${SRC}/App.tsx`, `${SRC}/vite-env.d.ts`];
const testRoots = files.filter((f) => f.includes(".test.") || f.startsWith(`${SRC}/test/`));

const fromApp = walk(appRoots);
const fromAnywhere = walk([...appRoots, ...testRoots]);

const testOnly = files.filter((f) => !fromApp.has(f) && fromAnywhere.has(f) && !f.includes(".test.") && !f.startsWith(`${SRC}/test/`));
const orphans = files.filter((f) => !fromAnywhere.has(f));

console.log(`Import-graph walk: ${files.length} files · ${fromApp.size} reachable from app entries.`);
console.log(`\nUnreachable from ANYTHING (verify by hand before deleting): ${orphans.length}`);
for (const f of orphans) console.log(`  ${f}`);
console.log(`\nReachable ONLY from tests (source may be dead, test included): ${testOnly.length}`);
for (const f of testOnly) console.log(`  ${f}`);
console.log("\nAdvisory only — dynamic import()/glob patterns can fool this walk. Always verify.");
process.exit(0);
