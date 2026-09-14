/**
 * @file bundledRegsSnapshot.ts
 * @module engage-mt/services/regs
 * @description Runtime loader for the build-time regs snapshot bundled at
 *              `web/public/data/regs-snapshot.json` by
 *              `scripts/build-data/build_regs_snapshot.mjs`. This is the offline
 *              source of last resort for hunting regs on mobile. Mobile fetches
 * Regs live when online and
 *              caches them; the bundled snapshot is the floor for a
 *              never-been-online fresh install, where the live fetch and the
 *              runtime Cache-Storage snapshot are both unavailable.
 *
 *              Each entry is keyed by the SAME cacheKey the fetchers use
 *              (`hunting-regulations-unified`, `important-dates-${year}`,
 *              `content-body-${slug}-${year}`, …), so
 *              a fetcher's bundled tier is a direct lookup. The stored envelope
 *              carries enriched `meta` (effectiveDate / validUntil / sourceLabel)
 *              so freshness reads as a versioned "Effective {date}" dataset.
 *
 *              Loader contract: one same-origin fetch, cached module-side,
 *              never rejects (missing file → empty).
 *              Privacy: bundled same-origin JSON; nothing leaves the device.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-14
 * @updated 2026-07-14
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { fetchJson } from "@/utils/http";

/** Enriched envelope meta stored per bundled entry. */
export interface BundledRegsMeta {
  generatedAt: string;
  effectiveDate: string | null;
  validUntil: string | null;
  sourceLabel: string;
  version: number | null;
}

/** One bundled entry: the fetcher's expected `data` payload + enriched meta. */
export interface BundledRegsEntry<T = unknown> {
  data: T;
  meta: BundledRegsMeta;
}

type BundledRegsSnapshot = Record<string, BundledRegsEntry>;

const SNAPSHOT_URL = "/data/regs-snapshot.json";

let snapshotPromise: Promise<BundledRegsSnapshot> | null = null;

/** Load the bundled snapshot once per session; never rejects (missing file → {}). */
export const loadBundledRegsSnapshot = (): Promise<BundledRegsSnapshot> => {
  if (!snapshotPromise) {
    snapshotPromise = fetchJson<BundledRegsSnapshot>(SNAPSHOT_URL).catch(
      () => ({}) as BundledRegsSnapshot,
    );
  }
  return snapshotPromise;
};

/**
 * Look up one bundled entry by its cacheKey, or null when the snapshot doesn't
 * carry it (or the file is absent). Typed at the call site by the fetcher.
 */
export const getBundledRegsEntry = async <T>(
  cacheKey: string,
): Promise<BundledRegsEntry<T> | null> => {
  const snap = await loadBundledRegsSnapshot();
  const entry = snap[cacheKey];
  return entry ? (entry as BundledRegsEntry<T>) : null;
};

/** Test/refresh hook — drops the cached load so a re-fetch re-reads the file. */
export const resetBundledRegsSnapshot = (): void => {
  snapshotPromise = null;
};
