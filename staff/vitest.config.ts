/**
 * @file vitest.config.ts
 * @module engage-mt/staff
 * @description Vitest configuration for the staff console: happy-dom for
 *              component tests, jest-dom matchers via setup.
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
  test: {
    environment: "happy-dom",
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: ["./src/test/setup.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/**/*.test.{ts,tsx}", "src/test/**", "src/main.tsx", "src/**/*.d.ts"],
      // Ratchet floors: about 0.3 points under the last measured run.
      thresholds: { statements: 10.8, branches: 8.0, functions: 6.9, lines: 12.3 },
    },
  },
});
