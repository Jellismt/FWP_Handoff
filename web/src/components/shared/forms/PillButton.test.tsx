/**
 * @file PillButton.test.tsx
 * @module engage-mt/shared
 * @description Coverage for the canonical
 *              PillButton. Variants + size + icon slots + aria-label +
 *              onClick + the block + default type defaults.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-06
 * @updated 2026-07-03
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { PillButton } from "@/components/shared/forms/PillButton";

describe("PillButton", () => {
  it("renders a button with the children as a label span", () => {
    const { container } = render(<PillButton>Submit</PillButton>);
    expect(screen.getByRole("button", { name: "Submit" })).toBeTruthy();
    expect(container.querySelector(".fwp-pill-button__label")?.textContent).toBe("Submit");
  });

  it("defaults type=button so it does not submit forms", () => {
    render(<PillButton>Save</PillButton>);
    const btn = screen.getByRole("button", { name: "Save" }) as HTMLButtonElement;
    expect(btn.type).toBe("button");
  });

  it("applies variant + size modifier classes", () => {
    const { container, rerender } = render(
      <PillButton variant="primary" size="sm">
        Go
      </PillButton>,
    );
    expect(container.querySelector(".fwp-pill-button--primary")).toBeTruthy();
    expect(container.querySelector(".fwp-pill-button--sm")).toBeTruthy();
    rerender(<PillButton variant="danger">Delete</PillButton>);
    expect(container.querySelector(".fwp-pill-button--danger")).toBeTruthy();
    rerender(<PillButton variant="ghost">Cancel</PillButton>);
    expect(container.querySelector(".fwp-pill-button--ghost")).toBeTruthy();
    rerender(<PillButton variant="on-brand">Action</PillButton>);
    expect(container.querySelector(".fwp-pill-button--on-brand")).toBeTruthy();
  });

  it("applies the block modifier", () => {
    const { container } = render(<PillButton block>Full</PillButton>);
    expect(container.querySelector(".fwp-pill-button--block")).toBeTruthy();
  });

  it("renders iconStart + iconEnd when supplied", () => {
    const { container } = render(
      <PillButton iconStart={ArrowLeft} iconEnd={ArrowRight}>
        Both
      </PillButton>,
    );
    // Two Lucide SVGs.
    expect(container.querySelectorAll("svg").length).toBe(2);
  });

  it("renders an aria-label for icon-only buttons", () => {
    render(<PillButton iconStart={ArrowLeft} ariaLabel="Back" />);
    expect(screen.getByRole("button", { name: "Back" })).toBeTruthy();
  });

  it("fires onClick", () => {
    const onClick = vi.fn();
    render(<PillButton onClick={onClick}>Tap</PillButton>);
    fireEvent.click(screen.getByRole("button", { name: "Tap" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("passes through arbitrary props (disabled, data-testid)", () => {
    render(
      <PillButton disabled data-testid="t">
        x
      </PillButton>,
    );
    const btn = screen.getByTestId("t") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });
});
