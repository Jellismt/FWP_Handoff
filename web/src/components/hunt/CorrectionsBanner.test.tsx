/**
 * @file CorrectionsBanner.test.tsx
 * @module engage-mt/hunt
 * @description Missing corrections warn, included ones inform, unrelated
 *              districts and feed failures render nothing.
 * @author Jamie Ellis / Engage MT
 * @created 2026-09-06
 * @updated 2026-09-06
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import type { RegsCorrection } from "@/services/regsApi/corrections";

// A plain function rather than vi.fn: the feed is rejected on purpose in one
// case, and a rejecting mock's result tracking would surface as an unhandled
// error in the test runner.
const h = vi.hoisted(() => ({
  calls: 0,
  rows: [] as RegsCorrection[],
  reject: false,
}));
vi.mock("@/services/regsApi/corrections", async (importActual) => ({
  ...(await importActual<typeof import("@/services/regsApi/corrections")>()),
  fetchCorrections: () => {
    h.calls += 1;
    return h.reject ? Promise.reject(new Error("offline")) : Promise.resolve({ data: h.rows });
  },
}));

import { CorrectionsBanner } from "./CorrectionsBanner";

const rows: RegsCorrection[] = [
  {
    version: 2,
    published_at: "2026-08-01T00:00:00Z",
    summary: "Quota change",
    affected_species: null,
    affected_districts: "380",
    note: null,
  },
  {
    version: 3,
    published_at: "2026-09-01T00:00:00Z",
    summary: "Season dates",
    affected_species: null,
    affected_districts: null,
    note: null,
  },
];

beforeEach(() => {
  h.calls = 0;
  h.rows = rows;
  h.reject = false;
});

describe("CorrectionsBanner", () => {
  it("warns about corrections newer than the served version and lists included ones", async () => {
    render(<CorrectionsBanner hd="380" servedVersion={2} />);
    await waitFor(() =>
      expect(screen.getByText("Corrections not in this copy")).toBeInTheDocument(),
    );
    expect(screen.getByText(/2026-09-01 \(v3\) — Season dates/)).toBeInTheDocument();
    expect(screen.getByText("Corrections included")).toBeInTheDocument();
    expect(screen.getByText(/2026-08-01 \(v2\) — Quota change/)).toBeInTheDocument();
  });

  it("renders nothing for a district no correction touches", async () => {
    h.rows = [rows[0]];
    const { container } = render(<CorrectionsBanner hd="410" servedVersion={1} />);
    await waitFor(() => expect(h.calls).toBe(1));
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when the feed cannot be read", async () => {
    h.reject = true;
    const { container } = render(<CorrectionsBanner hd="380" servedVersion={2} />);
    await waitFor(() => expect(h.calls).toBe(1));
    expect(container).toBeEmptyDOMElement();
  });
});
