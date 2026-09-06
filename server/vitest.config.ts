/**
 * @file vitest.config.ts
 * @module engage-mt/server
 * @description Vitest config. Unit tests (deaParse etc.) run standalone; integration
 *              tests under test/ use globalSetup (real Postgres). globalSetup only runs
 *              when TEST_DATABASE_URL is reachable — CI brings up docker-compose.test.yml.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-04
 * @updated 2026-07-04
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { defineConfig } from "vitest/config";

const withDb = process.env.TEST_DATABASE_URL || process.env.RUN_DB_TESTS;

const TEST_URL = process.env.TEST_DATABASE_URL ?? "postgres://postgres@127.0.0.1:55432/regs_test";

export default defineConfig({
  test: {
    // Integration tests need the DB harness; unit tests always run.
    include: withDb
      ? ["src/**/*.test.ts", "test/**/*.test.ts"]
      : ["src/**/*.test.ts"],
    globalSetup: withDb ? ["test/globalSetup.ts"] : [],
    fileParallelism: false, // integration tests share one DB
    // One worker process, no per-file isolation → all suites share one pool against
    // the single test DB (matches how the app runs; avoids cross-worker session races).
    pool: "forks",
    maxWorkers: 1,
    isolate: false,
    testTimeout: 20_000,
    // Ensure worker processes see the test DB config (globalSetup runs in a
    // different process, so its env mutations don't propagate to workers).
    env: withDb
      ? { DATABASE_URL: TEST_URL, SKIP_POSTGIS: "1", SESSION_SECRET: "test-secret-abcdefghijklmnop", NODE_ENV: "test" }
      : {},
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      // Measured by the unit suite alone; the ETL loaders, boot scripts, and
      // CLIs run against a live database or the network and are covered by the
      // integration suite and by hand.
      exclude: [
        "src/**/*.test.ts",
        "src/etl/**",
        "src/db/migrate.ts",
        "src/db/seed.ts",
        "src/index.ts",
        "src/ops/*Cli.ts",
        "src/**/*.d.ts",
      ],
      // Ratchet floors: about 0.3 points under the last measured unit-only run.
      // Raise them when new tests land; never lower one to pass.
      thresholds: { statements: 20.2, branches: 16.1, functions: 24.7, lines: 19.2 },
    },
  },
});
