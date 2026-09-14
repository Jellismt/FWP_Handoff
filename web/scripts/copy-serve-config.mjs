#!/usr/bin/env node
/**
 * @file copy-serve-config.mjs
 * @module engage-mt/scripts
 * @description Copy `web/serve.json` into the built
 *              `web/dist/serve.json` so the `serve` package can read it
 *              when Railway runs `npm run start`. `serve` looks for
 *              `serve.json` relative to the directory it's serving
 *              (not the cwd of the process), so this post-build step
 *              keeps the config + the headers in lockstep with the
 *              build output.
 *
 *              Read by: `web/package.json` `build` script (runs after
 *              `vite build`). Idempotent — overwrites every build.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-02
 * @updated 2026-06-02
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = resolve(__dirname, "..");
const SOURCE = resolve(WEB_ROOT, "serve.json");
const DEST_DIR = resolve(WEB_ROOT, "dist");
const DEST = resolve(DEST_DIR, "serve.json");

if (!existsSync(SOURCE)) {
  console.error(`✗ serve.json not found at ${SOURCE}`);
  process.exit(1);
}

if (!existsSync(DEST_DIR)) {
  mkdirSync(DEST_DIR, { recursive: true });
}

copyFileSync(SOURCE, DEST);
console.log(`✓ serve.json → dist/serve.json`);
