# External call rate-limit policy

The canonical reference for every call the app makes to an external service (FWP, DNRC, USGS, NOAA, BLM), including a swap from a stub to a real FWP endpoint.

## Rule

When swapping a stub from `web/src/services/stubs/<name>.stub.ts` to a real service, do NOT call `fetch()` directly. Use **`fetchJson` / `fetchText` from [`web/src/utils/http.ts`](../../web/src/utils/http.ts)** — the one sanctioned external-fetch surface (it owns the AbortController timeout, per-service timeout overrides, caller-signal merge, and typed-error mapping). For endpoints that should retry, wrap the call in **`withBackoff`** (also exported from `utils/http.ts`).


Per-endpoint expectations (`maxAttempts: 1` means no retry — the call runs once):

| Endpoint kind | `withBackoff` maxAttempts | baseDelayMs | timeout (`http.ts`) | cap on per-tick rate |
|---|---|---|---|---|
| FWP-internal (XMT auth) | 1 (no retry) | — | 30 s default | one in-flight per user |
| DNRC stage gages | 3 | 1000 ms | 45 s (service override) | 15 min cadence per gage |
| USGS instantaneous values | 3 | 1000 ms | 45 s (service override) | 15 min cadence per gage |
| Radar (NOAA) | 2 | 1000 ms | 30 s default | 60 s cadence per tile/region |
| BLM / USFS public services | 1 | — | 30 s default | no documented quota — call sparingly |
| MyFWP wallet | 1 (no retry) | — | 30 s default | one per session, then cache |

`withBackoff` defaults are `{ maxAttempts: 3, baseDelayMs: 1000, maxDelayMs: 30000 }` and retry only on retriable failures (429 / network / timeout `NetworkError`); a caller-abort `AbortError` is terminal and never retried. Wrap auth and write paths in a single attempt (omit `withBackoff`, or `maxAttempts: 1`) so a retry can't double-charge or double-submit. Timeouts come from `http.ts` (30 s default, with per-service overrides in `SERVICE_TIMEOUT_OVERRIDES`) — don't reimplement them at the call site.

## Why this matters

Stubs return fixtures with zero per-request cost. Real services are paid (FWP IT budget) or rate-limited (USGS, NOAA, BLM). A swap that drops the rate guard turns a working stub into an outage vector — bulk tap-to-query across the state would spam the real endpoint with hundreds of requests per minute.

## Per-stub overrides

Each `STUB-NNN.md` should include a `Replacement Plan` section that, before any code change, lists:

1. The endpoint's published rate limit (or "unknown — assume conservative").
2. Whether the swap will use `withBackoff` defaults or override `maxAttempts` / `baseDelayMs` (and any `SERVICE_TIMEOUT_OVERRIDES` entry needed in `http.ts`).
3. Whether the call site needs a debounce / cache layer above the retry helper.

If the answer to (3) is yes, document the cache TTL — most spatial queries can safely cache the result for 60 s (zoom-pan within the same envelope hits the cache).

## Circuit-breaker (future)

When a stub swap produces sustained 5xx for > 30 s, the call site should switch to "degraded" — surface a Calcite Notice in the TapQueryPanel / LayerPanel and stop pinging. Wire to the existing `tapQueryFailureStore` (introduced 2026-06-02) so a single store powers the chip across stubs.

## See also

- [docs/rules/data-stubs.md](../../docs/rules/data-stubs.md) — Stub convention.
- [`web/src/utils/http.ts`](../../web/src/utils/http.ts) — `fetchJson` / `fetchText` + `withBackoff` (the sanctioned external-fetch surface).
- [`web/src/store/map/tapQueryFailureStore.ts`](../../web/src/store/map/tapQueryFailureStore.ts) — Shared failure store for chips.
