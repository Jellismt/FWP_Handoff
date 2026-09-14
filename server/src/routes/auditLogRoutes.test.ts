/**
 * @file auditLogRoutes.test.ts
 * @module engage-mt/server/routes
 * @description The audit-log WHERE builder: every filter maps to one clause
 *              with positional params in order; no filters → no WHERE.
 * @author Jamie Ellis / Engage MT
 * @created 2026-09-06
 * @updated 2026-09-06
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { describe, expect, it, vi } from "vitest";

vi.mock("../db/pool.js", () => ({ query: vi.fn() }));
import { buildAuditWhere } from "./auditLogRoutes.js";

describe("buildAuditWhere", () => {
  it("returns an empty WHERE for no filters", () => {
    expect(buildAuditWhere({})).toEqual({ where: "", params: [] });
  });

  it("numbers params in the order the clauses appear", () => {
    const { where, params } = buildAuditWhere({
      table: "opportunity",
      user: "Editor@FWP.mt.gov",
      from: "2026-01-01T00:00:00Z",
      to: "2026-02-01T00:00:00Z",
      before: "500",
    });
    expect(where).toBe(
      "WHERE table_name = $1 AND lower(changed_by) = lower($2) AND changed_at >= $3 AND changed_at < $4 AND audit_id < $5",
    );
    expect(params).toEqual(["opportunity", "Editor@FWP.mt.gov", "2026-01-01T00:00:00Z", "2026-02-01T00:00:00Z", "500"]);
  });

  it("skips absent filters without leaving gaps in the numbering", () => {
    const { where, params } = buildAuditWhere({ user: "a", before: "9" });
    expect(where).toBe("WHERE lower(changed_by) = lower($1) AND audit_id < $2");
    expect(params).toEqual(["a", "9"]);
  });
});
