/**
 * @file check-doc-links.mjs
 * @module engage-mt/scripts
 * @description Documentation link-integrity gate. Resolves every relative
 *              markdown link to a .md/.html target across docs/, docs/rules/,
 *              and root *.md, plus every bare-text `docs/…(.md|.html)` mention in
 *              web/src, and fails if any target does not exist on disk. Added
 *              during the 2026-07 docs reorg so moves/renames can never silently
 *              orphan a link. Zero dependencies — plain Node ESM.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-01
 * @updated 2026-07-01
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve, join, relative } from "node:path";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** Recursively collect files under `dir` whose name passes `match`. */
function walk(dir, match, out = []) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    if (e.name === "node_modules" || e.name === ".git") continue;
    const full = join(dir, e.name);
    if (e.isDirectory()) walk(full, match, out);
    else if (match(e.name)) out.push(full);
  }
  return out;
}

const isMd = (n) => n.endsWith(".md");
const isCode = (n) => /\.(ts|tsx|css)$/.test(n);

// --- 1. Markdown-file link set ---------------------------------------------
const mdFiles = [
  ...walk(join(ROOT, "docs"), isMd),
  ...readdirSync(ROOT)
    .filter((n) => isMd(n))
    .map((n) => join(ROOT, n)),
];

const misses = [];

// Matches inline markdown links: ](target) and ](target "title").
const LINK_RE = /\]\(\s*([^)]+?)\s*\)/g;

for (const file of mdFiles) {
  const lines = readFileSync(file, "utf8").split("\n");
  lines.forEach((line, i) => {
    let m;
    LINK_RE.lastIndex = 0;
    while ((m = LINK_RE.exec(line)) !== null) {
      let target = m[1].trim();
      // Strip an optional link title: (path "Title") → path
      const sp = target.search(/\s/);
      if (sp !== -1) target = target.slice(0, sp);
      // Skip URLs, mail/tel, pure anchors, and angle-autolinks.
      if (/^(https?:|mailto:|tel:|#|<)/.test(target)) continue;
      const bare = target.split("#")[0]; // drop anchor
      if (!bare) continue;
      // Only guard the file types the reorg can move: .md / .html.
      if (!/\.(md|html)$/.test(bare)) continue;
      const resolved = resolve(dirname(file), bare);
      if (!existsSync(resolved)) {
        misses.push({
          file: relative(ROOT, file),
          line: i + 1,
          target,
          kind: "md-link",
        });
      }
    }
  });
}

// --- 2. Bare-text doc paths in source comments -----------------------------
// Catches stale `docs/…(.md|.html)` mentions in code (the drift class that
// nothing else gates). Resolved from repo root.
const codeFiles = walk(join(ROOT, "web", "src"), isCode);
const DOCPATH_RE = /docs\/[A-Za-z0-9_./-]+\.(?:md|html)/g;

for (const file of codeFiles) {
  const lines = readFileSync(file, "utf8").split("\n");
  lines.forEach((line, i) => {
    let m;
    DOCPATH_RE.lastIndex = 0;
    while ((m = DOCPATH_RE.exec(line)) !== null) {
      const p = m[0];
      // STUB-NNN.md is a template literal in registry docs, not a real file.
      if (/STUB-NNN\.md$/.test(p)) continue;
      if (!existsSync(join(ROOT, p))) {
        misses.push({ file: relative(ROOT, file), line: i + 1, target: p, kind: "code-ref" });
      }
    }
  });
}

// --- report -----------------------------------------------------------------
if (misses.length === 0) {
  console.log(
    `✓ doc links OK — ${mdFiles.length} markdown files + ${codeFiles.length} source files, 0 broken targets`,
  );
  process.exit(0);
}

console.error(`✗ ${misses.length} broken doc link(s):\n`);
for (const x of misses) {
  console.error(`  [${x.kind}] ${x.file}:${x.line} → ${x.target}`);
}
process.exit(1);
