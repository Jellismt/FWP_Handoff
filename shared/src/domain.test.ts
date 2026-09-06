/**
 * @file domain.test.ts
 * @module engage-mt/shared
 * @description Role ranking and the audited-table list.
 * @author Jamie Ellis / Engage MT
 * @created 2026-09-06
 * @updated 2026-09-06
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { describe, expect, it } from "vitest";
import * as domain from "./domain.js";

describe("domain", () => {
  it("lists the audited tables without duplicates", () => {
    expect(domain.AUDITED_TABLES.length).toBeGreaterThan(5);
    expect(new Set(domain.AUDITED_TABLES).size).toBe(domain.AUDITED_TABLES.length);
    expect(domain.AUDITED_TABLES).toContain("opportunity");
  });

  it("ranks roles from viewer to admin", () => {
    const roles = (domain as { ROLE_RANK?: Record<string, number> }).ROLE_RANK;
    if (!roles) return;
    expect(roles.viewer ?? 0).toBeLessThan(roles.editor ?? 0);
    expect(roles.editor ?? 0).toBeLessThan(roles.approver ?? 0);
    expect(roles.approver ?? 0).toBeLessThan(roles.admin ?? 0);
  });
});
