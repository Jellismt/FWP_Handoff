/**
 * @file vite.config.ts
 * @module engage-mt/config
 * @description Vite build configuration. Path alias `@/` → `src/`. Plugins: React +
 *              dangling-sourcemap-comment stripper.
 * @author Jamie Ellis / Engage MT
 * @created 2026-05-29
 * @updated 2026-06-10
 * @version 1.1.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";

const dirname = path.dirname(fileURLToPath(import.meta.url));

// Vendored assets copied verbatim into the bundle (e.g. via a `?url` import)
// can carry a trailing `//# sourceMappingURL=...map` comment whose referenced
// `.map` is never emitted into `dist` (production sourcemaps are disabled —
// see `build.sourcemap` below). DevTools then requests the missing `.map` and
// logs a 404. This plugin strips ONLY dangling references — comments whose
// `.map` target is not actually present in the bundle — so legitimate
// sourcemaps emitted for our own code (dev / preview builds) are left
// untouched.
const SOURCE_MAPPING_URL_RE = /\n?\/\/# sourceMappingURL=(\S+)\s*$/;

function stripDanglingSourcemapComments(): Plugin {
  return {
    name: "engage-mt:strip-dangling-sourcemap-comments",
    generateBundle(_options, bundle) {
      for (const file of Object.values(bundle)) {
        if (file.type !== "asset" || !file.fileName.endsWith(".js")) continue;
        const source =
          typeof file.source === "string" ? file.source : Buffer.from(file.source).toString("utf8");
        const match = source.match(SOURCE_MAPPING_URL_RE);
        if (!match) continue;
        // Resolve the referenced map basename against the emitted bundle.
        const mapName = path.posix.basename(match[1]);
        const mapEmitted = Object.keys(bundle).some(
          (name) => path.posix.basename(name) === mapName,
        );
        if (!mapEmitted) {
          file.source = source.replace(SOURCE_MAPPING_URL_RE, "");
        }
      }
    },
  };
}

/** "5.0.19" → "5.0": the path segment js.arcgis.com serves the theme CSS under. */
export const arcgisMajorMinor = (version: string): string =>
  version.split(".").slice(0, 2).join(".");

/**
 * Stamps the installed @arcgis/core major.minor into index.html's theme
 * stylesheet URL (the `%ARCGIS_MAJOR_MINOR%` token), matching the runtime
 * `useTheme` swap, so the CSS and the SDK can never disagree.
 */
export function arcgisThemeHtml(version: string): Plugin {
  const majorMinor = arcgisMajorMinor(version);
  return {
    name: "engage-mt:arcgis-theme-html",
    transformIndexHtml: (html) => html.replaceAll("%ARCGIS_MAJOR_MINOR%", majorMinor),
  };
}

/**
 * Vendor chunking. App code changes must not invalidate the multi-hundred-KB
 * framework and map-SDK bytes a returning visitor already has cached:
 *   • react / router / zustand → vendor-react
 *   • Calcite plus the @arcgis/core modules the entry reaches through static
 *     imports → vendor-esri (they import each other, so one chunk keeps the
 *     graph acyclic). Everything the SDK reaches only through a dynamic
 *     import keeps its own lazy chunk, so first paint downloads exactly what
 *     it did before and the FeatureLayer pipeline still streams in on demand
 *     (see optimizeDeps).
 */
export const vendorChunk = (
  id: string,
  isStaticallyReachable: (id: string) => boolean,
): string | undefined => {
  if (!id.includes("/node_modules/")) return undefined;
  if (
    /\/node_modules\/(react|react-dom|react-router|react-router-dom|scheduler|zustand)\//.test(id)
  ) {
    return "vendor-react";
  }
  if (id.includes("/node_modules/@esri/calcite-components")) return "vendor-esri";
  if (id.includes("/node_modules/@arcgis/core/") && isStaticallyReachable(id))
    return "vendor-esri";
  return undefined;
};

interface ModuleGraph {
  getModuleIds: () => IterableIterator<string>;
  getModuleInfo: (id: string) => { isEntry: boolean; importedIds: readonly string[] } | null;
}

/**
 * The set of modules reachable from an entry by following static imports
 * only — the modules a first paint downloads. Computed once per build.
 */
export const staticReach = (graph: ModuleGraph): Set<string> => {
  const reached = new Set<string>();
  const stack = [...graph.getModuleIds()].filter((id) => graph.getModuleInfo(id)?.isEntry);
  while (stack.length > 0) {
    const id = stack.pop() as string;
    if (reached.has(id)) continue;
    reached.add(id);
    for (const dep of graph.getModuleInfo(id)?.importedIds ?? []) stack.push(dep);
  }
  return reached;
};

let reachable: Set<string> | null = null;
const require = createRequire(import.meta.url);
const arcgisVersion = (require("@arcgis/core/package.json") as { version: string }).version;

// Vite-injected build metadata for the Footer chips.
// Reading package.json at config-eval time avoids shipping the whole
// package.json into the client. Build date is the ISO date of the
// build invocation; falls back to "dev" for HMR / dev server.
const pkg = JSON.parse(readFileSync(path.join(dirname, "package.json"), "utf8")) as {
  version: string;
};
const buildDate = new Date().toISOString().slice(0, 10);

export default defineConfig({
  plugins: [react(), stripDanglingSourcemapComments(), arcgisThemeHtml(arcgisVersion)],
  define: {
    // Surface via `import.meta.env.PACKAGE_VERSION` / `BUILD_DATE`.
    "import.meta.env.PACKAGE_VERSION": JSON.stringify(pkg.version),
    "import.meta.env.BUILD_DATE": JSON.stringify(buildDate),
  },
  resolve: {
    alias: {
      "@": path.resolve(dirname, "src"),
    },
  },
  // ArcGIS Maps SDK is ESM-native and ships hundreds of dynamically-imported
  // sub-modules (geometry-engine, projection, rendering pipelines, popup,
  // screenshot utils, etc.). Vite's dep optimizer pre-bundles CommonJS deps
  // by default, which rewrites those dynamic imports and breaks chunks like
  // `screenshotUtils-XXXXXX.js` and the FeatureLayer rendering pipeline — the
  // visible symptom is that vector data layers (BMA, FAS, hunting districts)
  // never draw their pixels onto the canvas. Excluding @arcgis/core from
  // optimization lets the deeper modules load natively.
  optimizeDeps: {
    exclude: ["@arcgis/core", "@esri/calcite-components"],
  },
  build: {
    target: "es2022",
    // Sourcemaps inflate dist by ~8 MB and leak the full source
    // tree on a public deploy. Keep them for dev / local-preview builds
    // (Vite passes mode=development when running `vite build --mode dev`)
    // and drop them for the production deploy build that Railway runs.
    sourcemap: process.env.NODE_ENV !== "production",
    // Provenance/anti-copy watermark — a legal-notice banner prepended to
    // every emitted chunk. The `/*!` form survives minification (terser
    // keeps bang-comments), so a scraped bundle still carries its origin.
    // Zero runtime cost. See docs/security/anti-abuse.md.
    rollupOptions: {
      output: {
        banner: "/*! Engage MT (fwp.mt.gov) — Licensed under the MIT License. */",
        manualChunks: (id, graph) => {
          reachable ??= staticReach(graph);
          return vendorChunk(id, (moduleId) => reachable!.has(moduleId));
        },
      },
    },
  },
  server: {
    port: Number(process.env.PORT) || 5173,
    strictPort: false,
    open: false,
  },
});
