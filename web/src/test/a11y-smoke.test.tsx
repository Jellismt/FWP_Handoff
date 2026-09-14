/**
 * @file a11y-smoke.test.tsx
 * @module engage-mt/test
 * @description Accessibility regression smoke tests for the high-traffic shared
 *              primitives. Runs axe-core (layout-dependent rules excepted — see
 *              axeSmoke.ts) plus explicit accessible-name assertions. These run
 *              inside the mandatory `npm run verify` unit-test step, so a
 *              primitive can't lose its role / name / label without failing the
 *              gate. The full-page contrast + landmark sweep lives in the
 *              Playwright axe spec (`npm run verify:e2e`).
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-01
 * @updated 2026-07-03
 * @version 1.1.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { MapPin } from "lucide-react";
import { expectNoAxeViolations } from "@/test/axeSmoke";
import { PillButton } from "@/components/shared/forms/PillButton";
import { BottomTabBar } from "@/components/shared/layout/BottomTabBar";
import {
  MetricPill,
  MetricGrid,
  ChipRow,
  Paragraph,
} from "@/components/map/featureCards/core/cardPrimitives";
import { ToolHero } from "@/components/shared/ToolHero";

describe("a11y smoke — shared primitives", () => {
  it("PillButton: icon-only exposes an accessible name", async () => {
    const { container } = render(
      <>
        <PillButton iconStart={MapPin} ariaLabel="Find your location" />
        <PillButton>Show on map</PillButton>
      </>,
    );
    // Icon-only button must not be a nameless control.
    expect(screen.getByRole("button", { name: "Find your location" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show on map" })).toBeInTheDocument();
    await expectNoAxeViolations(container);
  });

  it("card primitives: MetricGrid + ChipRow + Paragraph are violation-free", async () => {
    const { container } = render(
      <>
        <MetricGrid>
          <MetricPill label="Flow" value="450 cfs" />
          <MetricPill label="Temp" value="61°F" />
        </MetricGrid>
        <ChipRow items={["Restroom", "Boat ramp", "Camping"]} />
        <Paragraph>A short paragraph describing the site.</Paragraph>
      </>,
    );
    await expectNoAxeViolations(container);
  });

  it("ToolHero: the title is the page h1 and the band has no a11y violations", async () => {
    const { container } = render(
      <ToolHero
        module="hunt"
        title="Hunting Districts"
        lede="Browse every district and its regulations."
      />,
    );
    expect(screen.getByRole("heading", { level: 1, name: "Hunting Districts" })).toBeTruthy();
    await expectNoAxeViolations(container);
  });

  it("BottomTabBar: is a labelled navigation landmark", async () => {
    const { container } = render(
      <MemoryRouter initialEntries={["/hunt"]}>
        <BottomTabBar />
      </MemoryRouter>,
    );
    expect(screen.getByRole("navigation", { name: /module/i })).toBeInTheDocument();
    // Region rule is disabled globally, but the nav here IS a landmark, so run
    // the full rule set for this landmark-bearing subtree.
    await expectNoAxeViolations(container, { region: { enabled: true } });
  });
});
