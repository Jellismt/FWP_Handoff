#!/usr/bin/env node
/**
 * @file check-csp-allowlist.mjs
 * @module engage-mt/scripts
 * @description Drift guard between the CSP `connect-src`
 *              allowlist in `web/serve.json` and the actual external
 *              hosts the app contacts (per `web/src/config/layers.ts`
 *              `url:` entries + `web/src/services/public/*` fetch
 *              targets). Fails the verify gate when a new upstream is added in
 *              code but not allow-listed in the CSP — without this
 *              gate, a CSP report-only deploy silently breaks the
 *              first time a new agency endpoint is called.
 *
 *              Pass criteria: every distinct origin found in the
 *              code paths matches an entry in the CSP `connect-src`
 *              (or `img-src` for tile services). Wildcards like
 *              `*.arcgis.com` are honored via prefix-suffix match.
 *
 *              Wired into `npm run check:csp-allowlist` (part of verify).
 *              See: docs/security/csp-draft.md for the
 *              source-of-truth rationale per directive.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-02
 * @updated 2026-06-02
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = resolve(__dirname, "..");

// ─── 1. Parse the CSP from serve.json ────────────────────────────────
const serveConfig = JSON.parse(
  readFileSync(resolve(WEB_ROOT, "serve.json"), "utf8"),
);
const cspHeader = serveConfig.headers
  ?.find((h) => h.source === "**/*")
  ?.headers?.find((h) => /^Content-Security-Policy/.test(h.key));
if (!cspHeader) {
  console.error("✗ No CSP header found in serve.json");
  process.exit(1);
}

const parseDirective = (directive) => {
  const m = new RegExp(`${directive}\\s+([^;]+)`, "i").exec(cspHeader.value);
  if (!m) return new Set();
  return new Set(
    m[1]
      .trim()
      .split(/\s+/)
      .filter((t) => /^https?:\/\//.test(t)),
  );
};

const connectAllow = parseDirective("connect-src");
const imgAllow = parseDirective("img-src");
const allowedHosts = new Set([...connectAllow, ...imgAllow]);

// ─── 2. Grep ONLY runtime-fetched URLs ───────────────────────────────
// `config/layers.ts` — match `url: "https://…"` only (not the
//   `upstreamUrl:` attribution field which renders as an external link).
// `services/public/*.ts` — explicit `fetch()` / `withRetry()` wrappers.
// `services/data/*.ts` — Tier-2 dataset fetches.
// Outbound `<a href>` links in JSX are NOT subject to CSP — they
// navigate to an external origin in a new tab and the CSP only
// restricts the current document's outbound HTTP.
// SEC-3: hosts that appear in the scanned dirs only as outbound navigation
// links (`cta.href`, `<a href>`), never as a fetch target. Links are NOT
// governed by CSP `connect-src`, so they must not drift the allow-list. Keep
// this list minimal + justified — a host here is asserted to be link-only.
const LINK_ONLY_HOSTS = new Set([
  "www.nifc.gov", // activeFires.ts cta "NIFC fire map"; the data fetch is *.arcgis.com
  // fwp.mt.gov is the FWP CMS site — only ever an outbound cta/attribution link
  // (e.g. waterbodyClosures.ts "View FWP restriction" → fwp.mt.gov/fish/…). The
  // app's *data* fetches hit fwp-gis.mt.gov (GIS) + myfwp.mt.gov, never the CMS.
  "fwp.mt.gov",
]);

const sourceUrls = new Set();
try {
  // `url: "https://…"` in layers.ts is the actual ArcGIS service URL.
  const layerGrep = execSync(
    `grep -hEo '^\\s*url:\\s*"https://[a-zA-Z0-9.-]+(/[a-zA-Z0-9._/?=&%-]*)?"' src/config/layers.ts src/config/layers/*.ts 2>/dev/null || true`,
    { cwd: WEB_ROOT, encoding: "utf8" },
  );
  // Bare https:// in the fetch-wrapper services + data services.
  const serviceGrep = execSync(
    // Real source only — exclude *.test.ts / *.spec.ts so fixture hosts
    // (https://fwp.test, https://svc.test, …) don't drift the allow-list.
    // CSP governs the running app, not the test harness.
    // SEC-3: the three ADDITIONAL dirs below make genuine runtime fetches
    // (spatialContext point lookups, notification source polls, fish REST) that
    // this gate previously missed. Deliberately NOT the whole of services/hooks —
    // link-only URL consts there would produce false allow-list drifts.
    `grep -rohE --include='*.ts' --exclude='*.test.ts' --exclude='*.spec.ts' 'https://[a-zA-Z0-9.-]+(/[a-zA-Z0-9._/?=&%-]*)?' src/services/public src/services/data src/services/spatialContext src/services/notifications/sources src/services/fish src/config/offlineBasemaps.ts 2>/dev/null || true`,
    { cwd: WEB_ROOT, encoding: "utf8" },
  );
  const grep = layerGrep + "\n" + serviceGrep;
  for (const line of grep.split("\n")) {
    const trimmed = line.trim().replace(/^.*?(https:\/\/)/, "$1").replace(/"$/, "");
    if (!trimmed || !trimmed.startsWith("https://")) continue;
    try {
      const u = new URL(trimmed);
      if (!u.host || u.host === "url") continue; // strip regex artifact
      if (u.host.includes("...")) continue; // strip docstring placeholders
      if (LINK_ONLY_HOSTS.has(u.host)) continue; // SEC-3: navigation, not connect
      sourceUrls.add(`${u.protocol}//${u.host}`);
    } catch {
      /* skip malformed */
    }
  }
} catch (err) {
  console.error("✗ grep failed", err);
  process.exit(1);
}

// ─── 3. Match each source URL against the allowlist ──────────────────
const allowedHostNames = [...allowedHosts].map((entry) => {
  try {
    const u = new URL(entry);
    return u.host;
  } catch {
    return entry;
  }
});

const hostAllowed = (host) =>
  allowedHostNames.some((allowed) => {
    if (allowed.startsWith("*.")) {
      const suffix = allowed.slice(1); // ".arcgis.com"
      return host === allowed.slice(2) || host.endsWith(suffix);
    }
    return allowed === host;
  });

const missing = [];
for (const url of sourceUrls) {
  const host = new URL(url).host;
  if (!hostAllowed(host)) missing.push(url);
}

// ─── 4. Report ────────────────────────────────────────────────────────
if (missing.length > 0) {
  console.error("✗ The following hosts are referenced in code but missing");
  console.error("  from the CSP `connect-src` / `img-src` allow-list in");
  console.error("  web/serve.json (see docs/security/csp-draft.md):");
  console.error("");
  for (const url of missing.sort()) console.error(`    ${url}`);
  console.error("");
  console.error(
    `  Add to serve.json or remove from the code path. ${missing.length} drift.`,
  );
  process.exit(1);
}

console.log(`✓ CSP allowlist covers ${sourceUrls.size} source-tree hosts`);
console.log(
  `  (${connectAllow.size} connect-src + ${imgAllow.size} img-src entries)`,
);
