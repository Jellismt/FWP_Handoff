/**
 * @file 11-field-tools-and-share.spec.ts
 * @module engage-mt/tests/e2e
 * @description TG-5 — real-browser coverage for the field-tools journeys the
 *              unit suite can only approximate: (1) the /field planning surface
 *              renders its hero in a real Chromium; and (2) the peer-to-peer
 *              share-receive entry
 *              point at /field/receive?d=<payload> decodes on-device and, for a
 *              malformed/hostile payload (the CO-4 sanitization boundary), lands
 *              on the friendly guidance card rather than crashing — proving the
 *              persisted-store poison path is closed end-to-end in a browser.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-03
 * @updated 2026-07-16
 * @version 2.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { test, expect } from "@playwright/test";
import { isUpstreamNoise } from "./_helpers";

test("the /field planning surface renders without throwing", async ({ page }, testInfo) => {
  testInfo.setTimeout(60_000);
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(err.message));
  page.on("console", (msg) => {
    if (msg.type() === "error" && !isUpstreamNoise(msg.text())) errors.push(msg.text());
  });

  await page.goto("/field");
  // /field is the field-tools planning page (content surface, not a map view).
  await expect(page.getByRole("heading", { level: 1, name: "Field Tools" })).toBeVisible({
    timeout: 30_000,
  });
  expect(errors, `unexpected page errors:\n${errors.join("\n")}`).toEqual([]);
});

test("a malformed share link lands on the guidance card, not a crash (CO-4)", async ({
  page,
}, testInfo) => {
  testInfo.setTimeout(60_000);
  const pageErrors: string[] = [];
  page.on("pageerror", (err) => pageErrors.push(err.message));

  // A garbage ?d= payload is the hostile-input case CO-4 hardened: decode must
  // fail closed and render the receive-share guidance card.
  await page.goto("/field/receive?d=not-a-valid-share-payload");

  await expect(page.locator(".receive-share__title")).toBeVisible({ timeout: 15_000 });
  // The malformed payload must NOT have thrown an unhandled error.
  expect(pageErrors, `unexpected page errors:\n${pageErrors.join("\n")}`).toEqual([]);
});

test("an empty share link still resolves to the guidance card", async ({ page }, testInfo) => {
  testInfo.setTimeout(60_000);
  await page.goto("/field/receive");
  await expect(page.locator(".receive-share__title")).toBeVisible({ timeout: 15_000 });
});
