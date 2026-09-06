/**
 * @file relativeTime.test.ts
 * @module engage-mt/utils
 * @description Unit tests for the "as of …" relative-time formatter.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-14
 * @updated 2026-07-14
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { formatRelativeTime, formatAsOf } from "./relativeTime";

const NOW = new Date("2026-07-14T12:00:00.000Z").getTime();

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

const iso = (msAgo: number): string => new Date(NOW - msAgo).toISOString();

describe("formatRelativeTime", () => {
  it("returns 'just now' for very recent timestamps", () => {
    expect(formatRelativeTime(iso(5_000))).toBe("just now");
  });

  it("formats minutes", () => {
    expect(formatRelativeTime(iso(5 * 60_000))).toBe("5 min ago");
  });

  it("formats hours", () => {
    expect(formatRelativeTime(iso(2 * 3_600_000))).toBe("2 hr ago");
  });

  it("formats days with pluralization", () => {
    expect(formatRelativeTime(iso(24 * 3_600_000))).toBe("1 day ago");
    expect(formatRelativeTime(iso(3 * 24 * 3_600_000))).toBe("3 days ago");
  });

  it("falls back to a date for older than a week", () => {
    const out = formatRelativeTime(iso(10 * 24 * 3_600_000));
    expect(out).not.toMatch(/ago/);
    expect(out).toBeTruthy();
  });

  it("returns null for an unparseable string", () => {
    expect(formatRelativeTime("not a date")).toBeNull();
  });
});

describe("formatAsOf", () => {
  it("prefixes 'as of'", () => {
    expect(formatAsOf(iso(2 * 3_600_000))).toBe("as of 2 hr ago");
  });

  it("returns null for an unparseable string", () => {
    expect(formatAsOf("nope")).toBeNull();
  });
});
