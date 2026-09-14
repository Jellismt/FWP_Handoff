/**
 * @file usgsWaterServices.test.ts
 * @module engage-mt/services/public
 * @description Coverage for the NWIS instantaneous-values client: request
 *              short-circuits, parameter-code mapping, unit heuristics, and
 *              payload validation.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-08
 * @updated 2026-06-17
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { afterEach, describe, it, expect, vi } from "vitest";

const fetchJsonMock = vi.fn();
vi.mock("@/utils/http", () => ({
  fetchJson: (url: string) => fetchJsonMock(url),
  // withBackoff is the canonical retry wrapper; in tests it's a pass-through so
  // the mocked fetchJson result flows straight back.
  withBackoff: <T>(producer: () => Promise<T>) => producer(),
}));

import { fetchLatestObservations } from "./usgsWaterServices";

const nwisSeries = (
  rows: Array<{
    site: string;
    name2: string;
    code?: string;
    unit: string;
    value: string;
    dt: string;
  }>,
) => ({
  value: {
    timeSeries: rows.map((s) => ({
      sourceInfo: { siteName: s.site, siteCode: [{ value: s.site }] },
      variable: {
        variableName: s.name2,
        variableCode: s.code ? [{ value: s.code }] : undefined,
        unit: { unitCode: s.unit },
      },
      values: [{ value: [{ value: s.value, dateTime: s.dt }] }],
    })),
  },
});

describe("fetchLatestObservations", () => {
  afterEach(() => fetchJsonMock.mockReset());

  it("short-circuits to [] with no sites or no params (no fetch)", async () => {
    expect(await fetchLatestObservations([], ["discharge_cfs"])).toEqual([]);
    expect(await fetchLatestObservations(["06054500"], [])).toEqual([]);
    expect(fetchJsonMock).not.toHaveBeenCalled();
  });

  it("maps a series by its explicit variableCode", async () => {
    fetchJsonMock.mockResolvedValueOnce(
      nwisSeries([
        {
          site: "06054500",
          name2: "Streamflow",
          code: "00060",
          unit: "ft3/s",
          value: "640",
          dt: "2026-06-01T08:00:00Z",
        },
      ]),
    );
    const out = await fetchLatestObservations(["06054500"], ["discharge_cfs"]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ param: "discharge_cfs", value: 640, siteCode: "06054500" });
  });

  it("falls back to unit/name heuristics when variableCode is absent", async () => {
    fetchJsonMock.mockResolvedValueOnce(
      nwisSeries([
        {
          site: "06065500",
          name2: "Temperature, water",
          unit: "deg C",
          value: "11.5",
          dt: "2026-06-01T08:00:00Z",
        },
      ]),
    );
    const out = await fetchLatestObservations(["06065500"], ["water_temperature_c"]);
    expect(out[0].param).toBe("water_temperature_c");
  });

  it("drops non-finite values", async () => {
    fetchJsonMock.mockResolvedValueOnce(
      nwisSeries([
        {
          site: "06054500",
          name2: "Streamflow",
          code: "00060",
          unit: "ft3/s",
          value: "Ice",
          dt: "2026-06-01T08:00:00Z",
        },
      ]),
    );
    expect(await fetchLatestObservations(["06054500"], ["discharge_cfs"])).toEqual([]);
  });

  it("throws on an unexpected payload shape", async () => {
    fetchJsonMock.mockResolvedValueOnce({ nope: true });
    await expect(fetchLatestObservations(["06054500"], ["discharge_cfs"])).rejects.toThrow();
  });
});
