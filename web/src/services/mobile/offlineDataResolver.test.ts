/**
 * @file offlineDataResolver.test.ts
 * @module engage-mt/services/mobile
 * @description Unit tests for the offline tap-to-identify resolver. Verifies the
 *              web no-op and the no-coverage short-circuit; the filesystem read +
 *              point-in-polygon path is device-only and exercised on the emulator.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-14
 * @updated 2026-07-14
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

const isCapacitor = vi.fn();
const listDownloadedAreas = vi.fn();

vi.mock("@/utils/capacitor", () => ({ isCapacitor: () => isCapacitor() }));
vi.mock("./offlineTileResolver", () => ({ listDownloadedAreas: () => listDownloadedAreas() }));

import { resolveOfflineFeaturesAtPoint } from "./offlineDataResolver";

const AREA = { id: "a1", bbox: { north: 46, south: 45, east: -110, west: -111 }, maxZoom: 14 };

beforeEach(() => {
  isCapacitor.mockReset();
  listDownloadedAreas.mockReset();
});

describe("resolveOfflineFeaturesAtPoint", () => {
  it("returns empty on web (no filesystem read)", async () => {
    isCapacitor.mockReturnValue(false);
    const hits = await resolveOfflineFeaturesAtPoint(-110.5, 45.5, ["mt-cadastral"]);
    expect(hits).toEqual([]);
    expect(listDownloadedAreas).not.toHaveBeenCalled();
  });

  it("returns empty when no downloaded area covers the point", async () => {
    isCapacitor.mockReturnValue(true);
    listDownloadedAreas.mockReturnValue([AREA]);
    // Point far outside the area bbox.
    const hits = await resolveOfflineFeaturesAtPoint(-100, 30, ["mt-cadastral"]);
    expect(hits).toEqual([]);
  });

  it("returns empty when there are no downloaded areas at all", async () => {
    isCapacitor.mockReturnValue(true);
    listDownloadedAreas.mockReturnValue([]);
    const hits = await resolveOfflineFeaturesAtPoint(-110.5, 45.5, ["mt-cadastral"]);
    expect(hits).toEqual([]);
  });
});
