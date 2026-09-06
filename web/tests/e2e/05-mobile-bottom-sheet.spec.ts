/**
 * @file 05-mobile-bottom-sheet.spec.ts
 * @module engage-mt/e2e
 * @description On a phone viewport the layer panel collapses to a pill that
 *              meets the 44 px touch-target floor and opens the panel; on a
 *              desktop viewport there is no pill. The tap-query panel's
 *              phone rule (pinned to the bottom) is present in the stylesheet.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-24
 * @updated 2026-09-06
 * @version 2.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { test, expect } from "@playwright/test";

const hasPhoneRule = (page: import("@playwright/test").Page): Promise<boolean> =>
  page.evaluate(() =>
    Array.from(document.styleSheets)
      .flatMap((s) => {
        try {
          return Array.from(s.cssRules) as CSSRule[];
        } catch {
          return [];
        }
      })
      .filter((r): r is CSSMediaRule => r.type === CSSRule.MEDIA_RULE)
      .some((r) => r.media.mediaText.includes("767")),
  );

test.describe("phone viewport", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("the layer panel collapses to a 44 px pill that opens the panel", async ({ page }) => {
    await page.goto("/");
    const pill = page.locator(".layer-panel__collapsed-pill");
    await expect(pill).toBeVisible();
    const box = await pill.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
    await pill.click();
    await expect(page.locator(".layer-panel__group-toggle").first()).toBeVisible();
    expect(await hasPhoneRule(page)).toBe(true);
  });
});

test.describe("desktop viewport", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("the layer panel is open with no collapsed pill", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".layer-panel__group-toggle").first()).toBeVisible();
    await expect(page.locator(".layer-panel__collapsed-pill")).toHaveCount(0);
  });
});
