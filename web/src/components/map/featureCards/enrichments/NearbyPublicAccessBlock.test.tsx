/**
 * @file NearbyPublicAccessBlock.test.tsx
 * @module engage-mt/map/featureCards/enrichments
 * @description Unit tests for the NearbyPublicAccessBlock enrichment. Drives
 *              the `queryNearbyFeatures` seam per layer (BMA / FAS) to
 *              cover: the null render when no tapPoint is given + before
 *              resolution + when both layers return zero hits; the
 *              rendered ListCards (only for layers with hits), the name-key
 *              coalescing across the per-layer outField variants, the
 *              distance formatting (< 0.1 mi vs one-decimal), the independent
 *              degradation when one layer's query rejects, and the radius /
 *              per-layer-limit props threading into the queries + titles.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-01
 * @updated 2026-07-16
 * @version 2.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";
import type { TapPoint } from "@/components/map/featureCards/core/types";

const h = vi.hoisted(() => ({
  queryNearbyFeatures: vi.fn(),
}));

vi.mock("@/services/spatialContext/nearby", () => ({
  queryNearbyFeatures: h.queryNearbyFeatures,
}));

import { NearbyPublicAccessBlock } from "./NearbyPublicAccessBlock";

interface Hit {
  attributes: Record<string, unknown>;
  distanceMiles: number;
}

const POINT: TapPoint = { x: 0, y: 0, longitude: -111.5, latitude: 45.6 };

// The block issues two queries in a fixed order: BMA, FAS.
const wire = (bma: Hit[], fas: Hit[], opts?: { rejectFas?: boolean }): void => {
  let call = 0;
  h.queryNearbyFeatures.mockImplementation(() => {
    const idx = call;
    call += 1;
    if (idx === 0) return Promise.resolve(bma);
    if (opts?.rejectFas) return Promise.reject(new Error("403"));
    return Promise.resolve(fas);
  });
};

beforeEach(() => {
  h.queryNearbyFeatures.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("NearbyPublicAccessBlock — guards", () => {
  it("renders nothing and issues no query without a tapPoint", () => {
    const { container } = render(<NearbyPublicAccessBlock />);
    expect(container.firstChild).toBeNull();
    expect(h.queryNearbyFeatures).not.toHaveBeenCalled();
  });

  it("renders nothing once resolved with zero hits across both layers", async () => {
    wire([], []);
    const { container } = render(<NearbyPublicAccessBlock tapPoint={POINT} />);
    await waitFor(() => expect(h.queryNearbyFeatures).toHaveBeenCalledTimes(2));
    // Give the resolved-state flip a tick.
    await waitFor(() => expect(container.firstChild).toBeNull());
  });
});

describe("NearbyPublicAccessBlock — rendered lists", () => {
  it("renders a ListCard per layer that returned hits, with coalesced names", async () => {
    wire(
      [{ attributes: { BMANAME: "Roundtop BMA" }, distanceMiles: 2.3 }],
      [{ attributes: { SITENAME: "Lone Pine FAS" }, distanceMiles: 0.05 }],
    );
    const { container, findByText } = render(<NearbyPublicAccessBlock tapPoint={POINT} />);
    await findByText(/Nearby BMAs/);
    const txt = container.textContent ?? "";
    expect(txt).toMatch(/Roundtop BMA/);
    expect(txt).toMatch(/2\.3 mi/);
    expect(txt).toMatch(/Nearby fishing access sites/);
    expect(txt).toMatch(/Lone Pine FAS/);
    // 0.05 mi rounds to the "< 0.1 mi" label.
    expect(txt).toMatch(/< 0\.1 mi/);
  });

  it("shows only the layers with hits (FAS empty → its card is omitted)", async () => {
    wire([{ attributes: { NAME: "Some BMA" }, distanceMiles: 1.2 }], []);
    const { container, findByText } = render(<NearbyPublicAccessBlock tapPoint={POINT} />);
    await findByText(/Nearby BMAs/);
    const txt = container.textContent ?? "";
    expect(txt).toMatch(/Nearby BMAs/);
    expect(txt).not.toMatch(/Nearby fishing access sites/);
  });

  it("falls back to '(unnamed)' when no name key resolves on a hit", async () => {
    wire([{ attributes: { UNRELATED: "x" }, distanceMiles: 1 }], []);
    const { findByText } = render(<NearbyPublicAccessBlock tapPoint={POINT} />);
    expect(await findByText(/\(unnamed\)/)).toBeTruthy();
  });
});

describe("NearbyPublicAccessBlock — independent degradation + props", () => {
  it("still renders BMA when the FAS query rejects", async () => {
    wire([{ attributes: { BMANAME: "OK BMA" }, distanceMiles: 1.0 }], [], { rejectFas: true });
    const { container, findByText } = render(<NearbyPublicAccessBlock tapPoint={POINT} />);
    await findByText(/Nearby BMAs/);
    const txt = container.textContent ?? "";
    expect(txt).toMatch(/OK BMA/);
    expect(txt).not.toMatch(/Nearby fishing access sites/);
  });

  it("threads a custom radius into the query distance + the card titles", async () => {
    wire([{ attributes: { BMANAME: "Radius BMA" }, distanceMiles: 6 }], []);
    const { findByText } = render(
      <NearbyPublicAccessBlock tapPoint={POINT} radiusMiles={10} perLayerLimit={5} />,
    );
    await findByText(/within 10 mi/);
    // The distance + limit propagate into the query call.
    const firstCall = h.queryNearbyFeatures.mock.calls[0][0];
    expect(firstCall.distanceMiles).toBe(10);
    expect(firstCall.limit).toBe(5);
  });
});
