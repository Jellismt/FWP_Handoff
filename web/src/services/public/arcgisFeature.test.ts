/**
 * @file arcgisFeature.test.ts
 * @module engage-mt/services/public
 * @description Backend A+ pass — covers the lightweight ArcGIS REST helper:
 *              bearing math, {id} injection-safety, and graceful
 *              typed-error behavior.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-13
 * @updated 2026-07-04
 * @version 1.1.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

const fetchJsonMock = vi.fn();
vi.mock("@/utils/http", () => ({
  fetchJson: (url: string, opts?: unknown) => fetchJsonMock(url, opts),
}));

import { bearingDegrees, fetchFeatureById } from "./arcgisFeature";

afterEach(() => fetchJsonMock.mockReset());

describe("bearingDegrees", () => {
  it("returns ~0° due north", () => {
    expect(bearingDegrees(45, -111, 46, -111)).toBeCloseTo(0, 1);
  });
  it("returns ~90° due east", () => {
    expect(bearingDegrees(45, -111, 45, -110)).toBeGreaterThan(80);
    expect(bearingDegrees(45, -111, 45, -110)).toBeLessThan(100);
  });
});

describe("fetchFeatureById", () => {
  it("strips injection characters from the id before binding {id}", async () => {
    fetchJsonMock.mockResolvedValueOnce({ features: [{ attributes: { NAME: "X" } }] });
    await fetchFeatureById({ url: "https://svc.test/0", id: "12' OR 1=1 --" });
    const url = decodeURIComponent(String(fetchJsonMock.mock.calls[0]![0])).replace(/\+/g, " ");
    // Only [A-Za-z0-9_-.] survive: quotes/spaces/= are stripped, dashes kept.
    expect(url).toContain("OBJECTID = 12OR11--");
    expect(url).not.toContain("'");
  });

  it("returns null for an id that is entirely illegal characters", async () => {
    await expect(fetchFeatureById({ url: "https://svc.test/0", id: "''" })).resolves.toBeNull();
    expect(fetchJsonMock).not.toHaveBeenCalled();
  });

  it("throws when the service returns an error envelope", async () => {
    fetchJsonMock.mockResolvedValueOnce({ error: { code: 500, message: "boom" } });
    await expect(fetchFeatureById({ url: "https://svc.test/0", id: "5" })).rejects.toBeTruthy();
  });
});
