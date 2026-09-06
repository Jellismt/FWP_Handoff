# Data Stubs — Engage MT Convention

The app builds UI for authenticated/private FWP endpoints before FWP grants credentials. The stub convention keeps that work auditable and easy to swap when access lands.

## What gets stubbed

Any data source that:

- Requires FWP OAuth (MyFWP / XMT)
- Requires an internal FWP REST API not on the public Hub
- Requires an FWP-internal ArcGIS service
- Touches license or permit data

Public Hub layers (BMA, hunting districts, FAS, WMAs, state parks) are NOT stubbed — call them directly.

## File layout

- Stub modules: `web/src/services/stubs/<Domain>.stub.ts` (e.g. `myFwpLicenses.stub.ts`).
- Per-stub contract doc: `docs/stubs/STUB-NNN.md`.
- Stub registry index: `web/src/services/stubs/registry.ts` (gated by `npm run check:stubs`).

## File-header pattern

Every stub file starts with:

```ts
/**
 * @file myFwpLicenses.stub.ts
 * @module engage-mt/services/stubs
 * @description STUB-001 — MyFWP License Wallet. Returns mock licenses and permits.
 * @author Jamie Ellis / Engage MT
 * @created 2026-05-29
 * @updated 2026-05-29
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

// TODO: REPLACE_STUB — Awaiting FWP endpoint access
// Stub ID: STUB-001 | Expected: GET /api/myfwp/licenses | Auth: OAuth Bearer (XMT)
// See: docs/stubs/STUB-001.md for full contract
```

## Stub contract doc shape

`docs/stubs/STUB-NNN.md`:

```markdown
# STUB-NNN — <Human-readable feature name>

| Field                  | Value                                   |
| ---------------------- | --------------------------------------- |
| Status                 | AWAITING_FWP_ACCESS / IN_DEV            |
| Feature                | Short name                              |
| Stub File              | `web/src/services/stubs/...`            |
| Expected Endpoint      | `<METHOD> /api/...`                     |
| Auth                   | None / Bearer (XMT) / API Key           |
| Owner of Real Endpoint | FWP team / contact                      |

## Request

Query params, body schema, headers.

## Response

Full TypeScript interface plus a representative JSON example.

## Replacement Plan

What changes when the real endpoint lands. Migration checklist.
```

## Status vocabulary

- `AWAITING_FWP_ACCESS` — built and stubbed; blocked on FWP credentials/URL.
- `IN_DEV` — actively being wired to a real endpoint.

When a real service lands, delete the `.stub.ts`, its registry row, and its contract doc together.

## Mock data quality

Stubs return _realistic_ data — real-ish names, plausible dates, varied edge cases (empty list, single item, multi-page). Place fixture JSON next to the stub as `<name>.fixture.json` when the shape gets large.

## Never fake real tokens

When stubbing OAuth flows, **clearly** mock — return a recognizable test token like `"STUB-OAUTH-DO-NOT-SEND"`. Never produce something that looks production-real, which could leak into telemetry or logs.
