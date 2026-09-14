/**
 * @file check-plugin-parity.mjs
 * @module engage-mt/scripts
 * @description Capacitor plugin-parity gate. The mobile app is the web build
 *              wrapped in Capacitor, so a plugin the JS imports must be (a)
 *              declared in web/package.json — otherwise Vite emits a bare
 * Specifier the WebView can't resolve —
 *              and (b) declared in mobile/package.json so the native pod / gradle
 *              module actually ships. It also asserts that every `@capacitor/*`
 *              present in BOTH manifests is pinned to the EXACT same version, so
 *              a lone bump on one side can't drift the JS API away from the native
 *              implementation. Zero dependencies — plain Node ESM.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-02
 * @updated 2026-07-02
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve, join } from "node:path";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "web", "src");

/**
 * Packages that legitimately live on only the WEB side, so a native-side match
 * is NOT expected: the JS-bridge helper is pulled transitively by
 * filesystem/geolocation and is never a native module of its own. (Native- and
 * tooling-only packages such as @capacitor/{core,ios,android,cli,assets,keyboard}
 * are simply never imported by web/src, so they never trip the import checks.)
 */
const WEB_ONLY_OK = new Set(["@capacitor/synapse"]);

/**
 * Capacitor plugins do not all live under one scope: community plugins ship
 * under @capacitor-community, @capgo and @transistorsoft among others, and
 * unscoped ones are conventionally named capacitor-*. A scope allow-list would
 * silently ignore whichever vendor gets picked next, so the authoritative test
 * is the `capacitor` block every plugin declares in its own package.json. The
 * name pattern is the fallback for a dependency that is declared but not yet
 * installed.
 */
const NAME_LOOKS_LIKE_PLUGIN =
  /^@capacitor(-community)?\/|^@capgo\/|^@transistorsoft\/|(^|\/)capacitor-/;

function isCapacitorPlugin(name) {
  try {
    const manifest = JSON.parse(
      readFileSync(join(ROOT, "node_modules", name, "package.json"), "utf8"),
    );
    if (manifest.capacitor) return true;
    // Installed, and it does not declare itself a plugin.
    return NAME_LOOKS_LIKE_PLUGIN.test(name);
  } catch {
    return NAME_LOOKS_LIKE_PLUGIN.test(name);
  }
}

function capDeps(pkgPath) {
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  const all = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
  const out = new Map();
  for (const [name, ver] of Object.entries(all)) {
    if (isCapacitorPlugin(name)) out.set(name, ver);
  }
  return out;
}

/** Recursively collect .ts/.tsx files under `dir`. */
function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules") continue;
      walk(full, out);
    } else if (/\.tsx?$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

const web = capDeps(join(ROOT, "web", "package.json"));
const mobile = capDeps(join(ROOT, "mobile", "package.json"));

// Every distinct @capacitor/<name> ACTUALLY imported from web/src — matched only
// in a real import/from/require position so a mention inside a comment or string
// (e.g. "the shape @capacitor/core injects") is not counted as a dependency.
const IMPORT_RE =
  /\b(?:from|import|require)\b\s*\(?\s*["'`]((?:@capacitor(?:-community)?|@capgo|@transistorsoft)\/[a-z0-9-]+|capacitor-[a-z0-9-]+)["'`]/g;
const imported = new Set();
for (const file of walk(SRC)) {
  const text = readFileSync(file, "utf8");
  if (!text.includes("@capacitor") && !text.includes("@capgo") && !text.includes("@transistorsoft") && !text.includes("capacitor-")) continue;
  let m;
  while ((m = IMPORT_RE.exec(text)) !== null) imported.add(m[1]);
}

const failures = [];

// 1. Version parity for anything declared on both sides.
for (const [name, webVer] of web) {
  const mobileVer = mobile.get(name);
  if (mobileVer && webVer !== mobileVer) {
    failures.push(
      `version mismatch: ${name} is ${webVer} in web/package.json but ${mobileVer} in mobile/package.json — pin both to the exact same 8.x.`,
    );
  }
}

// 2. Everything imported in web/src must be declared in web/package.json.
for (const name of imported) {
  if (!web.has(name)) {
    failures.push(
      `${name} is imported in web/src but missing from web/package.json — Vite will emit a bare specifier the WebView can't resolve (MOB-D0). Add it.`,
    );
  }
}

// 3. A native plugin imported by the JS must also ship on the native side.
for (const name of imported) {
  if (WEB_ONLY_OK.has(name)) continue;
  if (!mobile.has(name)) {
    failures.push(
      `${name} is imported in web/src but missing from mobile/package.json — the native pod / gradle module won't ship, so the plugin no-ops on device. Add it.`,
    );
  }
}

if (failures.length > 0) {
  console.error("\n❌ check:plugin-parity — Capacitor plugin drift found:\n");
  for (const f of failures) console.error("   • " + f);
  console.error(
    "\n   Known-OK asymmetries (web-only JS bridge / mobile-only native+tooling) are\n" +
      "   allow-listed in scripts/check-plugin-parity.mjs.\n",
  );
  process.exit(1);
}

console.log(
  `✅ check:plugin-parity — ${imported.size} imported plugin(s) declared on both sides; all shared Capacitor plugin versions match.`,
);
