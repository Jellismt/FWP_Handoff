/**
 * @file persistedKey.test.ts
 * @module engage-mt/store
 * @description R.2a — Characterization test for the shared persistence helper.
 *              Verifies SSR-safe fallback, encode/decode round-trip, and the
 *              `createPersistedBool` / `createPersistedJson` convenience APIs.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-06
 * @updated 2026-06-06
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { describe, expect, it, beforeEach } from "vitest";
import { createPersistedBool, createPersistedJson, createPersistedKey } from "@/store/persistedKey";

describe("createPersistedKey", () => {
  beforeEach(() => window.localStorage.clear());

  it("read returns fallback when the key is absent", () => {
    const slot = createPersistedKey<number>({
      key: "engage-mt:test-number",
      decode: (raw) => {
        const n = Number(raw);
        return Number.isFinite(n) ? n : null;
      },
      encode: (n) => String(n),
    });
    expect(slot.read(42)).toBe(42);
  });

  it("write + read round-trips a typed value", () => {
    const slot = createPersistedKey<number>({
      key: "engage-mt:test-rt",
      decode: (raw) => {
        const n = Number(raw);
        return Number.isFinite(n) ? n : null;
      },
      encode: (n) => String(n),
    });
    slot.write(17);
    expect(slot.read(0)).toBe(17);
  });

  it("clear drops the key", () => {
    const slot = createPersistedKey<number>({
      key: "engage-mt:test-clear",
      decode: (raw) => {
        const n = Number(raw);
        return Number.isFinite(n) ? n : null;
      },
      encode: (n) => String(n),
    });
    slot.write(5);
    slot.clear();
    expect(slot.read(0)).toBe(0);
  });

  it("decode that returns null falls back gracefully", () => {
    window.localStorage.setItem("engage-mt:test-bad", "not-a-number");
    const slot = createPersistedKey<number>({
      key: "engage-mt:test-bad",
      decode: (raw) => {
        const n = Number(raw);
        return Number.isFinite(n) ? n : null;
      },
      encode: (n) => String(n),
    });
    expect(slot.read(99)).toBe(99);
  });
});

describe("createPersistedBool", () => {
  beforeEach(() => window.localStorage.clear());

  it("reads/writes 'true' and 'false'", () => {
    const slot = createPersistedBool("engage-mt:test-bool");
    slot.write(true);
    expect(slot.read(false)).toBe(true);
    slot.write(false);
    expect(slot.read(true)).toBe(false);
  });

  it("garbage in storage falls back to default", () => {
    window.localStorage.setItem("engage-mt:test-bool-garbage", "yes-please");
    const slot = createPersistedBool("engage-mt:test-bool-garbage");
    expect(slot.read(false)).toBe(false);
  });
});

describe("createPersistedJson", () => {
  beforeEach(() => window.localStorage.clear());

  it("round-trips an object", () => {
    interface Shape {
      a: number;
      b: string;
    }
    const slot = createPersistedJson<Shape>("engage-mt:test-json");
    slot.write({ a: 1, b: "two" });
    expect(slot.read({ a: 0, b: "" })).toEqual({ a: 1, b: "two" });
  });

  it("invalid JSON falls back to default", () => {
    window.localStorage.setItem("engage-mt:test-json-bad", "{not json");
    const slot = createPersistedJson<{ x: number }>("engage-mt:test-json-bad");
    expect(slot.read({ x: 7 })).toEqual({ x: 7 });
  });
});
