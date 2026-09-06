/**
 * @file Skeleton.test.tsx
 * @module engage-mt/shared
 * @description Coverage for the Skeleton primitives.
 *              Verifies aria-busy, the silent / loud variants, the grid
 *              count prop, and the SR-only "Loading…" message.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-06
 * @updated 2026-07-03
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  SkeletonCard,
  SkeletonListItem,
  SkeletonGrid,
} from "@/components/shared/feedback/Skeleton";

describe("SkeletonCard", () => {
  it("carries aria-busy and a polite live region by default", () => {
    render(<SkeletonCard data-testid="card" />);
    const node = screen.getByTestId("card");
    expect(node.getAttribute("aria-busy")).toBe("true");
    expect(node.getAttribute("aria-live")).toBe("polite");
  });

  it("suppresses aria-live in silent mode", () => {
    render(<SkeletonCard silent data-testid="card" />);
    const node = screen.getByTestId("card");
    expect(node.getAttribute("aria-live")).toBeNull();
    // aria-busy stays so SR users hear something is happening.
    expect(node.getAttribute("aria-busy")).toBe("true");
  });

  it("renders an SR-only 'Loading…' label", () => {
    render(<SkeletonCard />);
    expect(screen.getByText("Loading…")).toBeTruthy();
  });
});

describe("SkeletonListItem", () => {
  it("renders aria-busy and the SR label", () => {
    render(<SkeletonListItem data-testid="row" />);
    expect(screen.getByTestId("row").getAttribute("aria-busy")).toBe("true");
    expect(screen.getByText("Loading…")).toBeTruthy();
  });

  it("silent variant drops aria-live", () => {
    render(<SkeletonListItem silent data-testid="row" />);
    expect(screen.getByTestId("row").getAttribute("aria-live")).toBeNull();
  });
});

describe("SkeletonGrid", () => {
  it("renders the requested number of cards", () => {
    const { container } = render(<SkeletonGrid count={3} data-testid="grid" />);
    expect(container.querySelectorAll(".fwp-skeleton-card").length).toBe(3);
  });

  it("defaults to 6 cards", () => {
    const { container } = render(<SkeletonGrid />);
    expect(container.querySelectorAll(".fwp-skeleton-card").length).toBe(6);
  });

  it("owns its own polite live region (child cards are silent)", () => {
    render(<SkeletonGrid count={2} data-testid="grid" />);
    const grid = screen.getByTestId("grid");
    expect(grid.getAttribute("aria-busy")).toBe("true");
    expect(grid.getAttribute("aria-live")).toBe("polite");
    // The two card children should NOT each carry aria-live.
    const cards = grid.querySelectorAll(".fwp-skeleton-card");
    cards.forEach((c) => expect(c.getAttribute("aria-live")).toBeNull());
  });
});
