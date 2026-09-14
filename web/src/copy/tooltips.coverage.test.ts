/**
 * @file tooltips.coverage.test.ts
 * @module engage-mt/copy
 * @description Drift gate for the TOOLTIPS catalog. `tooltips.ts` calls itself
 *              the single source of truth for hover copy; this test holds it to
 *              that. An unreferenced entry is
 *              worse than no entry — it reads like shipped accessibility work
 *              that was never actually wired to a control.
 *
 *              So this test walks web/src and fails on any key nothing
 *              references (`TOOLTIPS.someKey`). The fix for a failure is one of
 *              two things, never a third: wire the key to the control that owns
 *              it, or delete the key. Do NOT add an allowlist — an exemption
 *              list is how the catalog drifted in the first place.
 *
 *              The reverse direction (a hardcoded string that SHOULD be a
 *              catalog key) can't be caught mechanically; that stays a
 *              review-time judgement documented in tooltips.ts.
 * @author Jamie Ellis / Engage MT
 * @created 2026-08-11
 * @updated 2026-08-11
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { TOOLTIPS } from "./tooltips";

// Same resolution idiom as services/stubs/registry.test.ts.
const SRC = resolve(fileURLToPath(import.meta.url), "..", "..");
const CATALOG = join(SRC, "copy", "tooltips.ts");

/** Every .ts/.tsx under web/src except the catalog itself and this test. */
const sourceFiles = (dir: string, out: string[] = []): string[] => {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) sourceFiles(path, out);
    else if (/\.(ts|tsx)$/.test(entry) && path !== CATALOG && !path.endsWith(".coverage.test.ts"))
      out.push(path);
  }
  return out;
};

describe("TOOLTIPS catalog coverage", () => {
  const corpus = sourceFiles(SRC)
    .map((f) => readFileSync(f, "utf8"))
    .join("\n");

  it("every key is referenced by at least one component", () => {
    const orphans = Object.keys(TOOLTIPS).filter(
      // Property access is the only supported consumption pattern (the catalog
      // is `as const`, so there is no dynamic-index path to miss).
      (key) => !new RegExp(`TOOLTIPS\\.${key}\\b`).test(corpus),
    );
    expect(
      orphans,
      `Unreferenced TOOLTIPS keys — wire each to the control that owns it, or delete it:\n` +
        orphans.map((k) => `  · ${k}`).join("\n"),
    ).toEqual([]);
  });

  it("no entry is blank or placeholder text", () => {
    for (const [key, value] of Object.entries(TOOLTIPS)) {
      expect(value.trim(), `${key} is empty`).not.toBe("");
      expect(value, `${key} looks like placeholder copy`).not.toMatch(/^(TODO|TBD|FIXME)/i);
    }
  });
});
