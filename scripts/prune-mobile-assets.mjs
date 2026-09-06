/**
 * @file prune-mobile-assets.mjs
 * @module engage-mt/scripts
 * @description Removes large assets from `web/dist` that the MOBILE app doesn't
 *              need bundled, right after the web build and BEFORE `npx cap sync`
 *              copies `web/dist` into the native projects. Today it drops the
 *              regs PDFs (`web/dist/regs/*.pdf`, ~134 MB in-APK) — they stay in
 *              the repo + on the web deploy, and on mobile the citation resolver
 *              (`regsPdfPath` in services/regs/useRegsIndex.ts) opens the hosted
 *              copy online. The 8.9 KB `regs-index.json` is KEPT so the citation
 *              chips still resolve titles/pages. The web deploy builds its own
 *              fresh `dist`, so it is unaffected.
 *
 *              Idempotent + safe to run when `dist` is absent (no-op). Zero deps.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-01
 * @updated 2026-07-01
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { readdirSync, statSync, rmSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve, join } from "node:path";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const REGS_DIR = join(ROOT, "web", "dist", "regs");

function fmtMB(bytes) {
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

if (!existsSync(REGS_DIR)) {
  console.log("prune-mobile-assets: no web/dist/regs — nothing to prune (run after the web build).");
  process.exit(0);
}

let removed = 0;
let bytes = 0;
for (const name of readdirSync(REGS_DIR)) {
  // MB-7: prune the regs PDFs AND the pdftotext .txt intermediates (~2.7 MB,
  // build-time extractor output with zero runtime readers — grep-verified).
  // KEEP regs-index.json (read at runtime by useRegsIndex.ts for citations).
  const lower = name.toLowerCase();
  if (!lower.endsWith(".pdf") && !lower.endsWith(".txt")) continue;
  const p = join(REGS_DIR, name);
  try {
    bytes += statSync(p).size;
    rmSync(p, { force: true });
    removed += 1;
  } catch (err) {
    console.warn(`prune-mobile-assets: could not remove ${name}: ${err.message}`);
  }
}

console.log(
  `prune-mobile-assets: removed ${removed} regs asset(s) (PDF + pdftotext .txt) (${fmtMB(bytes)}) from web/dist for the mobile bundle. ` +
    "PDFs remain in the repo + web deploy; mobile citations open the hosted copy.",
);
