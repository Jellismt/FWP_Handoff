#!/usr/bin/env node
/**
 * @file sourceFiles.mjs
 * @module engage-mt/scripts
 * @description Tiny shared helper for the QC scripts: the repo root and a plain
 *              filesystem walk of `web/src`. Used by `check-gis-registry.mjs`
 *              (REPO_ROOT) and `check-orphans.mjs` (the file list). No git
 *              history is consulted — this is just a directory walk.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-03
 * @updated 2026-07-21
 * @version 3.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { readdirSync } from "node:fs";
import { join, dirname, resolve, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

/** Absolute repo root — this file lives at <root>/scripts/qc/. */
export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

const SKIP_DIRS = new Set(["node_modules", "dist", "coverage", ".vite"]);

function walk(dir, out) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) walk(join(dir, entry.name), out);
    } else if (/\.(ts|tsx|css)$/.test(entry.name)) {
      out.push(join(dir, entry.name));
    }
  }
}

/**
 * Every `web/src` source file (repo-relative, forward-slash paths), sorted.
 */
export function listSourceFiles() {
  const abs = [];
  walk(join(REPO_ROOT, "web", "src"), abs);
  return abs.map((p) => relative(REPO_ROOT, p).split(sep).join("/")).sort();
}
