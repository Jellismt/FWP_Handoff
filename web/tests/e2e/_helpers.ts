/**
 * @file _helpers.ts
 * @module engage-mt/tests/e2e
 * @description Shared Playwright e2e helpers. Centralizes the three
 *              concerns that made the smoke suite flaky in headless /
 *              offline CI (where the FWP + Esri feature services and the
 *              Calcite localization assets aren't reachable the way a real
 *              browser reaches them):

 *
 *                2. `isUpstreamNoise` — the single, up-to-date allowlist of
 *                   console errors that come from upstream services being
 *                   unreachable in headless Chromium (ArcGIS 5.x layer /
 *                   portal load failures, Calcite `[intl]` asset fetches).
 *                   NOT app bugs — a real browser with
 *                   network loads all of these. Kept here so every spec
 *                   filters the same way instead of drifting per-file.
 *
 *                3. `revealFirstLayerRow` — opens the LayerPanel the way a
 *                   user must: on a phone viewport the panel starts as the
 *                   "Layers" pill, and on every viewport the module groups
 *                   start folded. So an individual `.layer-panel__row-button`
 *                   only exists after opening the panel + expanding a group.
 *                   This mirrors the real interaction rather than asserting
 *                   a row that the design intentionally hides.
 *
 *              Note: this file is NOT a spec (no `*.spec.ts` suffix) so
 *              Playwright's testMatch skips it — it's an import-only module.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-30
 * @updated 2026-06-30
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import type { Locator, Page } from "@playwright/test";

/**
 * Console / pageerror messages that are expected when the FWP + Esri
 * services and Calcite assets aren't reachable in headless Chromium the
 * way they are in a real, network-connected browser. These are upstream /
 * environment noise, never Engage MT bugs.
 *
 * Superset of the per-spec lists that had drifted out of date — notably it
 * covers the ArcGIS 5.x error prefix (`@arcgis/core/layers/...`) and the
 * Calcite `[intl]` localization-fetch failures, which the older
 * `esri.layers.*` / `calcite-components.*t9n` patterns miss.
 */
const UPSTREAM_NOISE: readonly RegExp[] = [
  // Calcite localization JSON not served the same way under `vite preview`.
  /\[intl\].*localization strings/i,
  /calcite-(components|assets).*t9n/i,
  // Static asset 404s that don't affect behavior.
  /Failed to load resource.*icons\//i,
  /favicon\.ico/i,
  // A third-party resource that times out or cannot connect on a loaded
  // machine is the network, not the app (the sweep runs beside a full verify).
  /Failed to load resource: net::ERR_(TIMED_OUT|CONNECTION_)/i,
  // Esri / ArcGIS transient asset + vector-tile auth failures in headless.
  /js\.arcgis\.com.*(blocked|net::ERR_)/i,
  /VectorTileLayer.*Hybrid Reference Layer/i,
  /Failed to create layerview/i,
  // ArcGIS feature / map-image / portal layer loads fail with no network.
  // ArcGIS 5.x logs these under an `@arcgis/core/layers/...` prefix; the
  // 4.x-era `esri.layers.*` form is kept for back-compat.
  /esri\.layers\..*#load\(\) Failed to load layer/i,
  /@arcgis\/core\/layers.*Failed to load layer/i,
  /fromPortalItem.*Failed to create layer/i,
];

/** True when `msg` matches a known upstream/environment noise pattern. */
export const isUpstreamNoise = (msg: string): boolean => UPSTREAM_NOISE.some((re) => re.test(msg));

/**
 * Open the LayerPanel and expand its first module group so an individual
 * layer row (`.layer-panel__row-button`) becomes reachable, then return
 * that row's locator. Handles both chrome states:
 *   • phone viewport → the panel is the collapsed "Layers" pill; click it.
 *   • every viewport → module groups start folded; expand the first one.
 */
export async function revealFirstLayerRow(page: Page): Promise<Locator> {
  // Phone viewport: the panel collapses to a pill until opened.
  const pill = page.locator(".layer-panel__collapsed-pill");
  if (await pill.isVisible().catch(() => false)) {
    await pill.click();
  }

  // The panel is now present; module groups are folded by default. Expand
  // the first collapsed group to surface its rows.
  const collapsedGroup = page.locator(".layer-panel__group-toggle[aria-expanded='false']").first();
  await collapsedGroup.waitFor({ state: "visible", timeout: 15_000 });
  await collapsedGroup.click();

  const firstRow = page.locator(".layer-panel__row-button").first();
  await firstRow.waitFor({ state: "visible", timeout: 15_000 });
  return firstRow;
}
