/**
 * @file playwright.config.ts
 * @module engage-mt/web
 * @description Playwright e2e configuration. The specs under web/tests/e2e/
 *              exercise the critical user journeys (map render, module
 *              navigation, layer toggles, theme flip, mobile bottom sheet,
 *              tooltips, keyboard walk, tap-to-card, field tools + share,
 *              axe sweeps on every module root, a console-error sweep).
 *
 *              Local: `npm run verify:e2e` from the repo root.
 *              Hosted runners: `bash scripts/ci.sh`.
 * @author Jamie Ellis / Engage MT
 * @created 2026-05-31
 * @updated 2026-05-31
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { defineConfig, devices } from "@playwright/test";

/** Port for the preview server under test — override with E2E_PORT when 4173 is taken. */
const PORT = process.env.E2E_PORT ?? "4173";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  // One retry everywhere — headless parallel runs occasionally drop a map
  // asset under worker contention (verified flake: specs pass in isolation).
  retries: 1,
  workers: process.env.CI ? 1 : 2,
  reporter: [["list"], ["html", { outputFolder: "playwright-report" }]],
  use: {
    baseURL: process.env.BASE_URL ?? `http://127.0.0.1:${PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: {
    command: `npm run preview -- --host --port=${PORT}`,
    url: `http://127.0.0.1:${PORT}`,
    timeout: 120_000,
    // Never attach to a server we did not start: a stranger on the port would
    // make the suite test the wrong app.
    reuseExistingServer: false,
  },
  projects: [
    {
      name: "desktop-chromium",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
    {
      name: "mobile-chromium",
      use: { ...devices["Pixel 5"] },
    },
  ],
});
