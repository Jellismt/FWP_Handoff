/**
 * @file 99-console-sweep.spec.ts
 * @module engage-mt/e2e
 * @description Walks every primary route and fails on any console error or
 *              page error that is not in the shared upstream-noise allowlist.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-24
 * @updated 2026-09-06
 * @version 2.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { test, expect } from "@playwright/test";
import { isUpstreamNoise } from "./_helpers";

const ROUTES = [
  "/",
  "/hunt",
  "/hunt/districts",
  "/explore",
  "/manage",
  "/manage/field-tools",
  "/field",
  "/attribution",
  // Pre-merge tab paths — must land cleanly on the merged Explore & Access tab.
  "/fish",
  "/access",
];

test("every primary route loads with no unexpected console errors", async ({ page }, testInfo) => {
  testInfo.setTimeout(180_000);
  const findings: { route: string; error: string }[] = [];
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    if (isUpstreamNoise(text)) return;
    findings.push({ route: page.url(), error: text });
  });
  page.on("pageerror", (err) => {
    if (isUpstreamNoise(err.message)) return;
    findings.push({ route: page.url(), error: `pageerror: ${err.message}` });
  });

  for (const route of ROUTES) {
    await page.goto(route, { waitUntil: "domcontentloaded" });
    // Give async loads a moment to surface errors.
    await page.waitForTimeout(600);
  }

  expect(findings, findings.map((f) => `${f.route}\n    ${f.error}`).join("\n")).toEqual([]);
});
