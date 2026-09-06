/**
 * @file manifest.coverage.test.ts
 * @module engage-mt/services/data
 * @description Guard against silent manifest regressions.
 *
 *              The build orchestrator (scripts/build-data/build_all.mjs)
 *              periodically regenerates web/public/data/data-manifest.json
 *              from its known dataset list. Commit 54710c5 demonstrated
 *              the failure mode: a regen dropped 5 regulation-dataset
 *              entries because the orchestrator's PRESERVED list was out
 *              of date. Runtime data paths kept working (consumers fetch
 *              /data/{slug}.json directly), but freshness chips,
 *              effective dates, sha256, rowCount, and source attribution
 *              went dark for those datasets — a UX regression invisible
 *              to the test suite.
 *
 *              This test pins the *minimum required* dataset ids that
 *              must always be present in the manifest. New datasets
 *              added later don't need to be added here; only the
 *              datasets that have ever been published + relied on by
 *              user-facing freshness chips / metadata displays need to
 *              be guarded.
 *
 *              When the orchestrator drops one of these ids, the test
 *              fails with a clear pointer to the PRESERVED block in
 *              build_all.mjs + this constant.
 *
 *              Complementary asserts:
 *                - No duplicate ids (catches accidental copy-paste).
 *                - Every manifest-declared file resolves on disk
 *                  (catches partial regens where the entry remains but
 *                  the file is gone).
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-03
 * @updated 2026-07-04
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

interface ManifestDataset {
  id: string;
  file: string;
}

interface Manifest {
  version: string;
  datasets: ManifestDataset[];
}

const DATA_DIR = resolve(process.cwd(), "public/data");

/**
 * Required dataset ids — these must never drop out of the manifest.
 * Add ids here when a new dataset starts driving user-facing metadata
 * (freshness chips, effectiveDate displays, source attribution).
 * Removing an id from this list is a deliberate retirement.
 *
 * The 5 ids below are the ones commit 54710c5 silently
 * dropped. They are now pinned so any future drop fails CI.
 */
const REQUIRED_DATASET_IDS: readonly string[] = ["hunting-district-facts", "usgs-gages"];

const readManifest = (): Manifest =>
  JSON.parse(readFileSync(resolve(DATA_DIR, "data-manifest.json"), "utf-8")) as Manifest;

describe("data-manifest coverage", () => {
  it("every required dataset id is still present", () => {
    const ids = new Set(readManifest().datasets.map((d) => d.id));
    const missing = REQUIRED_DATASET_IDS.filter((id) => !ids.has(id));
    expect(
      missing,
      `These required datasets were dropped from data-manifest.json:\n  ${missing.join(
        "\n  ",
      )}\nRestore them via scripts/build-data/build_all.mjs PRESERVED, or remove from REQUIRED_DATASET_IDS if intentionally retired. Background: commit 54710c5 demonstrates the failure mode.`,
    ).toEqual([]);
  });

  it("declared dataset ids are unique", () => {
    const ids = readManifest().datasets.map((d) => d.id);
    const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
    expect(dupes).toEqual([]);
  });

  it("declared file paths resolve to actual files on disk", () => {
    const onDisk = new Set(readdirSync(DATA_DIR));
    const missing = readManifest()
      .datasets.map((d) => d.file.replace(/^\/data\//, ""))
      .filter((f) => !onDisk.has(f));
    expect(
      missing,
      `These manifest entries point at files that don't exist on disk:\n  ${missing.join("\n  ")}`,
    ).toEqual([]);
  });
});
