/**
 * @file pinShareCodec.test.ts
 * @module engage-mt/services/field
 * @description Round-trip + validation coverage for the pin-share
 *              codec: every item type survives encode→decode, photos are
 *              stripped + counted, and malformed / wrong-kind / wrong-version
 *              payloads throw a typed ShareDecodeError.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-30
 * @updated 2026-07-03
 * @version 1.1.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { describe, it, expect } from "vitest";
import type { CapturedRoute, DrawnShape, Trip, Waypoint } from "@/store/field/fieldToolsStore";
import {
  buildShareBundle,
  countBundleItems,
  decodeShareBundle,
  encodeShareBundle,
  isLinkSafe,
  ShareDecodeError,
  SHARE_BUNDLE_VERSION,
  MAX_DECODE_CHARS,
} from "./pinShareCodec";

const wp = (over: Partial<Waypoint> = {}): Waypoint => ({
  id: "wp-1",
  kind: "glassing-point",
  name: "Élk saddle 7:15",
  notes: "North-facing bench, glassed 3 bulls",
  lat: 46.12345,
  lon: -111.54321,
  createdAt: "2026-06-30T13:00:00.000Z",
  updatedAt: "2026-06-30T13:00:00.000Z",
  color: "fire",
  photos: [],
  tags: ["scouting", "rut"],
  ...over,
});

const route = (over: Partial<CapturedRoute> = {}): CapturedRoute => ({
  id: "rt-1",
  name: "Pack-in trail",
  path: [
    [-111.5, 46.1],
    [-111.51, 46.11],
  ],
  distanceMi: 1.2,
  gainFt: 340,
  startedAt: "2026-06-30T12:00:00.000Z",
  endedAt: "2026-06-30T13:00:00.000Z",
  ...over,
});

const shape = (over: Partial<DrawnShape> = {}): DrawnShape => ({
  id: "sh-1",
  name: "Honey hole",
  shape: "polygon",
  vertices: [
    [-111.5, 46.1],
    [-111.51, 46.11],
    [-111.52, 46.1],
  ],
  color: "green",
  createdAt: "2026-06-30T12:00:00.000Z",
  ...over,
});

const trip = (over: Partial<Trip> = {}): Trip => ({
  id: "tr-1",
  name: "Region 3 archery",
  color: "green",
  createdAt: "2026-06-30T12:00:00.000Z",
  updatedAt: "2026-06-30T12:00:00.000Z",
  ...over,
});

describe("buildShareBundle", () => {
  it("strips photo bytes and counts the omission", () => {
    const withPhotos = wp({
      photos: [
        { id: "p1", uri: "data:image/jpeg;base64,AAAA", capturedAt: "2026-06-30T13:00:00.000Z" },
        { id: "p2", uri: "data:image/jpeg;base64,BBBB", capturedAt: "2026-06-30T13:00:00.000Z" },
      ],
    });
    const bundle = buildShareBundle({ waypoints: [withPhotos] });
    expect(bundle.photosOmitted).toBe(2);
    expect(bundle.waypoints?.[0].photos).toEqual([]);
  });

  it("only includes sections that have items", () => {
    const bundle = buildShareBundle({ waypoints: [wp()] });
    expect(bundle.waypoints).toHaveLength(1);
    expect(bundle.routes).toBeUndefined();
    expect(bundle.shapes).toBeUndefined();
    expect(bundle.trip).toBeUndefined();
  });
});

describe("encode / decode round-trip", () => {
  it("round-trips a waypoint with accents intact", () => {
    const bundle = buildShareBundle({ waypoints: [wp()] });
    const decoded = decodeShareBundle(encodeShareBundle(bundle));
    expect(decoded.waypoints?.[0].name).toBe("Élk saddle 7:15");
    expect(decoded.waypoints?.[0].kind).toBe("glassing-point");
    expect(decoded.waypoints?.[0].color).toBe("fire");
    expect(decoded.waypoints?.[0].tags).toEqual(["scouting", "rut"]);
  });

  it("round-trips routes, shapes, and a parent trip", () => {
    const bundle = buildShareBundle({
      waypoints: [wp()],
      routes: [route()],
      shapes: [shape()],
      trip: trip(),
    });
    const decoded = decodeShareBundle(encodeShareBundle(bundle));
    expect(countBundleItems(decoded)).toBe(3);
    expect(decoded.routes?.[0].distanceMi).toBeCloseTo(1.2);
    expect(decoded.shapes?.[0].shape).toBe("polygon");
    expect(decoded.trip?.name).toBe("Region 3 archery");
    expect(decoded.version).toBe(SHARE_BUNDLE_VERSION);
  });
});

describe("decode validation", () => {
  it("rejects an empty payload", () => {
    expect(() => decodeShareBundle("")).toThrow(ShareDecodeError);
  });

  it("rejects non-base64 garbage", () => {
    expect(() => decodeShareBundle("!!!not base64!!!")).toThrow(ShareDecodeError);
  });

  it("rejects a bundle with the wrong kind (e.g. a full backup)", () => {
    const encoded = encodeShareBundle({
      version: SHARE_BUNDLE_VERSION,
      // @ts-expect-error — deliberately wrong kind for the test
      kind: "backup",
      createdAt: "2026-06-30T13:00:00.000Z",
      app: { name: "engage-mt", build: "dev" },
      photosOmitted: 0,
    });
    expect(() => decodeShareBundle(encoded)).toThrow(/not an engage mt share link/i);
  });

  it("rejects an unsupported version", () => {
    const encoded = encodeShareBundle({
      // @ts-expect-error — deliberately wrong version for the test
      version: 99,
      kind: "share",
      createdAt: "2026-06-30T13:00:00.000Z",
      app: { name: "engage-mt", build: "dev" },
      photosOmitted: 0,
    });
    expect(() => decodeShareBundle(encoded)).toThrow(/unsupported share version/i);
  });

  it("rejects an oversize incoming payload before decoding it (DoS guard)", () => {
    const huge = "A".repeat(MAX_DECODE_CHARS + 1);
    expect(() => decodeShareBundle(huge)).toThrow(/too large/i);
  });

  it("does not pollute Object.prototype from a hostile __proto__ payload", () => {
    const b64url = (json: string): string => {
      const bytes = new TextEncoder().encode(json);
      let binary = "";
      for (const byte of bytes) binary += String.fromCharCode(byte);
      return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    };
    // Hand-built JSON so the literal "__proto__" / "constructor" keys are really
    // present in the payload (an object-literal { __proto__: … } would set the
    // prototype and JSON.stringify would then drop it, defeating the test).
    const rawJson =
      '{"version":' +
      String(SHARE_BUNDLE_VERSION) +
      ',"kind":"share","createdAt":"2026-06-30T13:00:00.000Z",' +
      '"app":{"name":"engage-mt","build":"dev"},"photosOmitted":0,' +
      '"__proto__":{"polluted":true},"constructor":{"polluted":true}}';
    const decoded = decodeShareBundle(b64url(rawJson));
    expect((decoded as unknown as Record<string, unknown>).polluted).toBeUndefined();
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    // The decoded bundle is frozen against downstream mutation.
    expect(Object.isFrozen(decoded)).toBe(true);
  });
});

describe("decode sanitization (CO-4 — untrusted ?d= payloads)", () => {
  // Encode a hostile bundle: cast past the types so we can inject bad fields
  // exactly as a malicious link would carry them.
  const hostile = (partial: Record<string, unknown>): string =>
    encodeShareBundle({
      version: SHARE_BUNDLE_VERSION,
      kind: "share",
      createdAt: "2026-06-30T13:00:00.000Z",
      app: { name: "engage-mt", build: "dev" },
      photosOmitted: 0,
      ...partial,
    } as unknown as Parameters<typeof encodeShareBundle>[0]);

  it("drops a waypoint with a non-numeric latitude", () => {
    const decoded = decodeShareBundle(
      hostile({ waypoints: [{ ...wp(), lat: "45.0" as unknown as number }] }),
    );
    // The only item was invalid → the section collapses to undefined.
    expect(decoded.waypoints).toBeUndefined();
  });

  it("drops a waypoint with an out-of-range latitude", () => {
    const decoded = decodeShareBundle(hostile({ waypoints: [{ ...wp(), lat: 999 }] }));
    expect(decoded.waypoints).toBeUndefined();
  });

  it("coerces an unknown kind to 'general' (the WaypointCard crash vector)", () => {
    const decoded = decodeShareBundle(
      hostile({ waypoints: [{ ...wp(), kind: "evil-injection" as unknown as Waypoint["kind"] }] }),
    );
    expect(decoded.waypoints?.[0].kind).toBe("general");
  });

  it("drops an invalid color and truncates an over-long name", () => {
    const decoded = decodeShareBundle(
      hostile({
        waypoints: [
          { ...wp(), color: "chartreuse" as unknown as Waypoint["color"], name: "z".repeat(500) },
        ],
      }),
    );
    expect(decoded.waypoints?.[0].color).toBeUndefined();
    expect(decoded.waypoints?.[0].name.length).toBeLessThanOrEqual(120);
  });

  it("coerces non-string tags to a clean string array", () => {
    const decoded = decodeShareBundle(
      hostile({ waypoints: [{ ...wp(), tags: [1, "ok", null, {}] as unknown as string[] }] }),
    );
    expect(decoded.waypoints?.[0].tags).toEqual(["ok"]);
  });

  it("drops a route whose path has no valid coordinate pairs", () => {
    const decoded = decodeShareBundle(
      hostile({
        routes: [{ ...route(), path: [["x", "y"]] as unknown as Array<[number, number]> }],
      }),
    );
    expect(decoded.routes).toBeUndefined();
  });

  it("coerces an unknown shape kind + color to safe defaults", () => {
    const decoded = decodeShareBundle(
      hostile({
        shapes: [
          {
            ...shape(),
            shape: "hexagon" as unknown as DrawnShape["shape"],
            color: "neon" as unknown as DrawnShape["color"],
          },
        ],
      }),
    );
    expect(decoded.shapes?.[0].shape).toBe("polyline");
    expect(decoded.shapes?.[0].color).toBe("blue");
  });

  it("never throws on a fully hostile item bag — it sanitizes", () => {
    expect(() =>
      decodeShareBundle(
        hostile({
          waypoints: [{ lat: {}, lon: [], kind: 42, name: 7, tags: "nope" } as unknown as Waypoint],
          routes: "not-an-array" as unknown as CapturedRoute[],
          shapes: [null, undefined, 5] as unknown as DrawnShape[],
        }),
      ),
    ).not.toThrow();
  });
});

describe("isLinkSafe", () => {
  it("is true for a single waypoint", () => {
    expect(isLinkSafe(buildShareBundle({ waypoints: [wp()] }))).toBe(true);
  });

  it("is false for a large multi-item selection (file-only fallback)", () => {
    const manyRoutes = Array.from({ length: 30 }, (_, i) =>
      route({
        id: `rt-${i}`,
        // a long densely-sampled path blows past the link budget
        path: Array.from({ length: 80 }, (_, j) => [-111.5 - j * 0.001, 46.1 + j * 0.001]),
      }),
    );
    expect(isLinkSafe(buildShareBundle({ routes: manyRoutes }))).toBe(false);
  });
});
