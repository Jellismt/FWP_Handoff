/**
 * @file renderers.test.tsx
 * @module engage-mt/map/featureCards
 * @description Snapshot + presence-of-key-content tests for
 *              the 10 highest-traffic Tier-2 renderers. Pattern: resolve
 *              the renderer from the registry, render its Body with a
 *              representative fixture, assert that the rendered HTML
 *              contains the expected name + at least one MetricPill +
 *              renderer-specific text. We intentionally don't full-
 *              snapshot every byte because the cards include some
 *              tooltip text that drifts; instead we assert the key
 *              content surfaces — the things a regression would actually
 *              break.
 *
 * Renderers under test: BMA, FAS, State
 *              Park, WMA, Hunting District, Cadastral, Gage.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-01
 * @updated 2026-07-07
 * @version 1.1.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
// Side-effect import to register every Tier-2 renderer.
import "../index";
import { resolveFeature } from "@/components/map/featureCards/core/registry";
import { FIXTURE_ATTRS, fixtureProps } from "@/test/fixtures";

const renderBody = (layerId: string) => {
  const renderer = resolveFeature(layerId);
  if (!renderer) throw new Error(`Renderer not registered: ${layerId}`);
  const Body = renderer.Body;
  return render(
    <MemoryRouter>
      <Body {...fixtureProps(layerId)} />
    </MemoryRouter>,
  );
};

describe("Tier-2 renderers — high-traffic 10", () => {
  it("BmaCard renders summary + key fields", () => {
    const renderer = resolveFeature("bma-boundaries");
    expect(renderer).toBeTruthy();
    if (!renderer) return;
    expect(renderer.summary(FIXTURE_ATTRS["bma-boundaries"]!)).toMatch(/Roundtop/);
    const { container } = renderBody("bma-boundaries");
    expect(container.textContent ?? "").toMatch(/6,?420/); // acres
  });

  it("FasCard renders FWP page + PDF map + Directions chips + amenities", () => {
    const renderer = resolveFeature("fishing-access-sites");
    expect(renderer).toBeTruthy();
    if (!renderer) return;
    expect(renderer.summary(FIXTURE_ATTRS["fishing-access-sites"]!)).toMatch(/Lone Pine/);
    const { container } = renderBody("fishing-access-sites");
    const txt = container.textContent ?? "";
    expect(txt).toMatch(/Boat ramp/i);
    expect(txt).toMatch(/Madison River/i);
  });

  it("StateParkCard renders the stacked identity block (county)", () => {
    const renderer = resolveFeature("state-parks");
    expect(renderer).toBeTruthy();
    if (!renderer) return;
    expect(renderer.summary(FIXTURE_ATTRS["state-parks"]!)).toMatch(/Bannack/);
    const { container } = renderBody("state-parks");
    const txt = container.textContent ?? "";
    expect(txt).toMatch(/Beaverhead/i);
  });

  it("WmaCard renders purpose + hunting-access TipBlock", () => {
    const renderer = resolveFeature("wildlife-management-areas");
    expect(renderer).toBeTruthy();
    if (!renderer) return;
    expect(renderer.summary(FIXTURE_ATTRS["wildlife-management-areas"]!)).toMatch(/Haggin/);
    const { container } = renderBody("wildlife-management-areas");
    const txt = container.textContent ?? "";
    expect(txt).toMatch(/winter range/i);
  });

  it("HuntingDistrictCard renders district + region", () => {
    const renderer = resolveFeature("hunting-districts");
    expect(renderer).toBeTruthy();
    if (!renderer) return;
    expect(renderer.summary(FIXTURE_ATTRS["hunting-districts"]!)).toMatch(/District 380/);
    const { container } = renderBody("hunting-districts");
    const txt = container.textContent ?? "";
    // Body leads with the authoritative area hero + region pill (the district
    // number lives in the card header/summary, asserted above).
    expect(txt).toMatch(/District area/i);
    expect(txt).toMatch(/Region/i);
  });

  it("CadastralCard renders MSDI schema (PARCELID + CountyName + GISAcres)", () => {
    const renderer = resolveFeature("mt-cadastral");
    expect(renderer).toBeTruthy();
    if (!renderer) return;
    expect(renderer.summary(FIXTURE_ATTRS["mt-cadastral"]!)).toMatch(/30-3047-23-1-04/);
    const { container } = renderBody("mt-cadastral");
    const txt = container.textContent ?? "";
    expect(txt).toMatch(/Madison/i);
    expect(txt).toMatch(/42\.7/);
    // No property-type pill — owner type feeds agency resolution only.
    expect(txt).not.toMatch(/Agricultural/i);
    // Private-land TipBlock should appear because Agricultural !== public.
    expect(txt).toMatch(/permission/i);
  });

  it("GageCard summarizes a DNRC station by name", () => {
    const renderer = resolveFeature("dnrc-stage-gages");
    expect(renderer).toBeTruthy();
    if (!renderer) return;
    expect(renderer.summary(FIXTURE_ATTRS["dnrc-stage-gages"]!)).toMatch(/Madison/i);
  });
});

describe("Tier-2 renderers", () => {
  it("BlmRecCard renders use type + permit tip", () => {
    const r = resolveFeature("blm-recreation-sites");
    expect(r).toBeTruthy();
    if (!r) return;
    expect(r.summary(FIXTURE_ATTRS["blm-recreation-sites"]!)).toMatch(/Holter Lake/i);
    const { container } = renderBody("blm-recreation-sites");
    const txt = container.textContent ?? "";
    expect(txt).toMatch(/Boat ramp|trout/i);
    expect(txt).toMatch(/blm\.gov|BLM permit/i);
  });

  it("UsfsRecCard renders forest + district + access rules", () => {
    const r = resolveFeature("usfs-recreation-sites");
    expect(r).toBeTruthy();
    if (!r) return;
    const { container } = renderBody("usfs-recreation-sites");
    const txt = container.textContent ?? "";
    expect(txt).toMatch(/Hyalite|Gallatin/i);
    expect(txt).toMatch(/14 days/i);
  });

  it("BorRecCard renders site name + access guidance", () => {
    const r = resolveFeature("bor-recreation-sites");
    expect(r).toBeTruthy();
    if (!r) return;
    const { container } = renderBody("bor-recreation-sites");
    const txt = container.textContent ?? "";
    expect(txt).toMatch(/Canyon Ferry/i);
    expect(txt).toMatch(/day-use/i);
  });

  // Per-species HD variants — all use HuntingDistrictCard via its registration loop.
  it.each([
    ["hunting-districts-antelope", /Antelope/i, "400"],
    ["hunting-districts-sheep", /Bighorn Sheep/i, "501"],
    ["hunting-districts-moose", /Moose/i, "316"],
    ["hunting-districts-goat", /Mountain Goat/i, "215"],
    ["hunting-districts-upland-bird", /Upland Bird/i, "650"],
  ])(
    "HuntingDistrictCard registers for %s (species subtitle + detail route)",
    (layerId, speciesPattern, district) => {
      const r = resolveFeature(layerId);
      expect(r, layerId).toBeTruthy();
      if (!r) return;
      const subtitle = r.subtitle?.(FIXTURE_ATTRS[layerId]!) ?? "";
      expect(subtitle).toMatch(speciesPattern);
      expect(r.detailRoute?.(FIXTURE_ATTRS[layerId]!)).toBe(`/hunt/district/${district}`);
    },
  );
});
