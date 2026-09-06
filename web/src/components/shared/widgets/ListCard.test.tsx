/**
 * @file ListCard.test.tsx
 * @module engage-mt/shared
 * @description Coverage for ListCard. Verifies the
 *              article shell, eyebrow + title + badges + meta cells +
 *              chips + note + actions slots, the highlight modifier,
 *              the data-module attribute, and the forwardRef contract.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-06
 * @updated 2026-07-03
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { describe, it, expect } from "vitest";
import { createRef } from "react";
import { render, screen } from "@testing-library/react";
import { ListCard } from "@/components/shared/widgets/ListCard";

describe("ListCard", () => {
  it("renders title as h2 inside an article", () => {
    const { container } = render(<ListCard title="Madison River FAS" />);
    const article = container.querySelector("article");
    expect(article).not.toBeNull();
    expect(screen.getByRole("heading", { level: 2, name: "Madison River FAS" })).toBeTruthy();
  });

  it("renders eyebrow + badges in the header", () => {
    render(
      <ListCard
        title="Lone Pine"
        eyebrow="USFS · Lolo NF"
        badges={[
          { label: "Reservable", intent: "success" },
          { label: "Closed in winter", intent: "warning" },
        ]}
      />,
    );
    expect(screen.getByText("USFS · Lolo NF")).toBeTruthy();
    expect(screen.getByText("Reservable")).toBeTruthy();
    expect(screen.getByText("Closed in winter")).toBeTruthy();
  });

  it("renders the meta cells in a dl with sensible structure", () => {
    const { container } = render(
      <ListCard
        title="Big Sky"
        meta={[
          { label: "Sites", value: 24 },
          { label: "Elevation", value: "5,800 ft" },
        ]}
      />,
    );
    expect(container.querySelector("dl")).not.toBeNull();
    expect(screen.getByText("Sites")).toBeTruthy();
    expect(screen.getByText("24")).toBeTruthy();
    expect(screen.getByText("Elevation")).toBeTruthy();
    expect(screen.getByText("5,800 ft")).toBeTruthy();
  });

  it("renders chips + note + actions when provided", () => {
    render(
      <ListCard
        title="Anaconda"
        chips={["Hookups", "ADA", "Pets"]}
        note="Year-round access via state-maintained road."
        actions={<button type="button">Reserve</button>}
      />,
    );
    expect(screen.getByText("Hookups")).toBeTruthy();
    expect(screen.getByText("ADA")).toBeTruthy();
    expect(screen.getByText("Year-round access via state-maintained road.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Reserve" })).toBeTruthy();
  });

  it("applies the is-highlighted modifier when highlight=true", () => {
    const { container } = render(<ListCard title="—" highlight />);
    expect(container.querySelector("article")?.className).toContain("is-highlighted");
  });

  it("emits data-module so module-accented styling can target it", () => {
    const { container } = render(<ListCard title="—" module="fish" />);
    expect(container.querySelector("article")?.getAttribute("data-module")).toBe("fish");
  });

  it("falls back to data-module=shared", () => {
    const { container } = render(<ListCard title="—" />);
    expect(container.querySelector("article")?.getAttribute("data-module")).toBe("shared");
  });

  it("honors forwardRef so callers can scrollIntoView", () => {
    const ref = createRef<HTMLElement>();
    render(<ListCard ref={ref} title="Refs work" />);
    expect(ref.current?.tagName).toBe("ARTICLE");
  });

  it("omits empty optional sections cleanly", () => {
    const { container } = render(<ListCard title="Bare" />);
    expect(container.querySelector(".fwp-list-card__badges")).toBeNull();
    expect(container.querySelector("dl")).toBeNull();
    expect(container.querySelector(".fwp-list-card__chips")).toBeNull();
    expect(container.querySelector(".fwp-list-card__actions")).toBeNull();
  });
});
