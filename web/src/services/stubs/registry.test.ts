/**
 * @file registry.test.ts
 * @module engage-mt/services/stubs
 * @description Structural checks on the stub registry: unique ids, every
 *              registered stub file exists, every contract doc path is
 *              well-formed.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-02
 * @updated 2026-09-05
 * @version 2.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import { STUBS } from "./registry";

const dirname = resolve(fileURLToPath(import.meta.url), "..");

describe("stub registry", () => {
  it("has unique entry ids", () => {
    const ids = STUBS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every entry with a non-null file resolves to a real .stub.ts on disk", () => {
    const missing = STUBS.filter((s) => s.file && !existsSync(resolve(dirname, s.file))).map(
      (s) => `${s.id} → ${s.file}`,
    );
    expect(missing, missing.join("\n")).toEqual([]);
  });

  it("every entry has a swap-doc path under docs/stubs/", () => {
    for (const stub of STUBS) {
      expect(stub.swapDoc).toMatch(/^docs\/stubs\/STUB-\d+\.md$/);
    }
  });
});
