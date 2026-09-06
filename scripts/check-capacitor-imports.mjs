/**
 * @file check-capacitor-imports.mjs
 * @module engage-mt/scripts
 * @description Native-import integrity gate. Fails if any `@capacitor/*` dynamic
 *              import in web/src uses the `/* @vite-ignore *​/` form (with or
 *              without a string-variable specifier). That pattern tells Vite NOT
 *              to bundle the module, so the native WebView receives a bare
 *              specifier it can't resolve at runtime — the import throws, a catch
 *              swallows it, and the plugin silently no-ops on device. This is
 *              MOB-D0 (2026-07): it disabled six native subsystems (app lifecycle,
 *              status bar, splash, network events, local notifications, filesystem
 *              share import) with zero build/runtime error. Capacitor plugins must
 *              be imported with a plain literal specifier so Vite emits a resolvable
 *              lazy chunk; the isCapacitor() guard keeps it off the web path.
 *              Zero dependencies — plain Node ESM.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-01
 * @updated 2026-07-01
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve, join } from "node:path";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "web", "src");

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

// A dynamic import() carrying a @vite-ignore comment AND resolving a capacitor
// module — either directly (import(/* @vite-ignore */ "@capacitor/x")) or via a
// variable whose value is a "@capacitor/..." string literal in the same file.
const VITE_IGNORE_IMPORT = /import\(\s*\/\*\s*@vite-ignore\s*\*\/\s*([^)]+)\)/g;

const offenders = [];

for (const file of walk(SRC)) {
  const text = readFileSync(file, "utf8");
  if (!text.includes("@vite-ignore")) continue;

  let m;
  while ((m = VITE_IGNORE_IMPORT.exec(text)) !== null) {
    const arg = m[1].trim();
    // Direct literal: import(/* @vite-ignore */ "@capacitor/app")
    const directCapacitor = /^["'`]@capacitor\//.test(arg);
    // Variable form: find `const <arg> = "@capacitor/..."` earlier in the file.
    const varCapacitor =
      /^[A-Za-z_$][\w$]*$/.test(arg) &&
      new RegExp(`\\b${arg}\\s*=\\s*["'\`]@capacitor/`).test(text);
    if (directCapacitor || varCapacitor) {
      const line = text.slice(0, m.index).split("\n").length;
      offenders.push(`${file.replace(ROOT + "/", "")}:${line}  →  ${arg}`);
    }
  }
}

if (offenders.length > 0) {
  console.error(
    "\n❌ check:capacitor-imports — @vite-ignore'd @capacitor import(s) found.\n" +
      "   These leave a bare specifier the native WebView can't resolve → the\n" +
      "   plugin silently fails on device (MOB-D0). Use a plain literal import:\n" +
      '     const { X } = await import("@capacitor/x");   // guarded by isCapacitor()\n' +
      "   and add the plugin to web/package.json so Vite can bundle it.\n",
  );
  for (const o of offenders) console.error("   " + o);
  console.error("");
  process.exit(1);
}

console.log("✅ check:capacitor-imports — no @vite-ignore'd @capacitor imports.");
