/**
 * @file api.test.ts
 * @module engage-mt/shared
 * @description Envelope helpers and the staff query schemas, including the
 *              audit-log query and export.
 * @author Jamie Ellis / Engage MT
 * @created 2026-09-06
 * @updated 2026-09-06
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { describe, expect, it } from "vitest";
import { fail, ok } from "./api.js";
import { auditLogExportSchema, auditLogQuerySchema } from "./staffSchemas.js";

describe("envelopes", () => {
  it("ok wraps data with a counted meta and passes extra meta through", () => {
    const env = ok([1, 2], { generatedAt: "2026-09-06T00:00:00Z", version: 4 });
    expect(env.data).toEqual([1, 2]);
    expect(env.meta?.count).toBe(2);
    expect(env.meta?.version).toBe(4);
    expect(env.meta?.schemaVersion).toBeTruthy();
  });

  it("fail carries typed errors", () => {
    const env = fail([{ code: "NOT_FOUND", message: "nope" }]);
    expect(env.errors?.[0]?.code).toBe("NOT_FOUND");
  });
});

describe("audit log query schema", () => {
  it("applies defaults and accepts a valid filter", () => {
    const q = auditLogQuerySchema.parse({ table: "opportunity", user: "E@FWP.MT.GOV", from: "2026-01-01T00:00:00Z" });
    expect(q.limit).toBe(100);
    expect(q.table).toBe("opportunity");
  });

  it("rejects an unknown table, an out-of-range limit, and from after to", () => {
    expect(auditLogQuerySchema.safeParse({ table: "secrets" }).success).toBe(false);
    expect(auditLogQuerySchema.safeParse({ limit: 5000 }).success).toBe(false);
    expect(
      auditLogQuerySchema.safeParse({ from: "2026-02-01T00:00:00Z", to: "2026-01-01T00:00:00Z" }).success,
    ).toBe(false);
  });

  it("the export schema has no cursor or limit", () => {
    const parsed = auditLogExportSchema.parse({ table: "opportunity" });
    expect("limit" in parsed).toBe(false);
    expect("before" in parsed).toBe(false);
  });
});
