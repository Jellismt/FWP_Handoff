#!/usr/bin/env node
/**
 * @file copy-calcite-assets.mjs
 * @module engage-mt/scripts
 * @description Copies the Calcite component assets from node_modules into
 *              `web/public/calcite-assets/assets`, pruned to what this app
 *              uses: every component's English message bundle, and only the
 *              icons named in `web/calcite-assets.allowlist.json` (all sizes and
 *              filled variants). The full icon set is 18 MB / ~4,500 files and
 *              would otherwise ship inside the web bundle and both native apps.
 *
 *              Runs at web's `postinstall`. `--check` verifies that every icon
 *              literal in `web/src` is allow-listed (so a new icon cannot 404
 *              in production) and exits 1 on drift; `npm run verify` runs it.
 * @author Jamie Ellis / Engage MT
 * @created 2026-09-06
 * @updated 2026-09-06
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const WEB_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const ALLOWLIST_PATH = resolve(WEB_ROOT, "calcite-assets.allowlist.json");
const DEST = resolve(WEB_ROOT, "public", "calcite-assets", "assets");
const SOURCE_CANDIDATES = [
  "../node_modules/@esri/calcite-components/dist/cdn/assets",
  "../node_modules/@esri/calcite-components/dist/calcite/assets",
  "node_modules/@esri/calcite-components/dist/cdn/assets",
  "node_modules/@esri/calcite-components/dist/calcite/assets",
].map((p) => resolve(WEB_ROOT, p));

/** Calcite icon files are named `<camelCase><size>[F].json`; props use kebab-case. */
export const camel = (kebab) => kebab.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());

/** Every asset file name an icon name can resolve to (16/24/32, outline + filled). */
export const iconFileNames = (kebab) =>
  ["16", "24", "32"].flatMap((size) => [`${camel(kebab)}${size}.json`, `${camel(kebab)}${size}F.json`]);

/**
 * Decide which source files (relative POSIX paths under `assets/`) to keep.
 * Pure so the rules are unit-testable without touching the disk.
 */
export function planCalciteCopy({ allowlist, sourceFiles }) {
  const iconFiles = new Set(allowlist.icons.flatMap(iconFileNames));
  const locales = new Set(allowlist.t9nLocales);
  const keep = [];
  const seen = new Map(allowlist.icons.map((name) => [name, false]));
  for (const file of sourceFiles) {
    const parts = file.split("/");
    if (parts[0] === "icon") {
      if (iconFiles.has(parts[1])) {
        keep.push(file);
        for (const name of allowlist.icons) {
          if (iconFileNames(name).includes(parts[1])) seen.set(name, true);
        }
      }
      continue;
    }
    const t9n = /^messages(?:\.([a-z-]+))?\.json$/i.exec(parts.at(-1) ?? "");
    if (parts.at(-2) === "t9n" && t9n) {
      if (!t9n[1] || locales.has(t9n[1])) keep.push(file);
      continue;
    }
    keep.push(file);
  }
  const missingIcons = [...seen].filter(([, found]) => !found).map(([name]) => name);
  return { keep, missingIcons };
}

/** Icon names referenced as literals in the app's JSX (`icon="x"` / `icon={"x" as never}`). */
export function iconLiteralsIn(source) {
  const names = new Set();
  for (const m of source.matchAll(/\bicon=(?:"([a-z0-9-]+)"|\{\s*"([a-z0-9-]+)")/g)) {
    names.add(m[1] ?? m[2]);
  }
  return names;
}

const listFiles = (root) => {
  const out = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else out.push(relative(root, full).split(sep).join("/"));
    }
  };
  walk(root);
  return out;
};

const loadAllowlist = () => JSON.parse(readFileSync(ALLOWLIST_PATH, "utf8"));

function check() {
  const allowlist = loadAllowlist();
  const allowed = new Set(allowlist.icons);
  const used = new Map();
  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.tsx?$/.test(entry) && !/\.test\./.test(entry)) {
        for (const name of iconLiteralsIn(readFileSync(full, "utf8"))) {
          if (!used.has(name)) used.set(name, relative(WEB_ROOT, full));
        }
      }
    }
  };
  walk(resolve(WEB_ROOT, "src"));
  const missing = [...used].filter(([name]) => !allowed.has(name));
  if (missing.length > 0) {
    console.error("✗ Calcite icons used in web/src but absent from calcite-assets.allowlist.json:");
    for (const [name, file] of missing) console.error(`    ${name}  (${file})`);
    console.error("  Add each name to the allowlist so the icon ships with the app.");
    process.exit(1);
  }
  console.log(`✓ calcite icon allowlist covers ${used.size} icon names used in web/src`);
}

function copy() {
  const src = SOURCE_CANDIDATES.find((p) => existsSync(p));
  if (!src) {
    console.error("❌ Calcite assets not found under node_modules — run npm install at the repo root first.");
    process.exit(1);
  }
  const allowlist = loadAllowlist();
  const { keep, missingIcons } = planCalciteCopy({ allowlist, sourceFiles: listFiles(src) });
  if (missingIcons.length > 0) {
    console.error(`❌ Allow-listed Calcite icons with no asset file: ${missingIcons.join(", ")}`);
    process.exit(1);
  }
  rmSync(DEST, { recursive: true, force: true });
  let bytes = 0;
  for (const file of keep) {
    const from = join(src, file);
    const to = join(DEST, file);
    mkdirSync(dirname(to), { recursive: true });
    cpSync(from, to);
    bytes += statSync(to).size;
  }
  const icons = keep.filter((f) => f.startsWith("icon/")).length;
  console.log(
    `✅ Copied ${keep.length} Calcite asset files (${icons} icon files, ${(bytes / 1024).toFixed(0)} KB) to ${relative(WEB_ROOT, DEST)}`,
  );
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  if (process.argv.includes("--check")) check();
  else copy();
}
