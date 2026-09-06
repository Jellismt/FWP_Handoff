/**
 * @file trackRecorder.test.ts
 * @module engage-mt/services/field
 * @description Track-recorder state machine + sample
 *              filtering. Uses a stubbed `navigator.geolocation` so
 *              tests are deterministic without a real GPS device.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-02
 * @updated 2026-07-03
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { thinSamples, useTrackRecorderStore } from "@/services/field/trackRecorder";
import { useFieldToolsStore } from "@/store/field/fieldToolsStore";

// Build a fresh stubbed geolocation per test that captures the
// success + error callbacks so the test body can drive samples.
interface GeoStub {
  success: PositionCallback | null;
  error: PositionErrorCallback | null;
  clearCalls: number;
}

const installGeoStub = (): GeoStub => {
  const stub: GeoStub = { success: null, error: null, clearCalls: 0 };
  Object.defineProperty(navigator, "geolocation", {
    configurable: true,
    value: {
      watchPosition: (success: PositionCallback, error?: PositionErrorCallback) => {
        stub.success = success;
        stub.error = error ?? null;
        return 1;
      },
      clearWatch: () => {
        stub.clearCalls += 1;
      },
      getCurrentPosition: () => undefined,
    },
  });
  return stub;
};

const emit = (
  stub: GeoStub,
  lon: number,
  lat: number,
  accuracy = 10,
  altitudeM?: number,
  altitudeAccuracyM?: number,
): void => {
  stub.success?.({
    coords: {
      longitude: lon,
      latitude: lat,
      accuracy,
      altitude: altitudeM ?? null,
      altitudeAccuracy: altitudeAccuracyM ?? null,
      heading: null,
      speed: null,
      toJSON: () => ({}),
    } as GeolocationCoordinates,
    timestamp: Date.now(),
    toJSON: () => ({}),
  } as GeolocationPosition);
};

const resetStores = (): void => {
  useTrackRecorderStore.getState().discard();
  useFieldToolsStore.setState({
    waypoints: [],
    routes: [],
    shapes: [],
    measurements: [],
  });
};

describe("trackRecorder state machine", () => {
  let stub: GeoStub;

  beforeEach(() => {
    vi.useRealTimers();
    stub = installGeoStub();
    resetStores();
  });

  it("starts idle with zeroed stats", () => {
    const s = useTrackRecorderStore.getState();
    expect(s.status).toBe("idle");
    expect(s.path).toEqual([]);
    expect(s.distanceMeters).toBe(0);
    expect(s.gainFt).toBe(0);
    expect(s.gpsError).toBeNull();
  });

  it("start() transitions to recording + sets startedAt", () => {
    useTrackRecorderStore.getState().start();
    const s = useTrackRecorderStore.getState();
    expect(s.status).toBe("recording");
    expect(s.startedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("accumulates distance across two samples that exceed MIN_DELTA_M", async () => {
    useTrackRecorderStore.getState().start();
    // Async watch handle resolves on the next microtask; flush.
    await Promise.resolve();
    emit(stub, -111.0, 46.0, 10);
    // Move ~100 m north (1 degree lat ≈ 111 km).
    emit(stub, -111.0, 46.0009, 10);
    const s = useTrackRecorderStore.getState();
    expect(s.path).toHaveLength(2);
    expect(s.distanceMeters).toBeGreaterThan(50);
    expect(s.distanceMeters).toBeLessThan(150);
  });

  it("drops samples beyond MAX_ACCURACY_M (50 m)", async () => {
    useTrackRecorderStore.getState().start();
    await Promise.resolve();
    emit(stub, -111.0, 46.0, 10);
    emit(stub, -111.0, 46.0009, 200); // too noisy — dropped
    const s = useTrackRecorderStore.getState();
    expect(s.path).toHaveLength(1);
  });

  it("drops samples within MIN_DELTA_M (5 m) of the previous", async () => {
    useTrackRecorderStore.getState().start();
    await Promise.resolve();
    emit(stub, -111.0, 46.0, 10);
    // Move only ~0.5 m east — below the 5 m floor.
    emit(stub, -111.000005, 46.0, 10);
    const s = useTrackRecorderStore.getState();
    expect(s.path).toHaveLength(1);
  });

  it("pause() → resume() resumes sample collection", async () => {
    useTrackRecorderStore.getState().start();
    await Promise.resolve();
    emit(stub, -111.0, 46.0, 10);
    useTrackRecorderStore.getState().pause();
    expect(useTrackRecorderStore.getState().status).toBe("paused");
    useTrackRecorderStore.getState().resume();
    await Promise.resolve();
    expect(useTrackRecorderStore.getState().status).toBe("recording");
    emit(stub, -111.0, 46.0009, 10);
    expect(useTrackRecorderStore.getState().path).toHaveLength(2);
  });

  it("stop(name) saves a CapturedRoute via fieldToolsStore.addRoute", async () => {
    useTrackRecorderStore.getState().start();
    await Promise.resolve();
    emit(stub, -111.0, 46.0, 10);
    emit(stub, -111.0, 46.0009, 10);
    const id = useTrackRecorderStore.getState().stop("My track", "windy");
    expect(typeof id).toBe("string");
    const routes = useFieldToolsStore.getState().routes;
    expect(routes).toHaveLength(1);
    expect(routes[0].name).toBe("My track");
    expect(routes[0].notes).toBe("windy");
    expect(routes[0].path.length).toBe(2);
    expect(useTrackRecorderStore.getState().status).toBe("idle");
  });

  it("discard() drops the buffer + does NOT add a route", async () => {
    useTrackRecorderStore.getState().start();
    await Promise.resolve();
    emit(stub, -111.0, 46.0, 10);
    useTrackRecorderStore.getState().discard();
    expect(useTrackRecorderStore.getState().status).toBe("idle");
    expect(useTrackRecorderStore.getState().path).toEqual([]);
    expect(useFieldToolsStore.getState().routes).toHaveLength(0);
  });

  it("watchPosition error code 1 surfaces a permission-denied banner", async () => {
    useTrackRecorderStore.getState().start();
    await Promise.resolve();
    stub.error?.({
      code: 1,
      message: "User denied",
      PERMISSION_DENIED: 1,
      POSITION_UNAVAILABLE: 2,
      TIMEOUT: 3,
    } as GeolocationPositionError);
    const s = useTrackRecorderStore.getState();
    expect(s.gpsError).toMatch(/permission denied/i);
    expect(s.status).toBe("paused");
  });

  it("pause() while idle is a no-op", () => {
    useTrackRecorderStore.getState().pause();
    expect(useTrackRecorderStore.getState().status).toBe("idle");
  });

  it("resume() while idle is a no-op", () => {
    useTrackRecorderStore.getState().resume();
    expect(useTrackRecorderStore.getState().status).toBe("idle");
  });

  it("stop() while idle returns null + does not crash", () => {
    expect(useTrackRecorderStore.getState().stop("X")).toBeNull();
  });
});

describe("trackRecorder — segments, accuracy, gain, watchdog", () => {
  let stub: GeoStub;
  beforeEach(() => {
    vi.useRealTimers();
    stub = installGeoStub();
    resetStores();
  });

  it("resume() starts a new segment and does not count the gap as distance", async () => {
    useTrackRecorderStore.getState().start();
    await vi.waitFor(() => expect(stub.success).not.toBeNull());
    emit(stub, -111.0, 46.0, 10);
    emit(stub, -111.0, 46.0009, 10);
    const walked = useTrackRecorderStore.getState().distanceMeters;
    useTrackRecorderStore.getState().pause();
    useTrackRecorderStore.getState().resume();
    await vi.waitFor(() => expect(stub.success).not.toBeNull());
    emit(stub, -111.02, 46.02, 10);
    emit(stub, -111.02, 46.0209, 10);
    const s = useTrackRecorderStore.getState();
    expect(s.segments).toEqual([0, 2]);
    expect(s.distanceMeters).toBeCloseTo(walked * 2, 0);
    const id = s.stop("Gappy");
    const saved = useFieldToolsStore.getState().routes.find((r) => r.id === id);
    expect(saved?.segments).toEqual([0, 2]);
  });

  it("a long silence between fixes also starts a new segment", async () => {
    useTrackRecorderStore.getState().start();
    await vi.waitFor(() => expect(stub.success).not.toBeNull());
    emit(stub, -111.0, 46.0, 10);
    useTrackRecorderStore.setState({ _lastSampleMs: performance.now() - 200_000 });
    emit(stub, -111.0, 46.01, 10);
    expect(useTrackRecorderStore.getState().segments).toEqual([0, 1]);
    expect(useTrackRecorderStore.getState().distanceMeters).toBe(0);
  });

  it("saves the median accuracy of accepted fixes and clears a GPS error on a good fix", async () => {
    useTrackRecorderStore.getState().start();
    await vi.waitFor(() => expect(stub.success).not.toBeNull());
    useTrackRecorderStore.setState({ gpsError: "GPS timeout. Tap Resume to keep trying." });
    emit(stub, -111.0, 46.0, 30);
    expect(useTrackRecorderStore.getState().gpsError).toBeNull();
    emit(stub, -111.0, 46.0009, 8);
    emit(stub, -111.0, 46.0018, 12);
    const id = useTrackRecorderStore.getState().stop("Accurate");
    const saved = useFieldToolsStore.getState().routes.find((r) => r.id === id);
    expect(saved?.accuracyMedianM).toBe(12);
  });

  it("ignores altitude wobble below the threshold and counts real climbs", async () => {
    useTrackRecorderStore.getState().start();
    await vi.waitFor(() => expect(stub.success).not.toBeNull());
    emit(stub, -111.0, 46.0, 10, 1000);
    emit(stub, -111.0, 46.0009, 10, 1002); // +6.6 ft: wobble
    expect(useTrackRecorderStore.getState().gainFt).toBe(0);
    emit(stub, -111.0, 46.0018, 10, 1010); // +32.8 ft from the anchor: counted
    expect(useTrackRecorderStore.getState().gainFt).toBeCloseTo(32.8, 0);
    emit(stub, -111.0, 46.0027, 10, 1020, 30); // vertical error 98 ft → threshold 197 ft
    expect(useTrackRecorderStore.getState().gainFt).toBeCloseTo(32.8, 0);
  });

  it("does not count a locked-phone gap as time spent walking", async () => {
    useTrackRecorderStore.getState().start();
    await vi.waitFor(() => expect(stub.success).not.toBeNull());
    emit(stub, -111.0, 46.0, 10);

    // The phone was locked for ten minutes: the wall clock advanced, the
    // watchdog was frozen with it, and no fix arrived.
    const tenMinutesAgo = performance.now() - 600_000;
    useTrackRecorderStore.setState({ _lastSampleMs: tenMinutesAgo, _legStartMs: tenMinutesAgo });
    emit(stub, -111.0, 46.01, 10);

    const s = useTrackRecorderStore.getState();
    expect(s.segments).toEqual([0, 1]);
    expect(s._deadSeconds).toBeGreaterThan(590);
    // Wall clock says ten minutes; almost none of it was recording.
    expect(s.durationSeconds).toBeLessThan(10);

    const id = s.stop("Locked");
    const saved = useFieldToolsStore.getState().routes.find((r) => r.id === id);
    expect(saved).toBeDefined();
  });

  it("runs the auto-pause watchdog only while recording", () => {
    expect(useTrackRecorderStore.getState()._watchdog).toBeNull();
    useTrackRecorderStore.getState().start();
    expect(useTrackRecorderStore.getState()._watchdog).not.toBeNull();
    useTrackRecorderStore.getState().pause();
    expect(useTrackRecorderStore.getState()._watchdog).toBeNull();
    useTrackRecorderStore.getState().resume();
    expect(useTrackRecorderStore.getState()._watchdog).not.toBeNull();
    useTrackRecorderStore.getState().discard();
    expect(useTrackRecorderStore.getState()._watchdog).toBeNull();
  });
});

describe("thinSamples", () => {
  it("keeps segment starts aligned after thinning", () => {
    const path = Array.from({ length: 10_001 }, (_, i) => i);
    const out = thinSamples(path, path, [0, 5_000]);
    expect(out.path).toHaveLength(8_000);
    expect(out.segments).toEqual([0, 4_000]);
  });
});
