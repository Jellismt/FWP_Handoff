/**
 * @file stubFixtures.ts
 * @module engage-mt/services/stubs
 * @description Shared helpers for the .stub.ts files.
 *              Renamed from `_shared.ts` in
 * @author Jamie Ellis / Engage MT
 * @created 2026-05-29
 * @updated 2026-06-06
 * @version 1.1.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

/** Sentinel string used in place of any real OAuth token, */

/** Simulate small network latency so loading states are exercised in dev. */
export const fakeLatency = (ms = 250): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** Generate a deterministic-but-unique-per-call stub id. */
