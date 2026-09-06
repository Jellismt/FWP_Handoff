/**
 * @file 08-keyboard-navigation.spec.ts
 * @module engage-mt/e2e
 * @description Keyboard walk through the shell: the first Tab press lands on
 *              the skip link, activating it moves focus into <main>, the map
 *              tool rail is one tab stop with arrow-key movement inside it,
 *              and Escape closes an open menu and returns focus to its
 *              trigger.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-24
 * @updated 2026-09-06
 * @version 2.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { test, expect, type Page } from "@playwright/test";

const activeDescription = (page: Page): Promise<string> =>
  page.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body) return "body";
    const label = el.getAttribute("aria-label") ?? el.textContent?.trim() ?? "";
    return `${el.tagName.toLowerCase()}:${label.slice(0, 40)}`;
  });

const appReady = async (page: Page): Promise<void> => {
  await page.goto("/");
  await expect(page.getByRole("navigation", { name: "Modules" })).toBeVisible();
};

test("first Tab lands on the skip link and activating it moves focus into main", async ({
  page,
}) => {
  await appReady(page);
  await page.keyboard.press("Tab");
  await expect(page.locator(":focus")).toHaveText(/skip to main content/i);
  await page.keyboard.press("Enter");
  await expect
    .poll(() => page.evaluate(() => document.activeElement?.closest("main") !== null))
    .toBe(true);
});

test("the map tool rail is a single tab stop with arrow-key movement", async ({ page }) => {
  await appReady(page);
  const rail = page.getByRole("toolbar", { name: /map tools/i });
  await expect(rail).toBeVisible();
  const buttons = rail.getByRole("button");
  const count = await buttons.count();
  expect(count).toBeGreaterThan(1);

  const stops = await buttons.evaluateAll(
    (els) => els.filter((el) => el.getAttribute("tabindex") === "0").length,
  );
  expect(stops).toBe(1);

  await buttons.first().focus();
  const before = await activeDescription(page);
  await page.keyboard.press("ArrowDown");
  const after = await activeDescription(page);
  expect(after).not.toBe(before);
  expect(after).not.toBe("body");
  await page.keyboard.press("Home");
  expect(await activeDescription(page)).toBe(before);
});

test("Escape closes the About menu and returns focus to its trigger", async ({ page }) => {
  await appReady(page);
  const trigger = page.getByRole("button", { name: /about engage mt/i });
  await trigger.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog").or(page.getByRole("menu"))).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog").or(page.getByRole("menu"))).toBeHidden();
  await expect(trigger).toBeFocused();
});
