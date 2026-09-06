/**
 * @file build_regs_snapshot.mjs
 * @module engage-mt/scripts
 * @description Build-time fetch of the FWP Regs Manager hunting-regulations data
 *              into a single committed JSON snapshot bundled in the app, so the
 *              mobile build (which ships an empty VITE_FWP_API_BASE and therefore
 *              can never reach the live API or warm a runtime Cache-Storage
 *              snapshot) can serve regs offline from a fresh install.
 *
 *              Pattern: fetch from the PUBLIC Regs Manager API at build time
 *              (no auth), write committed JSON to web/public/data/, and let a
 *              module-cached runtime loader read it.
 *              Standalone (NOT part of build_all.mjs); run manually per release
 *              via `npm run data:regs` and commit the output. Docker just bundles
 *              the committed file, keeping the production image build hermetic.
 *
 *              Each entry is keyed by the EXACT cacheKey the runtime fetchers use
 *              (hunting-regulations-unified; important-dates-${year};
 *              content-body-${slug}-${year}; …) so the
 *              runtime bundled-tier lookup is a direct hit. Envelopes are enriched
 *              with honest freshness (effectiveDate / validUntil / sourceLabel +
 *              publication version) because the live v2 routes omit those.
 *
 *              Safety: if the API is unreachable (the core v1 table fails), the
 *              existing committed snapshot is left UNTOUCHED — a build machine
 *              without egress never clobbers good committed data.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-14
 * @updated 2026-07-14
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = resolve(__dirname, "..", "..", "web", "public", "data", "regs-snapshot.json");

// Public Regs Manager API. Override with REGS_SNAPSHOT_API_BASE (build-only env,
// deliberately NOT VITE_-prefixed so Vite can never inline it into the bundle).
const BASE = (
  process.env.REGS_SNAPSHOT_API_BASE || "https://regs-api-production.up.railway.app"
).replace(/\/+$/, "");
const V1 = `${BASE}/api/v1/fwp`;
const V2 = `${BASE}/api/v2/fwp`;

/** Season year: calendar year, minus one in Jan/Feb (MT license year runs Mar–Feb).
 *  Mirrors web/src/services/regsApi/year.ts. */
const currentRegsYear = (today = new Date()) => {
  const m = today.getMonth();
  return m === 0 || m === 1 ? today.getFullYear() - 1 : today.getFullYear();
};

// The public API rate-limits at 60 req/min, and this script fires ~110 requests
// (unified + reference tables + ~90 content bodies + sun tables). Throttle to
// ~1 req/1.2s to stay under, and back off + retry on a 429.
const MIN_INTERVAL_MS = 1200;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let lastReqAt = 0;

const getJson = async (url, tries = 4) => {
  for (let attempt = 1; attempt <= tries; attempt += 1) {
    const wait = Math.max(0, lastReqAt + MIN_INTERVAL_MS - Date.now());
    if (wait > 0) await sleep(wait);
    lastReqAt = Date.now();
    const res = await fetch(url, { headers: { accept: "application/json" } });
    if (res.status === 429) {
      const backoff = 10_000 * attempt;
      console.warn(`    429 rate-limited — backing off ${backoff / 1000}s (${attempt}/${tries})`);
      await sleep(backoff);
      lastReqAt = Date.now();
      continue;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }
  throw new Error("HTTP 429 (retries exhausted)");
};

/** Unwrap {data, meta} envelope or a bare array/object. */
const bodyData = (body) =>
  body && typeof body === "object" && !Array.isArray(body) && "data" in body ? body.data : body;
const bodyMeta = (body) =>
  body && typeof body === "object" && !Array.isArray(body) && "meta" in body ? (body.meta ?? {}) : {};

const main = async () => {
  console.log("\n▶ build_regs_snapshot — FWP Regs Manager hunting-regs offline bundle\n");
  console.log(`  Source: ${BASE} (public, no auth)`);

  const year = Number(process.env.REGS_SNAPSHOT_YEAR) || currentRegsYear();
  const buildTime = new Date().toISOString();
  const snapshot = {}; // cacheKey -> { data, meta }

  // Bundle-wide freshness base, seeded from the v1 unified table's rich meta.
  let base = {
    effectiveDate: null,
    validUntil: null,
    sourceLabel: `FWP ${year} hunting regulations`,
    version: null,
  };

  // Strip a trailing "(published vN)" so we can re-append the version exactly once
  // (the v1 API's sourceLabel already carries it; base/label may already have it).
  const stripVersion = (s) => (s ?? "").replace(/\s*\(published v\d+\)\s*$/i, "");

  const record = (key, body) => {
    const m = bodyMeta(body);
    const version = m.version ?? m.filters?.version ?? base.version;
    const label = stripVersion(m.sourceLabel ?? base.sourceLabel);
    snapshot[key] = {
      data: bodyData(body),
      meta: {
        generatedAt: buildTime,
        effectiveDate: m.effectiveFrom ?? m.effectiveDate ?? base.effectiveDate,
        validUntil: m.validUntil ?? base.validUntil,
        sourceLabel: version ? `${label} (published v${version})` : label,
        version,
      },
    };
  };

  // ── 1. v1 unified table (the core; also seeds the freshness base) ──────────
  let unified;
  try {
    unified = await getJson(`${V1}/datasets/hunting-regulations-unified`);
  } catch (err) {
    console.warn(`  · Core table unreachable (${err?.message ?? err}).`);
    if (existsSync(OUT_PATH)) {
      console.log("    Keeping the existing committed snapshot untouched.\n");
      return;
    }
    console.log("    No snapshot on disk — writing empty {} (regs stay unavailable offline).\n");
    writeFileSync(OUT_PATH, "{}\n");
    return;
  }
  {
    const m = bodyMeta(unified);
    // The v1 API embeds the publication version inside sourceLabel (no separate
    // field), so parse it out to seed base.version for every entry consistently.
    const labelVersion = Number((m.sourceLabel ?? "").match(/\(published v(\d+)\)/i)?.[1]) || null;
    base = {
      effectiveDate: m.effectiveFrom ?? m.effectiveDate ?? null,
      validUntil: m.validUntil ?? null,
      sourceLabel: m.sourceLabel ?? base.sourceLabel,
      version: m.version ?? m.filters?.version ?? labelVersion,
    };
    record("hunting-regulations-unified", unified);
    const rows = Array.isArray(bodyData(unified)) ? bodyData(unified).length : "?";
    console.log(`  ✓ unified table: ${rows} rows (v${base.version ?? "?"})`);
  }

  // ── 2. simple v2 reference endpoints (all ?year=) ──────────────────────────
  const simple = [
    ["important-dates", `important-dates-${year}`],
    ["license-fees", `license-fees-${year}`],
    ["contacts", `contacts-${year}`],
    ["district-notes", `district-notes-${year}`],
    ["restricted-areas", `restricted-areas-${year}`],
    ["youth-opportunities", `youth-opportunities-${year}`],
    ["corrections", `corrections-${year}`],
  ];
  for (const [path, key] of simple) {
    try {
      record(key, await getJson(`${V2}/hunting/${path}?year=${year}`));
      console.log(`  ✓ ${path}`);
    } catch (err) {
      console.warn(`  · ${path} skipped (${err?.message ?? err})`);
    }
  }

  // ── 3. content — discover categories + slugs, then bundle each ─────────────
  try {
    const all = await getJson(`${V2}/hunting/content?year=${year}`);
    const sections = bodyData(all) ?? [];
    const categories = [...new Set(sections.map((s) => s.category).filter(Boolean))];
    for (const cat of categories) {
      try {
        const catBody = await getJson(
          `${V2}/hunting/content?year=${year}&category=${encodeURIComponent(cat)}`,
        );
        record(`content-${cat}-${year}`, catBody);
      } catch (err) {
        console.warn(`  · content[${cat}] skipped (${err?.message ?? err})`);
      }
    }
    const slugs = [...new Set(sections.map((s) => s.slug).filter(Boolean))];
    for (const slug of slugs) {
      try {
        record(
          `content-body-${slug}-${year}`,
          await getJson(`${V2}/hunting/content/${encodeURIComponent(slug)}?year=${year}`),
        );
      } catch (err) {
        console.warn(`  · content-body[${slug}] skipped (${err?.message ?? err})`);
      }
    }
    console.log(`  ✓ content: ${categories.length} categories, ${slugs.length} bodies`);
  } catch (err) {
    console.warn(`  · content skipped (${err?.message ?? err})`);
  }

  // ── write (stable sorted keys → clean git diffs) ───────────────────────────
  const sorted = {};
  for (const key of Object.keys(snapshot).sort()) sorted[key] = snapshot[key];
  writeFileSync(OUT_PATH, `${JSON.stringify(sorted, null, 2)}\n`);
  const bytes = Buffer.byteLength(JSON.stringify(sorted));
  console.log(
    `\n  ✓ Wrote ${Object.keys(sorted).length} keys (${(bytes / 1024).toFixed(0)} KB) → ${OUT_PATH}`,
  );
  console.log(`    effectiveDate=${base.effectiveDate} · validUntil=${base.validUntil} · v${base.version}\n`);
};

main().catch((err) => {
  console.error(`build_regs_snapshot failed: ${err?.stack ?? err}`);
  process.exit(1);
});
