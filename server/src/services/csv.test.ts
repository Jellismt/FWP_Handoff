/**
 * @file csv.test.ts
 * @module engage-mt/server/services
 * @description Quoting, escaping, null handling, column order, and the
 *              spreadsheet formula-injection guard.
 * @author Jamie Ellis / Engage MT
 * @created 2026-09-06
 * @updated 2026-09-06
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { describe, expect, it } from "vitest";
import { csvCell, toCsv } from "./csv.js";

describe("csvCell", () => {
  it("leaves plain text alone and quotes commas, quotes, and newlines", () => {
    expect(csvCell("plain")).toBe("plain");
    expect(csvCell("a,b")).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell("line1\nline2")).toBe('"line1\nline2"');
  });

  it("renders null/undefined as empty and objects as JSON", () => {
    expect(csvCell(null)).toBe("");
    expect(csvCell(undefined)).toBe("");
    expect(csvCell({ a: 1 })).toBe('"{""a"":1}"');
  });

  it("neutralizes spreadsheet formulas", () => {
    expect(csvCell("=SUM(A1)")).toBe("'=SUM(A1)");
    expect(csvCell("+1")).toBe("'+1");
    expect(csvCell("-1")).toBe("'-1");
    expect(csvCell("@cmd")).toBe("'@cmd");
  });
});

describe("toCsv", () => {
  it("emits a header, the rows in column order, and CRLF line ends", () => {
    const csv = toCsv([{ b: 2, a: "x,y" }, { a: null, b: "=1" }], ["a", "b"]);
    expect(csv).toBe('a,b\r\n"x,y",2\r\n,\'=1\r\n');
  });
});
