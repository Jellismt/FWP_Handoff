/**
 * @file 03-layer-panel-toggle.spec.ts
 * @module engage-mt/tests/e2e
 * @description Clicking a layer panel row toggles
 *              the layer-visibility store (verified via aria-pressed).
 * @author Jamie Ellis / Engage MT
 * @updated 2026-06-30
 * @version 1.1.0
 */

import { test, expect } from "@playwright/test";
import { revealFirstLayerRow } from "./_helpers";

test("layer panel row toggles aria-pressed state", async ({ page }) => {
  await page.goto("/");
  // A layer row only exists after opening the panel (collapsed to a pill on
  // phone viewports) and expanding a module group (folded by default).
  const firstRow = await revealFirstLayerRow(page);
  const initial = await firstRow.getAttribute("aria-pressed");
  await firstRow.click();
  await expect(firstRow).toHaveAttribute("aria-pressed", initial === "true" ? "false" : "true");
});
