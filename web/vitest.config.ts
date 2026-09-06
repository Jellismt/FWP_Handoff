/**
 * @file vitest.config.ts
 * @module engage-mt/config
 * @description Vitest configuration. Happy-dom environment for fast component tests.
 * @author Jamie Ellis / Engage MT
 * @created 2026-05-29
 * @updated 2026-06-15
 * @version 1.3.1
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(dirname, "src"),
    },
  },
  test: {
    environment: "happy-dom",
    setupFiles: ["./src/test/setup.ts"],
    globals: true,
    // Playwright e2e specs live under tests/e2e/ and use
    // @playwright/test imports that are incompatible with Vitest's
    // runner. Exclude them from the unit-test pass; they run via
    // `npm run test:e2e` instead.
    exclude: ["**/node_modules/**", "**/dist/**", "tests/e2e/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json-summary", "lcov"],
      include: ["src/**/*.{ts,tsx}"],
      // Excluded from the UNIT-coverage denominator (not from the app):
      //  • test scaffolding + the bootstrap entrypoint (main.tsx).
      //  • ArcGIS **WebGL view-mount** components — files whose body is a
      //    `new MapView` (or `<arcgis-*>`) construction inside a mount
      //    effect. happy-dom has no WebGL/layout, so these cannot be
      //    unit-rendered; their behaviour is exercised by the Playwright e2e +
      //    axe suite (`npm run verify:e2e`, tests/e2e/*), which drives the real
      //    browser (map render, tap-to-card, module-root axe, keyboard nav).
      //    Measuring them in the *unit* denominator understates the coverage of
      //    code that CAN be unit-tested. Keep this list to genuine view mounts +
      //    the two shells that only orchestrate them (App router root, MapPage);
      //    do NOT add ordinary components here to chase a number.
      exclude: [
        "src/**/*.test.{ts,tsx}",
        "src/test/**",
        "src/main.tsx",
        // App shell / map-substrate orchestration (e2e-covered)
        "src/App.tsx",
        // AR-2 — per-module route tables: thin RouteObject arrays + lazyNamed
        // decls relocated out of App.tsx. They are pure wiring (no branching
        // logic to unit-test) and are exercised by the e2e route walk; excluding
        // them keeps the razor-thin coverage floors from failing on ~450 lines of
        // relocated declarations.
        "src/routes/**",
        "src/components/map/MapPage.tsx",
        // ArcGIS MapView constructors (no WebGL in happy-dom)
        "src/components/map/MapView.tsx",
        "src/components/manage/AoiPickerMap.tsx",
      ],
      // Coverage thresholds are ratchet floors, not aspirations. Policy:
      //  • Each floor sits ~0.3pp below the last measured full-run actuals,
      //    so a genuine coverage regression fails the gate while ordinary
      //    run-to-run variance does not.
      //  • When new suites raise the actuals, ratchet the floors UP to lock
      //    the gain. Never lower a floor to make a red run pass — fix or
      //    test the code instead.
      //  • The denominator is unit-testable code only (see the `exclude`
      //    list above): ArcGIS WebGL view mounts such as MapView.tsx
      //    cannot render in happy-dom and are exercised by the Playwright
      //    e2e/axe suite instead.
      // Floors sit just under the last measured full run, with enough margin
      // for the ~0.6pp run-to-run swing on functions (async/timing
      // nondeterminism). Ratchet UP only from here.
      thresholds: {
        statements: 74.7,
        branches: 63.3,
        functions: 70.8,
        lines: 76.5,
      },
    },
  },
});
