/**
 * @file check-bundle-size.test.mjs
 * @module engage-mt/scripts
 * @description Budget rules for the bundle-size gate.
 * @author Jamie Ellis / Engage MT
 * @created 2026-09-06
 * @updated 2026-09-06
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { describe, expect, it } from "vitest";
import { evaluateBudgets, formatBytes } from "./check-bundle-size.mjs";

const budgets = { main_gzip_bytes: 100, vendor_esri_gzip_bytes: 500, total_gzip_bytes: 1000 };

describe("evaluateBudgets", () => {
  it("passes when every chunk and the total are within budget", () => {
    const { problems, report } = evaluateBudgets(
      { "index-abc.js": 90, "vendor-esri-x.js": 450, "lazy-1.js": 200 },
      budgets,
    );
    expect(problems).toEqual([]);
    expect(report).toHaveLength(3);
  });

  it("picks the largest index chunk as the entry and flags overruns", () => {
    const { problems } = evaluateBudgets(
      { "index-tiny.js": 5, "index-big.js": 130, "vendor-esri-x.js": 600, "lazy.js": 400 },
      budgets,
    );
    expect(problems).toEqual([
      "main chunk: over budget by 30 B",
      "esri vendor: over budget by 100 B",
      "Total JS over budget by 135 B",
    ]);
  });

  it("fails when the entry or the Esri vendor chunk is missing", () => {
    const { problems } = evaluateBudgets({ "lazy.js": 1 }, budgets);
    expect(problems).toEqual(["No main chunk: chunk found in dist/assets.", "No esri vendor: chunk found in dist/assets."]);
  });

  it("formats bytes for humans", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(4_150_000)).toBe("4.15 MB");
  });
});
