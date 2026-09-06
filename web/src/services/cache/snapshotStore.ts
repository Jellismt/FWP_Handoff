/**
 * @file snapshotStore.ts
 * @module engage-mt/services/cache
 * @description Reusable "last-good snapshot" store over the Web Cache-Storage API.
 *              A snapshot store persists a JSON body under a stable key, stamped
 *              with an `x-fetched-at` header, and reads it back later — the
 *              network → cached-snapshot → last-good pattern that regs and live
 *              conditions all need offline.
 *
 *              Extracted from the two hand-maintained copies of
 *              readSnapshot/writeSnapshot in services/regsApi/client.ts and
 *              services/hunt/fetchHuntingRegs.ts (which used different
 *              CACHE_NAMEs). Callers do their own body-shaping/unwrap; this store
 *              only owns the caches read/write + the fetched-at stamp, so it is
 *              generic across regs tables and USGS readings alike.
 *
 *              No-ops safely when the Cache-Storage API is absent (SSR / tests /
 *              old webviews). Privacy: only public upstream payloads are cached;
 *              nothing about the user is stored. Per `docs/rules/privacy.md`.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-14
 * @updated 2026-07-14
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { createLogger } from "@/utils/logger";

const log = createLogger("snapshot-store");

/** A raw snapshot read back from Cache-Storage. `body` is the parsed JSON. */
export interface RawSnapshot {
  body: unknown;
  /** ISO timestamp from the `x-fetched-at` header, or null if it was absent. */
  fetchedAt: string | null;
}

export interface SnapshotStore {
  /** Read the snapshot at `cacheKey`, or null on miss / unavailable API / error. */
  read(cacheKey: string): Promise<RawSnapshot | null>;
  /** Persist `body` at `cacheKey`, stamped with `fetchedAt`. Fire-and-forget safe. */
  write(cacheKey: string, body: unknown, fetchedAt: string): Promise<void>;
}

const FETCHED_AT_HEADER = "x-fetched-at";

/**
 * Build a snapshot store bound to one Cache-Storage bucket name. Reuse a single
 * store per cache name (e.g. `engage-regs-v2`, `engage-usgs-latest`).
 */
export function makeSnapshotStore(cacheName: string): SnapshotStore {
  return {
    async read(cacheKey: string): Promise<RawSnapshot | null> {
      if (typeof caches === "undefined") return null;
      try {
        const cache = await caches.open(cacheName);
        const res = await cache.match(cacheKey);
        if (!res) return null;
        return { body: await res.json(), fetchedAt: res.headers.get(FETCHED_AT_HEADER) };
      } catch (err) {
        log.warn("snapshot read failed", { cacheName, cacheKey, error: String(err) });
        return null;
      }
    },

    async write(cacheKey: string, body: unknown, fetchedAt: string): Promise<void> {
      if (typeof caches === "undefined") return;
      try {
        const cache = await caches.open(cacheName);
        await cache.put(
          cacheKey,
          new Response(JSON.stringify(body), {
            headers: { "Content-Type": "application/json", [FETCHED_AT_HEADER]: fetchedAt },
          }),
        );
      } catch (err) {
        log.warn("snapshot write failed", { cacheName, cacheKey, error: String(err) });
      }
    },
  };
}
