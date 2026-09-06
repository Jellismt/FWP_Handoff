/**
 * @file EmptyStateCard.test.tsx
 * @module engage-mt/shared
 * @description Coverage for EmptyStateCard.
 *              Verifies role="status", icon rendering, title/body
 *              rendering, suggestion button + link variants, and the
 *              3-suggestion cap.
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
import { EmptyStateCard } from "@/components/shared/feedback/EmptyStateCard";

describe("EmptyStateCard", () => {
  it("renders title + body inside a role=status container so SR announces it once", () => {
    render(<EmptyStateCard title="No trails" body="Adjust the filters above." />);
    const status = screen.getByRole("status");
    expect(status).toBeTruthy();
    expect(status.textContent).toContain("No trails");
    expect(status.textContent).toContain("Adjust the filters above.");
  });

  it("renders suggestion buttons and fires their onClick", () => {
    const onSuggest = vi.fn();
    render(
      <EmptyStateCard
        title="No trails"
        body="—"
        suggestions={[{ label: "Show all", onClick: onSuggest }]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Show all" }));
    expect(onSuggest).toHaveBeenCalledTimes(1);
  });

  it("renders suggestions with href as anchor links", () => {
    render(
      <EmptyStateCard
        title="No trails"
        body="—"
        suggestions={[{ label: "FWP regs", href: "https://fwp.mt.gov/regs" }]}
      />,
    );
    const link = screen.getByRole("link", { name: "FWP regs" }) as HTMLAnchorElement;
    expect(link.href).toBe("https://fwp.mt.gov/regs");
    expect(link.target).toBe("_blank");
    expect(link.rel).toContain("noopener");
  });

  it("caps suggestions at 3 even if more are provided", () => {
    render(
      <EmptyStateCard
        title="No trails"
        body="—"
        suggestions={[
          { label: "One" },
          { label: "Two" },
          { label: "Three" },
          { label: "Four" },
          { label: "Five" },
        ]}
      />,
    );
    expect(screen.getByRole("button", { name: "One" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Two" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Three" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Four" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Five" })).toBeNull();
  });

  it("emits a data-module attribute so module-accented styling can target it", () => {
    render(<EmptyStateCard module="hunt" title="No districts" body="—" />);
    const node = screen.getByRole("status");
    expect(node.getAttribute("data-module")).toBe("hunt");
  });

  it("applies the compact variant class when compact=true", () => {
    render(<EmptyStateCard compact title="—" body="—" />);
    expect(screen.getByRole("status").className).toContain("fwp-empty-state--compact");
  });

  it("passes through data-testid for downstream test hooks", () => {
    render(<EmptyStateCard data-testid="trail-empty" title="—" body="—" />);
    expect(screen.getByTestId("trail-empty")).toBeTruthy();
  });

  it("renders without suggestions when none provided (no suggestion container)", () => {
    const { container } = render(<EmptyStateCard title="—" body="—" />);
    expect(container.querySelector(".fwp-empty-state__suggestions")).toBeNull();
  });
});
