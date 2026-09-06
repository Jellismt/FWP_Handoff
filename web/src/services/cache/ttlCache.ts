/**
 * @file ttlCache.ts
 * @module engage-mt/services/cache
 * @description Canonical in-process TTL + inflight-dedup cache. One
 *              call site for every service that needs caching, replacing the
 *              per-service Maps that drifted across the codebase.
 *
 *              Behaviors:
 *              - Returns the cached value when fresh (now - ts < ttlMs).
 *              - Returns the in-flight promise when a load is already running
 *                for the same key (request coalescing).
 *              - Drops the cache entry when the loader throws, so a subsequent
 *                call retries instead of returning the failed promise.
 *
 *              Intentionally NOT included:
 *              - LRU eviction (the live keyspace is small — < a few hundred —
 *                and tabs reload often enough that unbounded growth isn't a
 *                real risk yet). Revisit if the heap shows otherwise.
 *              - Cross-tab / IndexedDB persistence (per `docs/rules/privacy.md`
 *                Tier-2 datasets are bundled, and Tier-1 spatial layers don't
 *                need it).
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-06
 * @updated 2026-06-17
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

interface CacheEntry<T> {
  ts: number;
  data: T;
}

/**
 * Per-namespace entry cap. Without one the cache grows for the life of the tab
 * with every distinct feature the user taps, since an expired entry is only
 * reclaimed if that same key is asked for again.
 */
export const MAX_ENTRIES_PER_NAMESPACE = 500;

const stores = new Map<string, Map<string, CacheEntry<unknown>>>();
const inflight = new Map<string, Map<string, Promise<unknown>>>();

const storeFor = (namespace: string): Map<string, CacheEntry<unknown>> => {
  let s = stores.get(namespace);
  if (!s) {
    s = new Map();
    stores.set(namespace, s);
  }
  return s;
};

const inflightFor = (namespace: string): Map<string, Promise<unknown>> => {
  let s = inflight.get(namespace);
  if (!s) {
    s = new Map();
    inflight.set(namespace, s);
  }
  return s;
};

/**
 * `ttlCache(namespace, key, ttlMs, loader)` — get-or-load with TTL + inflight
 * dedup. Use a stable `namespace` per service ("usgs-dv", "dnrc-stage", etc.)
 * so unrelated services can't accidentally collide keys.
 *
 * Example:
 *
 *   export const fetchFoo = (id: string) =>
 *     ttlCache("foo", id, 60_000, async () => {
 *       const res = await fetch(`/api/foo/${id}`);
 *       return res.json() as Promise<Foo>;
 *     });
 */
export async function ttlCache<T>(
  namespace: string,
  key: string,
  ttlMs: number,
  loader: () => Promise<T>,
): Promise<T> {
  const cache = storeFor(namespace) as Map<string, CacheEntry<T>>;
  const inflightMap = inflightFor(namespace) as Map<string, Promise<T>>;

  const fresh = cache.get(key);
  if (fresh) {
    if (Date.now() - fresh.ts < ttlMs) return fresh.data;
    // Stale: drop it now rather than leaving it to be reclaimed only if this
    // exact key is requested again.
    cache.delete(key);
  }

  const pending = inflightMap.get(key);
  if (pending) return pending;

  const promise = (async () => {
    try {
      const data = await loader();
      // Delete before set so the key moves to the back: a Map keeps an
      // existing key's original position, and the front is what gets evicted.
      cache.delete(key);
      cache.set(key, { ts: Date.now(), data });
      while (cache.size > MAX_ENTRIES_PER_NAMESPACE) {
        const oldest = cache.keys().next();
        if (oldest.done) break;
        cache.delete(oldest.value);
      }
      return data;
    } catch (err) {
      // Don't cache failures — next call retries. Re-throw so the typed
      // error reaches the hook layer.
      cache.delete(key);
      throw err;
    } finally {
      inflightMap.delete(key);
    }
  })();

  inflightMap.set(key, promise);
  return promise;
}

/** Invalidate a single key, or every key in a namespace if `key` is omitted. */
export const invalidate = (namespace: string, key?: string): void => {
  const cache = stores.get(namespace);
  if (!cache) return;
  if (key === undefined) cache.clear();
  else cache.delete(key);
};

/** Test helper — clear everything. Don't call from production code. */
export const __resetAllCaches = (): void => {
  stores.clear();
  inflight.clear();
};
