/**
 * @file vitest.config.ts
 * @module engage-mt/mobile
 * @description Vitest configuration for the Capacitor wrapper's config
 *              contract tests (Node environment; no DOM).
 * @author Jamie Ellis / Engage MT
 * @created 2026-09-05
 * @updated 2026-09-05
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { environment: "node", include: ["*.test.ts"] },
});
