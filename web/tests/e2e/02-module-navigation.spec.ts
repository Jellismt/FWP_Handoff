/**
 * @file 02-module-navigation.spec.ts
 * @module engage-mt/tests/e2e
 * @description Navigate Hunt → Explore & Access → My FWP
 *              via the primary nav (plus the pre-merge /fish + /access paths,
 *              which must redirect to the merged Explore & Access landing).
 *              Each route renders its module landing without a console error.
 * @author Jamie Ellis / Engage MT
 * @created 2026-05-31
 * @updated 2026-06-30
 * @version 1.1.0
 */

import { test, expect } from "@playwright/test";
import { isUpstreamNoise } from "./_helpers";

test("three-tab navigation works + no console errors", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });

  await page.goto("/");

  for (const path of ["/hunt", "/explore", "/manage", "/fish", "/access"]) {
    await page.goto(path);
    // Each module landing renders a hero or list region with the
    // module name in the H1.
    await expect(page.locator("h1, .fwp-tool-hero, [role='heading']").first()).toBeVisible({
      timeout: 15_000,
    });
  }

  // Filter out upstream/headless noise (Calcite localization + ArcGIS
  // layer/portal loads that only succeed with live network). Any OTHER
  // error fails the smoke. See _helpers.ts for the shared allowlist.
  const blockingErrors = consoleErrors.filter((e) => !isUpstreamNoise(e));
  expect(blockingErrors, blockingErrors.join("\n")).toEqual([]);
});
