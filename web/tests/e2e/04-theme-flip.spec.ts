/**
 * @file 04-theme-flip.spec.ts
 * @module engage-mt/e2e
 * @description The theme toggle is always present, flips the document colour
 *              scheme, and the choice survives a reload.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-24
 * @updated 2026-09-06
 * @version 2.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { test, expect } from "@playwright/test";

test("theme toggle flips data-color-scheme and the choice persists across a reload", async ({
  page,
}) => {
  await page.goto("/");
  const html = page.locator("html");
  await expect(html).toHaveAttribute("data-color-scheme", /light|dark/);
  const initial = await html.getAttribute("data-color-scheme");

  const toggle = page.getByRole("button", { name: /switch to (dark|light) mode/i });
  await expect(toggle).toBeVisible();
  await toggle.click();
  const flipped = initial === "dark" ? "light" : "dark";
  await expect(html).toHaveAttribute("data-color-scheme", flipped);
  await expect(
    page.getByRole("button", { name: new RegExp(`switch to ${initial} mode`, "i") }),
  ).toBeVisible();

  await page.reload();
  await expect(html).toHaveAttribute("data-color-scheme", flipped);
});
