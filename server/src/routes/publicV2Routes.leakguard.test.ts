/**
 * @file publicV2Routes.leakguard.test.ts
 * @module engage-mt/server/routes
 * @description Tripwire for the public-API draft-leak class: every
 *              public v2 read of a draft-workflow table must either read a published_*
 *              snapshot or filter record_status='PUBLISHED'. These are source-level
 *              assertions (no DB) — they pin the exact regression, like the repo's
 *              check:* gates. If you legitimately change the queries, update the pins.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-07
 * @updated 2026-07-14
 * @version 1.1.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const routesSrc = readFileSync(join(here, "publicV2Routes.ts"), "utf8");
const publishSrc = readFileSync(join(here, "..", "services", "publish.ts"), "utf8");

describe("public v2 draft-leak guard", () => {
  it("youth-opportunities reads only PUBLISHED opportunity rows", () => {
    // A <>'ARCHIVED' filter would also match DRAFT rows and leak
    // unpublished edits. The filter must be an exact PUBLISHED match.
    expect(routesSrc).toContain("o.record_status='PUBLISHED'");
    expect(routesSrc).not.toContain("o.record_status<>'ARCHIVED'");
  });

  it("district-notes reads the published snapshot, never the working table", () => {
    expect(routesSrc).toContain("/hunting/district-notes");
    expect(routesSrc).toContain("regs.published_district_notes");
    expect(routesSrc).not.toMatch(/FROM regs\.district_note\b/);
  });

  it("publish materializes the district-notes snapshot in the same transaction", () => {
    expect(publishSrc).toContain("INSERT INTO regs.published_district_notes");
    expect(publishSrc).toContain("dn.record_status = 'PUBLISHED'");
  });

  it("corrections feed reads only the publication event, never draft content", () => {
    // /hunting/corrections is a metadata feed off regs.publication (a per-version
    // marker). It must never touch a draft-workflow table, so it cannot leak.
    expect(routesSrc).toContain("/hunting/corrections");
    expect(routesSrc).toMatch(/FROM regs\.publication\b/);
    expect(routesSrc).toContain("is_correction = true");
  });

  it("publish flags v2+ as a correction", () => {
    // A re-publish of an already-live year (version >= 2) is a mid-year correction.
    expect(publishSrc).toContain("const isCorrection = version >= 2");
    expect(publishSrc).toContain("is_correction");
  });
});
