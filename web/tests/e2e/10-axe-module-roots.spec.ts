/**
 * @file 10-axe-module-roots.spec.ts
 * @module engage-mt/tests/e2e
 * @description Axe-core baseline across the module
 *              roots. Asserts zero serious / critical violations on the
 *              Hunt / Explore & Access / My FWP tabs (plus the /access
 *              alias) at their default landing state. Calcite shadow-DOM subtrees
 *              are excluded (Calcite is independently audited; we're
 *              checking OUR markup).
 *
 *              When this suite goes red, fix the offending markup
 *              before merging — don't ratchet the impact filter.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-06
 * @updated 2026-06-06
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const ROUTES = [
  { path: "/", label: "landing (map)" },
  { path: "/hunt", label: "Hunt module root" },
  { path: "/explore", label: "Explore module root" },
  { path: "/access", label: "Access module root" },
  { path: "/manage", label: "Manage module root" },
] as const;

for (const route of ROUTES) {
  test(`axe-core clean on ${route.label}`, async ({ page }) => {
    await page.goto(route.path);
    // Wait for the route's main content to mount. The map root mounts
    // async; non-map routes are sync so 5s upper-bound covers both.
    await page.locator("main, [role='main'], #root").first().waitFor({
      state: "attached",
      timeout: 15_000,
    });
    // Settle for Calcite components + lazy chunks.
    await page.waitForTimeout(750);

    const scan = await new AxeBuilder({ page })
      .exclude("[class*='calcite-']") // Calcite shadow-DOM is audited upstream
      .exclude(".esri-view") // ArcGIS canvas is its own a11y story
      .analyze();
    const blockers = scan.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    );
    expect(
      blockers,
      `Serious/critical a11y blockers on ${route.path}:\n${JSON.stringify(blockers, null, 2)}`,
    ).toEqual([]);
  });
}
