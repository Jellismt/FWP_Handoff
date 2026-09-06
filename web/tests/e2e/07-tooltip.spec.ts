/**
 * @file 07-tooltip.spec.ts
 * @module engage-mt/tests/e2e
 * @description Hovering a map-tool-rail button
 * Reveals the Tooltip with plain-English text.
 * @author Jamie Ellis / Engage MT
 * @updated 2026-06-30
 * @version 1.1.0
 */

import { test, expect } from "@playwright/test";

test("map tool rail tooltip surfaces plain-English text", async ({ page }, testInfo) => {
  await page.goto("/");
  const locate = page.locator(".map-tool-rail__button").first();
  await locate.waitFor({ state: "visible", timeout: 15_000 });

  const isMobile = testInfo.project.name === "mobile-chromium";
  if (isMobile) {
    // On a touch viewport the hover/focus tooltip is intentionally
    // suppressed (Tooltip.scheduleOpen bails on isTouchDevice — there's no
    // hover affordance on touch). The plain-English purpose is instead
    // carried by the button's accessible name, so assert that equivalent.
    await expect(locate).toHaveAttribute("aria-label", /your.*location/i);
  } else {
    // Desktop: focus opens the Tooltip (it opens on hover AND focus; focus
    // is keyboard/SR-reachable too). Tooltip element lives in a Portal at
    // document.body level.
    await locate.focus();
    const tooltip = page.locator(".fwp-tooltip");
    await expect(tooltip).toBeVisible({ timeout: 3_000 });
    await expect(tooltip).toContainText(/your.*location/i);
  }
});
