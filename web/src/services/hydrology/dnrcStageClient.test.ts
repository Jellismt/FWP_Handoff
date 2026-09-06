/**
 * @file dnrcStageClient.test.ts
 * @module engage-mt/services/hydrology
 * @description Unit coverage for the DNRC StAGE live-reading client. The
 *              ArcGIS table query is mocked at the `fetchArcgisQuery` seam;
 *              tests assert sensor classification, sentinel filtering, °C→°F
 *              normalization, and the station reduction to cfs / °F / ft.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-14
 * @updated 2026-09-05
 * @version 2.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ fetchArcgisQuery: vi.fn() }));
vi.mock("@/utils/http", () => ({ fetchArcgisQuery: h.fetchArcgisQuery }));

import { __resetAllCaches } from "@/services/cache/ttlCache";
import { fetchDnrcSensors, fetchDnrcStage } from "./dnrcStageClient";

const feat = (attributes: Record<string, unknown>) => ({ attributes });

beforeEach(() => {
  __resetAllCaches();
  h.fetchArcgisQuery.mockReset();
});

describe("fetchDnrcSensors", () => {
  it("classifies QR/TW/HG, normalizes °C→°F, and nulls sentinel readings", async () => {
    h.fetchArcgisQuery.mockResolvedValueOnce({
      features: [
        feat({
          SensorID: "hg1",
          Parameter: "HG",
          UnitOfMeasure: "ft",
          RecordedValue: 3.6,
          RecordedOn: 100,
        }),
        feat({
          SensorID: "tw1",
          Parameter: "TW",
          UnitOfMeasure: "degC",
          RecordedValue: 10,
          RecordedOn: 100,
        }),
        feat({
          SensorID: "qr1",
          Parameter: "QR",
          UnitOfMeasure: "ft^3/s",
          RecordedValue: 206.1,
          RecordedOn: 200,
        }),
        feat({
          SensorID: "dead",
          Parameter: "QR",
          UnitOfMeasure: "ft^3/s",
          RecordedValue: 9_999_999,
          RecordedOn: 50,
        }),
      ],
    });
    const sensors = await fetchDnrcSensors("40A 10000");
    expect(sensors.map((s) => s.kind)).toEqual(["stage", "temp", "flow", "flow"]);
    expect(sensors.find((s) => s.sensorId === "qr1")?.value).toBeCloseTo(206.1);
    expect(sensors.find((s) => s.sensorId === "dead")?.value).toBeNull();
    expect(sensors.find((s) => s.sensorId === "tw1")?.value).toBeCloseTo(50);
  });

  it("returns [] on an empty or failed response and for a blank code", async () => {
    expect(await fetchDnrcSensors("")).toEqual([]);
    h.fetchArcgisQuery.mockResolvedValueOnce(null);
    expect(await fetchDnrcSensors("X")).toEqual([]);
  });
});

describe("fetchDnrcStage", () => {
  it("reduces the station's sensors to cfs / °F / ft with the newest timestamp", async () => {
    h.fetchArcgisQuery.mockResolvedValueOnce({
      features: [
        feat({
          SensorID: "qr1",
          Parameter: "QR",
          UnitOfMeasure: "ft^3/s",
          RecordedValue: 206.1,
          RecordedOn: 300,
        }),
        feat({
          SensorID: "tw1",
          Parameter: "TW",
          UnitOfMeasure: "degF",
          RecordedValue: 58.2,
          RecordedOn: 200,
        }),
        feat({
          SensorID: "hg1",
          Parameter: "HG",
          UnitOfMeasure: "ft",
          RecordedValue: 2.71,
          RecordedOn: 100,
        }),
      ],
    });
    const stage = await fetchDnrcStage("40A 10000");
    expect(stage.cfs).toBeCloseTo(206.1);
    expect(stage.tempF).toBeCloseTo(58.2); // already °F, not re-converted
    expect(stage.stageFt).toBeCloseTo(2.71);
    expect(stage.observedAt).toBe(300);
  });

  it("prefers a reporting sensor over a newer one that is not reporting", async () => {
    h.fetchArcgisQuery.mockResolvedValueOnce({
      features: [
        feat({
          SensorID: "qr-old",
          Parameter: "QR",
          UnitOfMeasure: "ft^3/s",
          RecordedValue: 150,
          RecordedOn: 100,
        }),
        feat({
          SensorID: "qr-new",
          Parameter: "QR",
          UnitOfMeasure: "ft^3/s",
          RecordedValue: null,
          RecordedOn: 900,
        }),
      ],
    });
    const stage = await fetchDnrcStage("40A 10000");
    expect(stage.cfs).toBe(150);
  });

  it("degrades to all-null when the station has no sensors", async () => {
    h.fetchArcgisQuery.mockResolvedValue({ features: [] });
    const stage = await fetchDnrcStage("EMPTY");
    expect(stage).toEqual({
      locationCode: "EMPTY",
      cfs: null,
      tempF: null,
      stageFt: null,
      observedAt: null,
    });
  });
});
