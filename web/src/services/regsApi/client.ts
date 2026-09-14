/**
 * @file client.ts
 * @module engage-mt/services/regsApi
 * @description The one regulations fetcher. Every regs dataset (v1 unified
 *              table, v2 notes, restricted areas, youth opportunities,
 *              corrections) goes through `createRegsFetcher`, which reads in
 *              order: the API when online → the newest stored copy (browser
 *              Cache Storage or the copy saved to the device) → the copy
 *              built into the app. Each result says which tier served it and
 *              whether it is stale. A fallback result is reused only while
 *              offline; a connectivity change clears the session cache.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-04
 * @updated 2026-09-06
 * @version 3.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import type { RegsFreshness, RegsTier, V2Result } from "./types";
import { currentRegsYear, seasonWindow } from "./year";
import { createLogger } from "@/utils/logger";
import { makeSnapshotStore, type SnapshotStore } from "@/services/cache/snapshotStore";
import { makeFilesystemSnapshotStore } from "@/services/cache/filesystemSnapshotStore";
import { getBundledRegsEntry } from "@/services/regs/bundledRegsSnapshot";
import { useConnectivityStore } from "@/store/app/connectivityStore";

const log = createLogger("regsApi");

export const REGS_CACHE_NAME = "engage-regs";
export const REGS_FIELD_COPY_DIR = "regs";
/** A stored copy older than this is flagged stale even before validUntil passes. */
export const STALE_AFTER_DAYS = 90;
const DEFAULT_TTL_MS = 15 * 60 * 1000;
const DAY_MS = 86_400_000;
const LEGACY_CACHE_NAMES = ["engage-regs-v1", "engage-regs-v2"];

const cacheStore = makeSnapshotStore(REGS_CACHE_NAME);
const fieldStore = makeFilesystemSnapshotStore(REGS_FIELD_COPY_DIR);

export class RegsApiUnavailableError extends Error {
  constructor(what: string) {
    super(`${what} is unavailable — no connection and no cached copy.`);
    this.name = "RegsApiUnavailableError";
  }
}

export type RegsApiVersion = "v1" | "v2";

/** Base URL for a public API version, or undefined when the build has no API. */
export function regsApiBase(api: RegsApiVersion): string | undefined {
  const env = import.meta.env as Record<string, string | undefined>;
  if (api === "v2" && env.VITE_FWP_API_V2_BASE) return env.VITE_FWP_API_V2_BASE;
  const base = env.VITE_FWP_REGS_API_BASE || env.VITE_FWP_API_BASE;
  if (!base) return undefined;
  return api === "v2" ? base.replace(/\/api\/v1\//, "/api/v2/") : base;
}

export const apiV2Base = (): string | undefined => regsApiBase("v2");

interface EnvelopeMetaLike {
  validUntil?: string;
  sourceLabel?: string;
  generatedAt?: string;
  effectiveFrom?: string;
  version?: number | null;
  filters?: { version?: number | null };
}

interface Unwrapped<T> {
  data: T;
  validUntil: string | null;
  sourceLabel: string;
  generatedAt: string;
  effectiveFrom: string | null;
  version: number | null;
}

function unwrap<T>(body: unknown, fallbackLabel: string): Unwrapped<T> {
  const isEnvelope = !!body && typeof body === "object" && "data" in body;
  const data = isEnvelope ? (body as { data: T }).data : (body as T);
  const meta = isEnvelope ? (body as { meta?: EnvelopeMetaLike }).meta : undefined;
  const version = meta?.version ?? meta?.filters?.version ?? null;
  return {
    data,
    validUntil: meta?.validUntil ?? null,
    sourceLabel: meta?.sourceLabel ?? fallbackLabel,
    generatedAt: meta?.generatedAt ?? new Date().toISOString(),
    effectiveFrom: meta?.effectiveFrom ?? null,
    version: typeof version === "number" ? version : null,
  };
}

/** Stale when validUntil has passed, or a stored copy is older than the stale window. */
export function computeStale(
  tier: RegsTier,
  fetchedAt: string,
  validUntil: string | null,
  now: number = Date.now(),
): boolean {
  if (validUntil) {
    const until = Date.parse(validUntil);
    if (Number.isFinite(until) && until + DAY_MS < now) return true;
  }
  if (tier === "live") return false;
  const age = now - Date.parse(fetchedAt);
  return Number.isFinite(age) && age > STALE_AFTER_DAYS * DAY_MS;
}

function freshnessFor(
  tier: RegsTier,
  fetchedAt: string,
  u: Omit<Unwrapped<unknown>, "data">,
  effectiveDate: string | null,
): RegsFreshness {
  return {
    tier,
    fetchedAt,
    sourceLabel: u.sourceLabel,
    validUntil: u.validUntil,
    effectiveDate,
    version: u.version,
    stale: computeStale(tier, fetchedAt, u.validUntil),
    fromCache: tier === "cached" || tier === "field-copy",
    bundled: tier === "bundled",
  };
}

async function readStored<T>(
  store: SnapshotStore,
  tier: "cached" | "field-copy",
  key: string,
  label: string,
  year: number,
): Promise<V2Result<T> | null> {
  const raw = await store.read(key);
  if (!raw) return null;
  const u = unwrap<T>(raw.body, label);
  const fetchedAt = raw.fetchedAt ?? u.generatedAt;
  return {
    data: u.data,
    freshness: freshnessFor(
      tier,
      fetchedAt,
      u,
      u.effectiveFrom ?? seasonWindow(year).effectiveDate,
    ),
  };
}

async function readBundled<T>(key: string, label: string): Promise<V2Result<T> | null> {
  const entry = await getBundledRegsEntry<T>(key);
  if (!entry) return null;
  const meta = {
    validUntil: entry.meta.validUntil,
    sourceLabel: entry.meta.sourceLabel ?? label,
    generatedAt: entry.meta.generatedAt,
    effectiveFrom: entry.meta.effectiveDate,
    version: entry.meta.version,
  };
  return {
    data: entry.data,
    freshness: freshnessFor("bundled", entry.meta.generatedAt, meta, entry.meta.effectiveDate),
  };
}

/** The newer of two stored copies by fetchedAt. */
function newest<T>(a: V2Result<T> | null, b: V2Result<T> | null): V2Result<T> | null {
  if (!a) return b;
  if (!b) return a;
  return Date.parse(b.freshness.fetchedAt) > Date.parse(a.freshness.fetchedAt) ? b : a;
}

const sessions = new Map<string, { at: number; result: V2Result<unknown> }>();
const inflight = new Map<string, Promise<V2Result<unknown>>>();

export interface RegsFetcherConfig {
  /** Public API version the path belongs to. Defaults to v2. */
  api?: RegsApiVersion;
  /** Endpoint path for a season year, relative to the API base (leading slash). */
  path: (year: number) => string;
  /** Stable key for stored copies and the bundled snapshot. */
  cacheKey: (year: number) => string;
  /** Human label for freshness display, e.g. "FWP 2026 district notes". */
  label: (year: number) => string;
  ttlMs?: number;
}

export function createRegsFetcher<T>(config: RegsFetcherConfig) {
  const api = config.api ?? "v2";
  const ttl = config.ttlMs ?? DEFAULT_TTL_MS;

  const load = async (year: number, label: string, key: string): Promise<V2Result<T>> => {
    const base = regsApiBase(api);
    if (base && useConnectivityStore.getState().online) {
      try {
        const res = await fetch(`${base}${config.path(year)}`, {
          headers: { Accept: "application/json" },
        });
        if (res.ok) {
          const body: unknown = await res.json();
          const u = unwrap<T>(body, label);
          const fetchedAt = new Date().toISOString();
          void cacheStore.write(key, body, fetchedAt);
          void fieldStore.write(key, body, fetchedAt);
          return {
            data: u.data,
            freshness: freshnessFor(
              "live",
              fetchedAt,
              u,
              u.effectiveFrom ?? seasonWindow(year).effectiveDate,
            ),
          };
        }
        log.warn("regs API non-OK, trying stored copies", { key, status: res.status });
      } catch (err) {
        log.warn("regs API fetch failed, trying stored copies", { key, error: String(err) });
      }
    }
    const [cached, field] = await Promise.all([
      readStored<T>(cacheStore, "cached", key, label, year),
      readStored<T>(fieldStore, "field-copy", key, label, year),
    ]);
    const stored = newest(cached, field);
    if (stored) return stored;
    const bundled = await readBundled<T>(key, label);
    if (bundled) return bundled;
    throw new RegsApiUnavailableError(label);
  };

  return async function fetchRegs(year = currentRegsYear(), force = false): Promise<V2Result<T>> {
    const key = config.cacheKey(year);
    const label = config.label(year);
    const hit = sessions.get(key);
    const online = useConnectivityStore.getState().online;
    // A fallback result is reused only while offline; online, try the API again.
    if (
      !force &&
      hit &&
      Date.now() - hit.at < ttl &&
      (hit.result.freshness.tier === "live" || !online)
    ) {
      return hit.result as V2Result<T>;
    }
    const pending = inflight.get(key);
    if (pending && !force) return pending as Promise<V2Result<T>>;
    const run = load(year, label, key)
      .then((result) => {
        sessions.set(key, { at: Date.now(), result });
        return result;
      })
      .finally(() => inflight.delete(key));
    inflight.set(key, run);
    return run;
  };
}

export function resetRegsApiCache(): void {
  sessions.clear();
}

useConnectivityStore.subscribe((state, previous) => {
  if (state.online !== previous.online) resetRegsApiCache();
});

// Earlier builds kept one bucket per API version; drop them once.
if (typeof caches !== "undefined") {
  for (const name of LEGACY_CACHE_NAMES) void caches.delete(name).catch(() => false);
}
