/**
 * @file 01-map-renders.spec.ts
 * @module engage-mt/tests/e2e
 * @description The map renders and the layer panel is
 *              reachable. axe-core runs against the landing page.
 * @author Jamie Ellis / Engage MT
 * @created 2026-05-31
 * @updated 2026-06-30
 * @version 1.1.0
 */

import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("map landing renders + layer panel reachable + axe clean", async ({ page }, testInfo) => {
  await page.goto("/");
  // The ArcGIS canvas mounts asynchronously; wait for the map root.
  await page.locator(".esri-view-root, [aria-label='Interactive map of Montana']").first().waitFor({
    state: "attached",
    timeout: 30_000,
  });

  // The layer panel is a persistent rail on desktop/tablet but a
  // collapse-by-default sheet on mobile (per docs/rules/responsive-layouts.md:
  // LayerPanel defaults `collapsed` under the 767px breakpoint). So the panel
  // legitimately isn't in the DOM on a phone viewport until the user opens it.
  // Assert REACHABILITY (the test's stated intent) in a viewport-aware way
  // rather than blindly asserting the expanded rail is visible.
  const layerPanel = page.locator(".layer-panel");
  const isMobile = testInfo.project.name === "mobile-chromium";
  if (isMobile) {
    // On mobile: the "Layers" pill (LayerPanel's collapsed state) must be
    // visible + operable, and opening it must reveal the panel.
    const layersPill = page.locator(".layer-panel__collapsed-pill");
    await expect(layersPill).toBeVisible({ timeout: 15_000 });
    await layersPill.click();
    await expect(layerPanel).toBeVisible({ timeout: 15_000 });
  } else {
    // On desktop/tablet: the panel is a persistent rail, visible by default.
    await expect(layerPanel).toBeVisible({ timeout: 15_000 });
  }

  // axe-core gate. Allow Calcite shadow-DOM violations (Calcite is
  // independently audited; we're checking OUR markup).
  const accessibilityScan = await new AxeBuilder({ page })
    .exclude("[class*='calcite-']") // skip Calcite-owned subtree
    .analyze();
  // Fail only on serious / critical violations.
  const blockers = accessibilityScan.violations.filter(
    (v) => v.impact === "serious" || v.impact === "critical",
  );
  expect(blockers, JSON.stringify(blockers, null, 2)).toEqual([]);
});
