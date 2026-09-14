/**
 * @file useLocate.ts
 * @module engage-mt/hooks
 * @description "Find my location" for the map. Watches the position for a
 *              short window and keeps the most accurate fix, returning early
 *              once a fix is good enough, so the first coarse cell-tower
 *              answer is not what the map flies to. Falls back to a single
 *              reading when watching is not possible.
 * @author Jamie Ellis / Engage MT
 * @created 2026-05-20
 * @updated 2026-09-06
 * @version 2.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { useEffect, useRef, useState } from "react";
import { NetworkError } from "@/utils/errors";
import { createLogger } from "@/utils/logger";

const log = createLogger("locate");

export interface Coords {
  lat: number;
  lon: number;
  accuracy: number;
}

interface LocateState {
  loading: boolean;
  error: Error | null;
  coords: Coords | null;
}

/** Stop watching as soon as a fix is at least this accurate. */
export const GOOD_ENOUGH_M = 20;
/** Otherwise keep the best fix seen within this window. */
export const WATCH_WINDOW_MS = 4000;
const SINGLE_FIX_TIMEOUT_MS = 10000;

interface PositionSource {
  watch: (onFix: (c: Coords) => void, onError: (message: string) => void) => Promise<() => void>;
  once: () => Promise<Coords>;
}

const toCoords = (pos: {
  coords: { latitude: number; longitude: number; accuracy: number };
}): Coords => ({
  lat: pos.coords.latitude,
  lon: pos.coords.longitude,
  accuracy: pos.coords.accuracy,
});

const webSource = (): PositionSource | null => {
  if (typeof navigator === "undefined" || !navigator.geolocation) return null;
  const geo = navigator.geolocation;
  return {
    watch: async (onFix, onError) => {
      const id = geo.watchPosition(
        (pos) => onFix(toCoords(pos)),
        (err) => onError(err.message),
        {
          enableHighAccuracy: true,
          maximumAge: 0,
          timeout: SINGLE_FIX_TIMEOUT_MS,
        },
      );
      return () => geo.clearWatch(id);
    },
    once: () =>
      new Promise((resolve, reject) => {
        geo.getCurrentPosition(
          (pos) => resolve(toCoords(pos)),
          (err) => reject(new NetworkError(err.message)),
          { enableHighAccuracy: true, timeout: SINGLE_FIX_TIMEOUT_MS },
        );
      }),
  };
};

const capacitorSource = async (): Promise<PositionSource | null> => {
  const mod = await import("@capacitor/geolocation").catch(() => null);
  if (!mod) return null;
  const { Geolocation } = mod;
  return {
    watch: async (onFix, onError) => {
      const id = await Geolocation.watchPosition(
        { enableHighAccuracy: true, timeout: SINGLE_FIX_TIMEOUT_MS },
        (pos, err) => {
          if (err) onError(err.message ?? "GPS error");
          else if (pos) onFix(toCoords(pos));
        },
      );
      return () => void Geolocation.clearWatch({ id });
    },
    once: async () =>
      toCoords(
        await Geolocation.getCurrentPosition({
          enableHighAccuracy: true,
          timeout: SINGLE_FIX_TIMEOUT_MS,
        }),
      ),
  };
};

/**
 * Best fix within the window: resolves early at GOOD_ENOUGH_M, otherwise
 * with the most accurate fix seen, or rejects when none arrived.
 */
export const bestFixWithin = (
  source: PositionSource,
  windowMs: number = WATCH_WINDOW_MS,
  goodEnoughM: number = GOOD_ENOUGH_M,
): Promise<Coords> =>
  new Promise((resolve, reject) => {
    let best: Coords | null = null;
    let stop: (() => void) | null = null;
    let done = false;
    const finish = (): void => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      stop?.();
      if (best) resolve(best);
      else reject(new NetworkError("No location fix within the window"));
    };
    const timer = setTimeout(finish, windowMs);
    void source
      .watch(
        (fix) => {
          if (!best || fix.accuracy < best.accuracy) best = fix;
          if (fix.accuracy <= goodEnoughM) finish();
        },
        (message) => {
          if (!best) {
            done = true;
            clearTimeout(timer);
            stop?.();
            reject(new NetworkError(message));
          }
        },
      )
      .then((stopWatching) => {
        stop = stopWatching;
        if (done) stopWatching();
      })
      .catch((err) => {
        done = true;
        clearTimeout(timer);
        reject(err instanceof Error ? err : new NetworkError(String(err)));
      });
  });

export const getCurrentCoords = async (): Promise<Coords> => {
  const source = (await capacitorSource()) ?? webSource();
  if (!source) throw new NetworkError("Geolocation not available in this browser");
  try {
    return await bestFixWithin(source);
  } catch (err) {
    log.warn("watch window produced no fix; asking for a single reading", { err: String(err) });
    return source.once();
  }
};

export const useLocate = (): { state: LocateState; locate: () => Promise<void> } => {
  const [state, setState] = useState<LocateState>({ loading: false, error: null, coords: null });
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const locate = async (): Promise<void> => {
    setState({ loading: true, error: null, coords: null });
    try {
      const coords = await getCurrentCoords();
      if (mounted.current) setState({ loading: false, error: null, coords });
    } catch (err) {
      if (mounted.current)
        setState({
          loading: false,
          error: err instanceof Error ? err : new Error(String(err)),
          coords: null,
        });
    }
  };

  return { state, locate };
};
