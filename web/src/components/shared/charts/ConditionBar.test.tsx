/**
 * @file ConditionBar.test.tsx
 * @module engage-mt/shared/charts
 * @description Unit tests for the ConditionBar primitive. Renders with
 *              @testing-library/react and asserts on both modes: the discrete
 *              segmented bar (segment widths from weights, swatch legend,
 *              marker clamping) and the gradient variant mode (built-in band
 *              legend, gradient track, variant modifier class, `segments`
 *              ignored). Also covers the marker 0..1 clamp, the caption /
 *              readout slots, and the aria-label fallback chain.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-01
 * @updated 2026-07-01
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { ConditionBar, type ConditionSegment } from "./ConditionBar";

const SEGMENTS: ConditionSegment[] = [
  { label: "Low", weight: 1, color: "var(--fwp-domain-drought)" },
  { label: "Typical", weight: 2, color: "var(--fwp-domain-flow)" },
  { label: "High", weight: 1, color: "var(--fwp-red)" },
];

describe("ConditionBar — segmented mode", () => {
  it("renders one segment + one legend swatch per input segment", () => {
    const { container } = render(<ConditionBar segments={SEGMENTS} />);
    expect(container.querySelectorAll(".fwp-condition-bar__segment").length).toBe(3);
    expect(container.querySelectorAll(".fwp-condition-bar__swatch").length).toBe(3);
  });

  it("sizes segments by weight (2/4 = 50% for the Typical band)", () => {
    const { container } = render(<ConditionBar segments={SEGMENTS} />);
    const typical = Array.from(
      container.querySelectorAll<HTMLElement>(".fwp-condition-bar__segment"),
    ).find((el) => el.getAttribute("aria-label") === "Typical");
    expect(typical?.style.width).toBe("50%");
  });

  it("does not render a marker when marker is undefined", () => {
    const { container } = render(<ConditionBar segments={SEGMENTS} />);
    expect(container.querySelector(".fwp-condition-bar__marker")).toBeNull();
  });

  it("positions the marker as a percentage of the bar", () => {
    const { container } = render(<ConditionBar segments={SEGMENTS} marker={0.3} />);
    const marker = container.querySelector<HTMLElement>(".fwp-condition-bar__marker");
    expect(marker?.style.left).toBe("30%");
  });

  it("clamps an out-of-range marker into 0..100%", () => {
    const over = render(<ConditionBar segments={SEGMENTS} marker={1.7} />);
    expect(
      over.container.querySelector<HTMLElement>(".fwp-condition-bar__marker")?.style.left,
    ).toBe("100%");
    const under = render(<ConditionBar segments={SEGMENTS} marker={-0.4} />);
    expect(
      under.container.querySelector<HTMLElement>(".fwp-condition-bar__marker")?.style.left,
    ).toBe("0%");
  });

  it("renders the caption + readout slots when supplied", () => {
    const { getByText } = render(
      <ConditionBar segments={SEGMENTS} caption="Flow class" readout="342 cfs" />,
    );
    expect(getByText("Flow class")).toBeTruthy();
    expect(getByText("342 cfs")).toBeTruthy();
  });

  it("falls back to an empty legend + total=1 for a no-segments call", () => {
    const { container } = render(<ConditionBar />);
    expect(container.querySelectorAll(".fwp-condition-bar__segment").length).toBe(0);
    // Still renders the bar shell without throwing.
    expect(container.querySelector(".fwp-condition-bar")).not.toBeNull();
  });
});

describe("ConditionBar — gradient variant mode", () => {
  it("renders the built-in flow legend and ignores `segments`", () => {
    const { container, queryByText } = render(
      <ConditionBar variant="flow" segments={SEGMENTS} marker={0.5} />,
    );
    // Discrete segments are NOT rendered in variant mode.
    expect(container.querySelector(".fwp-condition-bar__segment")).toBeNull();
    // The variant's own band legend appears instead.
    expect(queryByText("Drought")).toBeTruthy();
    expect(queryByText("Flood")).toBeTruthy();
    // Variant modifier class + gradient track.
    expect(container.querySelector(".fwp-condition-bar--flow")).not.toBeNull();
    expect(container.querySelector(".fwp-condition-bar__track--gradient")).not.toBeNull();
  });

  it("renders the temp variant legend", () => {
    const { queryByText } = render(<ConditionBar variant="temp" />);
    expect(queryByText("Optimal")).toBeTruthy();
    expect(queryByText("Stress")).toBeTruthy();
  });

  it("clamps the variant marker and omits it when unset", () => {
    const withMarker = render(<ConditionBar variant="swe" marker={2} />);
    expect(
      withMarker.container.querySelector<HTMLElement>(".fwp-condition-bar__marker")?.style.left,
    ).toBe("100%");
    const without = render(<ConditionBar variant="swe" />);
    expect(without.container.querySelector(".fwp-condition-bar__marker")).toBeNull();
  });

  it("renders the readout beside the gradient track", () => {
    const { getByText } = render(<ConditionBar variant="depth" readout="42 ft" />);
    expect(getByText("42 ft")).toBeTruthy();
  });
});
