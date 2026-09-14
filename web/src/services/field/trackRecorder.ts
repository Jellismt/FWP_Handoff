/**
 * @file trackRecorder.ts
 * @module engage-mt/services/field
 * @description GPS track recorder service. Active recording
 *              session that watches `navigator.geolocation` (web) or
 *              `@capacitor/geolocation` (native), buffers breadcrumbs
 *              into an in-memory polyline, computes distance + gain on
 *              the fly, and saves to the `fieldToolsStore` as a
 *              `CapturedRoute` on stop.
 *
 *              State machine:
 *                idle  → start()  → recording
 *                recording → pause()  → paused
 *                paused → resume() → recording
 *                recording / paused → stop(name?) → idle (saves route)
 *                any state → discard() → idle (drops buffer)
 *
 *              Exposes a Zustand store (`useTrackRecorderStore`) so UI
 *              can subscribe to live stats without polling.
 *
 *              Privacy: GPS samples stay on-device. The buffer is
 *              never transmitted. Save is an explicit user action,
 *              and the saved route only persists to localStorage.
 *
 *              Performance: samples that don't move beyond
 *              `MIN_DELTA_M` (default 5 m) are dropped to avoid the
 *              breadcrumb dancing in place when the user is stationary.
 *              Samples with `accuracy > MAX_ACCURACY_M` (50 m) are
 *              dropped entirely — the fix is too noisy to trust.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-02
 * @updated 2026-07-14
 * @version 1.1.1
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { create } from "zustand";
import { useFieldToolsStore } from "@/store/field/fieldToolsStore";
import { haversineMeters } from "@/utils/geometry"; // SP-7: was a local dup
import { createLogger } from "@/utils/logger";
import { isCapacitor } from "@/utils/capacitor";
import { allowScreenSleep, keepScreenAwake } from "@/services/mobile/keepAwake";

const log = createLogger("track-recorder");

const MIN_DELTA_M = 5;
const MAX_ACCURACY_M = 50;
const MILES_PER_METER = 0.000621371;
const FEET_PER_METER = 3.28084;
/**
 * Ring-buffer cap on `path` + `elevationFt`. Tracks beyond 10 000
 * samples thin to the most recent 8 000 via uniform decimation. At a 1 Hz
 * sample rate that means up to ~2.7 h before the first thin, then the
 * recorder stays at 8–10 k. Plenty for a day-long hike without hammering
 * the React state tree.
 */
const MAX_PATH_SAMPLES = 10_000;
const PATH_THIN_TO = 8_000;
/**
 * Auto-pause-on-stop. If no qualifying new sample (>= MIN_DELTA_M
 * from the last point) arrives within this many milliseconds, the recorder
 * assumes the user has stopped moving and self-pauses so the duration math
 * doesn't keep ticking through bathroom breaks / lunch / etc. The user can
 * tap Resume on the chip to keep recording. 60 s matches common field-app behavior.
 */
const AUTO_PAUSE_MS = 60_000;
const WATCHDOG_MS = 10_000;
/** A silence longer than this between accepted fixes starts a new segment. */
export const GAP_MS = 120_000;
/** Ignore altitude wobble smaller than this (about 3 m) or the reported vertical error. */
const MIN_GAIN_FT = 10;

/** Thin a parallel pair of arrays down to ~PATH_THIN_TO points uniformly. */
export const thinSamples = <P, E>(
  path: readonly P[],
  elev: readonly E[],
  segments: readonly number[] = [0],
): { path: P[]; elev: E[]; segments: number[] } => {
  if (path.length <= PATH_THIN_TO) {
    return { path: path.slice(), elev: elev.slice(), segments: segments.slice() };
  }
  const step = path.length / PATH_THIN_TO;
  const outP: P[] = [];
  const outE: E[] = [];
  for (let i = 0; i < PATH_THIN_TO; i++) {
    const idx = Math.min(path.length - 1, Math.floor(i * step));
    outP.push(path[idx]);
    outE.push(elev[idx]);
  }
  // Every segment start maps to the first kept index at or after it.
  const outS = [
    ...new Set(segments.map((start) => Math.min(PATH_THIN_TO - 1, Math.ceil(start / step)))),
  ];
  return { path: outP, elev: outE, segments: outS };
};

export const median = (values: readonly number[]): number | undefined => {
  const sorted = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (sorted.length === 0) return undefined;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

export type RecorderStatus = "idle" | "recording" | "paused";

interface RecorderState {
  status: RecorderStatus;
  /** [lon, lat] samples since the recording started. */
  path: Array<[number, number]>;
  /** Elevation samples in feet, aligned to `path`. May be sparse with NaN. */
  elevationFt: number[];
  /** Start index of each continuous segment of `path`. */
  segments: number[];
  /** Horizontal accuracy (m) of every accepted fix. */
  accuracies: number[];
  /** Cumulative distance in meters (computed at sample time). */
  distanceMeters: number;
  /** Cumulative elevation gain in feet. */
  gainFt: number;
  /** ISO start timestamp. */
  startedAt: string | null;
  /** Wall-clock duration in seconds, excluding paused intervals. */
  durationSeconds: number;
  /**
   * Surface the last `watchPosition` error so the UI can
   * render a recover banner. Reset to null on each successful sample
   * + on `start()` / `resume()`.
   */
  gpsError: string | null;
  /**
   * Internal: opaque handle from `navigator.geolocation.watchPosition`
   * (number) or `Capacitor.Geolocation.watchPosition` (string). Cleared
   * via `stopWatch()` which routes to the correct API.
   */
  _watchHandle: WatchHandle;
  /** Internal: monotonic timestamp ms when the active leg began. */
  _legStartMs: number | null;
  /** Internal: accumulated active seconds across legs. */
  _accumulatedSeconds: number;
  /** Internal: monotonic timestamp ms of the last accepted sample. */
  _lastSampleMs: number | null;
  /** Internal: the next accepted fix starts a new segment (after a resume). */
  _gapPending: boolean;
  /** Internal: elevation the gain is measured from, in feet. */
  _gainAnchorFt: number;
  /**
   * Internal: seconds the recorder was running but receiving no fixes, because
   * the phone was locked or the app was suspended. The wall clock keeps
   * advancing through that, so it is subtracted from the reported duration
   * rather than counted as time spent walking.
   */
  _deadSeconds: number;
  /** Internal: auto-pause watchdog, installed only while recording. */
  _watchdog: ReturnType<typeof setInterval> | null;
  /**
   * `true` when the recorder self-paused because the auto-pause-
   * on-stop watchdog fired (vs. an explicit user pause). The chip reads
   * this to show "Auto-paused — tap Resume" instead of "Paused".
   */
  autoPaused: boolean;

  // ── Public actions ────────────────────────────────────────────────
  start: () => void;
  pause: () => void;
  resume: () => void;
  stop: (name: string, notes?: string) => string | null;
  discard: () => void;
  /** Internal: push a single sample. Exposed for tests. */
  _push: (
    lon: number,
    lat: number,
    accuracy: number,
    altitude?: number,
    altitudeAccuracy?: number,
  ) => void;
}

const safeNow = (): number => (typeof performance !== "undefined" ? performance.now() : Date.now());

const isoNow = (): string => new Date().toISOString();

/**
 * Watch handle is an opaque string (Capacitor) or numeric
 * id (browser); both code paths fall back to a single `string` field
 * on the store, so we cast at the boundary.
 */
type WatchHandle = string | number | null;

const positionErrorMessage = (code: number, fallback?: string): string =>
  code === 1
    ? "Location permission denied. Re-enable in Settings."
    : code === 2
      ? "Couldn't get a GPS fix. Move into the open and tap Resume."
      : code === 3
        ? "GPS timeout. Tap Resume to keep trying."
        : fallback || "GPS error.";

type SampleHandler = (
  lon: number,
  lat: number,
  accuracy: number,
  altitude?: number,
  altitudeAccuracy?: number,
) => void;

const startWatch = async (
  onSample: SampleHandler,
  onError: (message: string) => void,
): Promise<WatchHandle> => {
  // Native Capacitor geolocation when available (higher
  // accuracy, exclusive OS handle). Falls back to navigator.geolocation
  // on the web build + iOS Safari PWA. Both code paths converge on the
  // same sample / error callbacks.
  //
  // Track recording is FOREGROUND-ONLY (MVP). Neither platform
  // declares a background-location capability, so the OS pauses these
  // watches when the app is suspended and resumes them on return. True
  // background recording awaits a native foreground service.
  if (isCapacitor()) {
    try {
      const { Geolocation } = await import("@capacitor/geolocation");
      const id = await Geolocation.watchPosition(
        { enableHighAccuracy: true, timeout: 15_000 },
        (pos, err) => {
          if (err) {
            const message = err.message?.includes("denied")
              ? positionErrorMessage(1)
              : err.message || "GPS error.";
            log.warn("Capacitor watchPosition error", { message: err.message });
            onError(message);
            return;
          }
          if (!pos) return;
          onSample(
            pos.coords.longitude,
            pos.coords.latitude,
            pos.coords.accuracy,
            pos.coords.altitude ?? undefined,
            pos.coords.altitudeAccuracy ?? undefined,
          );
        },
      );
      return id;
    } catch (err) {
      log.warn("Capacitor geolocation import failed; falling back to web", {
        error: err instanceof Error ? err.message : String(err),
      });
      // Fall through to navigator fallback.
    }
  }

  if (typeof navigator === "undefined" || !navigator.geolocation) {
    onError("This device cannot record GPS tracks.");
    return null;
  }
  return navigator.geolocation.watchPosition(
    (pos) =>
      onSample(
        pos.coords.longitude,
        pos.coords.latitude,
        pos.coords.accuracy,
        pos.coords.altitude ?? undefined,
        pos.coords.altitudeAccuracy ?? undefined,
      ),
    (err) => {
      log.warn("watchPosition error", { code: err.code, message: err.message });
      onError(positionErrorMessage(err.code, err.message));
    },
    { enableHighAccuracy: true, maximumAge: 0, timeout: 15_000 },
  );
};

const stopWatch = async (handle: WatchHandle): Promise<void> => {
  if (handle == null) return;
  if (typeof handle === "string") {
    if (isCapacitor()) {
      try {
        const { Geolocation } = await import("@capacitor/geolocation");
        await Geolocation.clearWatch({ id: handle });
      } catch {
        /* noop */
      }
    }
    return;
  }
  if (typeof navigator === "undefined" || !navigator.geolocation) return;
  navigator.geolocation.clearWatch(handle);
};

/** Auto-pause when no fix has been accepted for AUTO_PAUSE_MS. Runs only while recording. */
const installWatchdog = (): ReturnType<typeof setInterval> | null => {
  if (typeof window === "undefined") return null;
  return setInterval(() => {
    const s = useTrackRecorderStore.getState();
    if (s.status !== "recording" || s._lastSampleMs == null) return;
    if (safeNow() - s._lastSampleMs < AUTO_PAUSE_MS) return;
    log.info("auto-pause: no movement detected", { idleMs: safeNow() - s._lastSampleMs });
    s.pause();
    useTrackRecorderStore.setState({ autoPaused: true });
  }, WATCHDOG_MS);
};

/** Wall-clock time the recorder ran, less the stretches it received no fixes. */
const activeSeconds = (elapsed: number, dead: number): number => Math.max(0, elapsed - dead);

const clearWatchdog = (handle: ReturnType<typeof setInterval> | null): void => {
  if (handle != null) clearInterval(handle);
};

export const useTrackRecorderStore = create<RecorderState>((set, get) => ({
  status: "idle",
  path: [],
  elevationFt: [],
  segments: [],
  accuracies: [],
  distanceMeters: 0,
  gainFt: 0,
  startedAt: null,
  durationSeconds: 0,
  gpsError: null,
  _watchHandle: null,
  _legStartMs: null,
  _accumulatedSeconds: 0,
  _lastSampleMs: null,
  _gapPending: false,
  _gainAnchorFt: Number.NaN,
  _deadSeconds: 0,
  _watchdog: null,
  autoPaused: false,

  start: () => {
    const state = get();
    if (state.status !== "idle") {
      log.warn("start() called while recorder is non-idle", { status: state.status });
      return;
    }
    const onError = (message: string): void => {
      // Auto-pause on GPS error so duration math freezes +
      // the user can hit Resume after granting permission / moving
      // outdoors. Without this, the recorder runs silently.
      const cur = get();
      if (cur.status === "recording") {
        cur.pause();
      }
      set({ gpsError: message });
    };
    set({
      status: "recording",
      path: [],
      elevationFt: [],
      segments: [],
      accuracies: [],
      distanceMeters: 0,
      gainFt: 0,
      startedAt: isoNow(),
      durationSeconds: 0,
      gpsError: null,
      _watchHandle: null,
      _legStartMs: safeNow(),
      _accumulatedSeconds: 0,
      _lastSampleMs: null,
      _gapPending: false,
      _gainAnchorFt: Number.NaN,
      _deadSeconds: 0,
      _watchdog: installWatchdog(),
      autoPaused: false,
    });
    void keepScreenAwake();
    void startWatch(
      (lon, lat, accuracy, altitude, altitudeAccuracy) =>
        get()._push(lon, lat, accuracy, altitude, altitudeAccuracy),
      onError,
    ).then((handle) => set({ _watchHandle: handle }));
  },

  pause: () => {
    const state = get();
    if (state.status !== "recording") return;
    void stopWatch(state._watchHandle);
    clearWatchdog(state._watchdog);
    void allowScreenSleep();
    const elapsed = state._legStartMs != null ? (safeNow() - state._legStartMs) / 1000 : 0;
    set({
      status: "paused",
      _watchHandle: null,
      _watchdog: null,
      _legStartMs: null,
      _accumulatedSeconds: state._accumulatedSeconds + elapsed,
      durationSeconds: activeSeconds(state._accumulatedSeconds + elapsed, state._deadSeconds),
    });
  },

  resume: () => {
    const state = get();
    if (state.status !== "paused") return;
    const onError = (message: string): void => {
      const cur = get();
      if (cur.status === "recording") cur.pause();
      set({ gpsError: message });
    };
    // The pause is a gap: the next fix starts a new segment rather than a
    // straight line from wherever the last one was.
    set({
      status: "recording",
      gpsError: null,
      _watchHandle: null,
      _legStartMs: safeNow(),
      _lastSampleMs: safeNow(),
      _gapPending: true,
      _watchdog: installWatchdog(),
      autoPaused: false,
    });
    void keepScreenAwake();
    void startWatch(
      (lon, lat, accuracy, altitude, altitudeAccuracy) =>
        get()._push(lon, lat, accuracy, altitude, altitudeAccuracy),
      onError,
    ).then((handle) => set({ _watchHandle: handle }));
  },

  stop: (name, notes) => {
    const state = get();
    if (state.status === "idle") return null;
    void stopWatch(state._watchHandle);
    clearWatchdog(state._watchdog);
    void allowScreenSleep();
    const elapsed = state._legStartMs != null ? (safeNow() - state._legStartMs) / 1000 : 0;
    const totalSeconds = activeSeconds(state._accumulatedSeconds + elapsed, state._deadSeconds);
    const distanceMi = state.distanceMeters * MILES_PER_METER;
    const accuracyMedianM = median(state.accuracies);
    const route = {
      name: name.trim() || `Track ${new Date().toLocaleString()}`,
      notes: notes?.trim() || undefined,
      path: state.path.slice(),
      elevationFt: state.elevationFt.some((e) => Number.isFinite(e))
        ? state.elevationFt.slice()
        : undefined,
      segments: state.segments.length > 1 ? state.segments.slice() : undefined,
      ...(accuracyMedianM != null ? { accuracyMedianM: Math.round(accuracyMedianM) } : {}),
      distanceMi,
      gainFt: state.gainFt,
      startedAt: state.startedAt ?? isoNow(),
      endedAt: isoNow(),
    };
    const saved = useFieldToolsStore.getState().addRoute(route);
    set({
      status: "idle",
      path: [],
      elevationFt: [],
      segments: [],
      accuracies: [],
      distanceMeters: 0,
      gainFt: 0,
      startedAt: null,
      durationSeconds: totalSeconds,
      gpsError: null,
      _watchHandle: null,
      _watchdog: null,
      _legStartMs: null,
      _accumulatedSeconds: 0,
      _gapPending: false,
      _gainAnchorFt: Number.NaN,
      _deadSeconds: 0,
    });
    return saved.id;
  },

  discard: () => {
    const state = get();
    void stopWatch(state._watchHandle);
    clearWatchdog(state._watchdog);
    void allowScreenSleep();
    set({
      status: "idle",
      path: [],
      elevationFt: [],
      segments: [],
      accuracies: [],
      distanceMeters: 0,
      gainFt: 0,
      startedAt: null,
      durationSeconds: 0,
      gpsError: null,
      _watchHandle: null,
      _watchdog: null,
      _legStartMs: null,
      _accumulatedSeconds: 0,
      _gapPending: false,
      _gainAnchorFt: Number.NaN,
      _deadSeconds: 0,
      autoPaused: false,
    });
  },

  _push: (lon, lat, accuracy, altitude, altitudeAccuracy) => {
    const state = get();
    if (state.status !== "recording") return;
    if (accuracy > MAX_ACCURACY_M) return;
    const now = safeNow();
    const altFt =
      altitude != null && Number.isFinite(altitude) ? altitude * FEET_PER_METER : Number.NaN;
    const last = state.path[state.path.length - 1];
    // A resume, or a long silence, means the line must not bridge the gap.
    const gap =
      state._gapPending || (state._lastSampleMs != null && now - state._lastSampleMs > GAP_MS);
    if (!last || gap) {
      // The stretch between the last fix and this one was not time spent walking.
      const deadMs = last && state._lastSampleMs != null ? now - state._lastSampleMs : 0;
      set({
        _deadSeconds: state._deadSeconds + deadMs / 1000,
        path: [...state.path, [lon, lat]],
        elevationFt: [...state.elevationFt, altFt],
        segments: [...state.segments, state.path.length],
        accuracies: [...state.accuracies, accuracy],
        _lastSampleMs: now,
        _gapPending: false,
        _gainAnchorFt: altFt,
        gpsError: null,
      });
      return;
    }
    const [lastLon, lastLat] = last;
    const delta = haversineMeters(lastLon, lastLat, lon, lat);
    if (delta < MIN_DELTA_M) return;

    // Elevation gain counts only climbs larger than the vertical error, from
    // an anchor that moves with every counted climb or descent.
    const verticalErrorFt =
      altitudeAccuracy != null && Number.isFinite(altitudeAccuracy)
        ? altitudeAccuracy * FEET_PER_METER
        : 0;
    const threshold = Math.max(MIN_GAIN_FT, 2 * verticalErrorFt);
    let anchor = state._gainAnchorFt;
    let gainDelta = 0;
    if (Number.isFinite(altFt)) {
      if (!Number.isFinite(anchor)) anchor = altFt;
      else if (altFt - anchor >= threshold) {
        gainDelta = altFt - anchor;
        anchor = altFt;
      } else if (anchor - altFt >= threshold) {
        anchor = altFt;
      }
    }

    const legElapsed = state._legStartMs != null ? (now - state._legStartMs) / 1000 : 0;
    let nextPath = [...state.path, [lon, lat] as [number, number]];
    let nextElev = [...state.elevationFt, altFt];
    let nextSegments = state.segments;
    if (nextPath.length > MAX_PATH_SAMPLES) {
      const thinned = thinSamples(nextPath, nextElev, state.segments);
      nextPath = thinned.path;
      nextElev = thinned.elev;
      nextSegments = thinned.segments;
      log.info("track path thinned", { from: MAX_PATH_SAMPLES, to: nextPath.length });
    }
    set({
      path: nextPath,
      elevationFt: nextElev,
      segments: nextSegments,
      accuracies: [...state.accuracies, accuracy],
      distanceMeters: state.distanceMeters + delta,
      gainFt: state.gainFt + gainDelta,
      durationSeconds: activeSeconds(state._accumulatedSeconds + legElapsed, state._deadSeconds),
      _lastSampleMs: now,
      _gainAnchorFt: anchor,
      gpsError: null,
    });
  },
}));

/**
 * Auto-pause-on-stop watchdog. Polls the recorder state every
 * 10 s; if the last accepted sample is older than `AUTO_PAUSE_MS`, fires
 * `pause()` and flips `autoPaused` so the UI shows the right copy. The
 * interval lives at module scope so it ticks regardless of whether any
 * component is mounted.
 */

/** Format a duration (s) as `mm:ss` or `h:mm:ss`. */
export const formatDuration = (seconds: number): string => {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(ss)}` : `${pad(m)}:${pad(ss)}`;
};

/** Format a meters distance as miles (2 decimal). */
export const formatDistanceMi = (meters: number): string =>
  `${(meters * MILES_PER_METER).toFixed(2)} mi`;
