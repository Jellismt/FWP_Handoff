/**
 * @file registry.ts
 * @module engage-mt/services/stubs
 * @description Registry of every FWP integration the app stubs, one entry per
 *              `STUB-NNN` contract in `docs/stubs/`. `npm run check:stubs`
 *              asserts that every `*.stub.ts` on disk is registered and every
 *              registered contract doc exists.
 * @author Jamie Ellis / Engage MT
 * @created 2026-05-29
 * @updated 2026-09-05
 * @version 2.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

export type StubStatus = "AWAITING_FWP_ACCESS" | "IN_DEV";

export interface StubEntry {
  id: string;
  feature: string;
  /** Stub module under `web/src/services/stubs/`, or null for a record-only contract. */
  file: string | null;
  expectedEndpoint: string;
  auth: "None" | "Bearer (XMT)" | "API Key";
  status: StubStatus;
  swapDoc: string;
}

export const STUBS: readonly StubEntry[] = [
  {
    id: "STUB-001",
    feature: "MyFWP License Wallet",
    file: "myFwpLicenses.stub.ts",
    expectedEndpoint: "GET /api/myfwp/licenses",
    auth: "Bearer (XMT)",
    status: "AWAITING_FWP_ACCESS",
    swapDoc: "docs/stubs/STUB-001.md",
  },
  {
    // Record-only. There is no stub file: third-party mapping apps' in-app
    // share links are a proprietary, undecodable format. The app opens the
    // GPX/KML files those apps export instead, and detects-and-guides when a
    // user brings an external share link into the app.
    id: "STUB-034",
    feature: "External share-link bridge (infeasible without a third-party partnership)",
    file: null,
    expectedEndpoint: "N/A — proprietary third-party link resolution",
    auth: "None",
    status: "AWAITING_FWP_ACCESS",
    swapDoc: "docs/stubs/STUB-034.md",
  },
];
