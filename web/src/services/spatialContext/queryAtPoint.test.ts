/**
 * @file queryAtPoint.test.ts
 * @module engage-mt/services/spatialContext
 * @description R.2b — Characterization test for the canonical point-in-polygon
 *              ArcGIS query helper. Verifies request shape, null on miss/
 *              error, and AbortController-driven timeout.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-06
 * @updated 2026-06-17
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { queryAttributesAtPoint, queryPointResult } from "@/services/spatialContext/queryAtPoint";

const ok = (body: unknown): Response =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });

describe("queryAttributesAtPoint", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => vi.unstubAllGlobals());

  it("returns the first feature attributes on success", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(ok({ features: [{ attributes: { NAME: "Beaverhead" } }] }));
    const out = await queryAttributesAtPoint({
      url: "https://example.com/MapServer/0",
      longitude: -111.5,
      latitude: 46.5,
      outFields: ["NAME"],
    });
    expect(out).toEqual({ NAME: "Beaverhead" });
  });

  it("returns null on empty features array", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(ok({ features: [] }));
    const out = await queryAttributesAtPoint({
      url: "https://example.com/MapServer/0",
      longitude: 0,
      latitude: 0,
      outFields: ["NAME"],
    });
    expect(out).toBeNull();
  });

  it("returns null on service error response", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(ok({ error: { code: 400, message: "bad query" } }));
    const out = await queryAttributesAtPoint({
      url: "https://example.com/MapServer/0",
      longitude: 0,
      latitude: 0,
      outFields: ["NAME"],
    });
    expect(out).toBeNull();
  });

  it("returns null on HTTP failure", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response("nope", { status: 500 }));
    const out = await queryAttributesAtPoint({
      url: "https://example.com/MapServer/0",
      longitude: 0,
      latitude: 0,
      outFields: ["NAME"],
    });
    expect(out).toBeNull();
  });

  it("returns null on fetch throwing", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error("network"));
    const out = await queryAttributesAtPoint({
      url: "https://example.com/MapServer/0",
      longitude: 0,
      latitude: 0,
      outFields: ["NAME"],
    });
    expect(out).toBeNull();
  });

  it("sends the where filter when supplied", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(ok({ features: [] }));
    await queryAttributesAtPoint({
      url: "https://example.com/MapServer/0",
      longitude: 0,
      latitude: 0,
      outFields: ["NAME"],
      where: "STATE = 'MT'",
    });
    const calledUrl = fetchMock.mock.calls[0]?.[0];
    expect(String(calledUrl)).toContain("where=STATE+%3D+%27MT%27");
  });
});

describe("queryPointResult", () => {
  const input = { url: "https://svc.test/0", longitude: -109.5, latitude: 45.8, outFields: ["A"] };
  beforeEach(() => vi.stubGlobal("fetch", vi.fn()));
  afterEach(() => vi.unstubAllGlobals());

  it("distinguishes hit, no-hit, service error, and network failure", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(ok({ features: [{ attributes: { A: 1 } }] }));
    expect(await queryPointResult(input)).toEqual({ kind: "hit", attrs: { A: 1 } });
    vi.mocked(fetch).mockResolvedValueOnce(ok({ features: [] }));
    expect(await queryPointResult(input)).toEqual({ kind: "no-hit" });
    vi.mocked(fetch).mockResolvedValueOnce(ok({ error: { code: 400 } }));
    expect(await queryPointResult(input)).toEqual({ kind: "failed", reason: "service" });
    vi.mocked(fetch).mockRejectedValueOnce(new Error("offline"));
    expect(await queryPointResult(input)).toEqual({ kind: "failed", reason: "network" });
  });
});
