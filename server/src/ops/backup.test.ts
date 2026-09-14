/**
 * @file backup.test.ts
 * @module engage-mt/server/ops
 * @description Dump naming, rotation, maintenance URL, version parsing, and the
 *              production-URL guard.
 * @author Jamie Ellis / Engage MT
 * @created 2026-09-06
 * @updated 2026-09-06
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { describe, expect, it } from "vitest";
import {
  assertScratchIsNotProduction,
  databaseName,
  deriveMaintenanceUrl,
  dumpFileName,
  parseMajorVersion,
  selectDumpsToDelete,
} from "./backup.js";

describe("backup helpers", () => {
  it("names dumps by UTC timestamp", () => {
    expect(dumpFileName(new Date("2026-09-06T14:05:00Z"))).toBe("regs-20260906-1405.dump");
  });

  it("keeps the newest N dumps and ignores unrelated files", () => {
    const names = ["regs-20260901-0000.dump", "notes.txt", "regs-20260903-0000.dump", "regs-20260902-0000.dump"];
    expect(selectDumpsToDelete(names, 2)).toEqual(["regs-20260901-0000.dump"]);
    expect(selectDumpsToDelete(names, 5)).toEqual([]);
  });

  it("derives the maintenance database and the database name", () => {
    expect(deriveMaintenanceUrl("postgres://u:p@h:5432/regs?sslmode=require")).toBe("postgres://u:p@h:5432/postgres?sslmode=require");
    expect(deriveMaintenanceUrl("postgres://u:p@h/regs")).toBe("postgres://u:p@h/postgres");
    expect(databaseName("postgres://u:p@h:5432/regs_test?x=1")).toBe("regs_test");
  });

  it("parses major versions from pg_dump and server_version strings", () => {
    expect(parseMajorVersion("pg_dump (PostgreSQL) 16.4")).toBe(16);
    expect(parseMajorVersion("18.1 (Debian)")).toBe(18);
    expect(parseMajorVersion("garbage")).toBeNull();
  });

  it("refuses a rehearsal against the production URL", () => {
    expect(() => assertScratchIsNotProduction("postgres://a/regs", "postgres://a/regs")).toThrow(/must not be/);
    expect(() => assertScratchIsNotProduction("postgres://a/scratch", "postgres://a/regs")).not.toThrow();
    expect(() => assertScratchIsNotProduction("postgres://a/scratch", undefined)).not.toThrow();
  });
});
