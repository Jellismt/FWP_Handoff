/**
 * @file cardPrimitives.test.tsx
 * @module engage-mt/map/featureCards
 * @description Coverage for the popup primitive
 *              library. Exercises every shape the FeatureCard registry
 *              composes from: MetricPill, MetricGrid, KeyValueRow,
 *              Paragraph, ChipRow, HeroValue, MetricCallout, TipBlock,
 *              BadgeRow, ListCard (key/value variant), HeroBlock,
 *              SubtleText, SectionHeading.
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
import { Fish, Thermometer } from "lucide-react";
import {
  MetricPill,
  MetricGrid,
  KeyValueRow,
  Paragraph,
  ChipRow,
  HeroValue,
  MetricCallout,
  TipBlock,
  BadgeRow,
  ListCard,
  SubtleText,
  SectionHeading,
} from "@/components/map/featureCards/core/cardPrimitives";

describe("MetricPill", () => {
  it("renders label + value as dt + dd", () => {
    const { container } = render(<MetricPill label="Flow" value="1,234 cfs" />);
    expect(container.querySelector("dt")?.textContent).toBe("Flow");
    expect(container.querySelector("dd")?.textContent).toBe("1,234 cfs");
  });

  it("applies intent modifier class", () => {
    const { container } = render(<MetricPill label="Flow" value="x" intent="success" />);
    expect(container.querySelector(".metric-pill--success")).toBeTruthy();
  });

  it("renders an icon halo when icon is supplied", () => {
    const { container } = render(<MetricPill label="Temp" value="58 °F" icon={Thermometer} />);
    expect(container.querySelector(".metric-pill--with-icon")).toBeTruthy();
    expect(container.querySelector("svg")).toBeTruthy();
  });

  it("sets data-domain when domain is supplied", () => {
    const { container } = render(<MetricPill label="Flow" value="x" domain="flow" />);
    expect(container.querySelector(".metric-pill")?.getAttribute("data-domain")).toBe("flow");
  });
});

describe("MetricGrid + KeyValueRow + Paragraph + SubtleText + SectionHeading", () => {
  it("MetricGrid wraps children in a dl", () => {
    const { container } = render(
      <MetricGrid>
        <MetricPill label="a" value="b" />
      </MetricGrid>,
    );
    expect(container.querySelector("dl.metric-grid")).toBeTruthy();
  });

  it("KeyValueRow renders label + value side by side", () => {
    render(<KeyValueRow label="County" value="Gallatin" />);
    expect(screen.getByText("County")).toBeTruthy();
    expect(screen.getByText("Gallatin")).toBeTruthy();
  });

  it("Paragraph wraps content in a p.feature-paragraph", () => {
    const { container } = render(<Paragraph>hello</Paragraph>);
    expect(container.querySelector("p.feature-paragraph")?.textContent).toBe("hello");
  });

  it("SubtleText renders a span with subtle styling", () => {
    render(<SubtleText>approx.</SubtleText>);
    expect(screen.getByText("approx.")).toBeTruthy();
  });

  it("SectionHeading renders heading-styled content", () => {
    render(<SectionHeading>Conditions</SectionHeading>);
    expect(screen.getByText("Conditions")).toBeTruthy();
  });
});

describe("ChipRow", () => {
  it("renders items as a role=list with role=listitem children", () => {
    render(<ChipRow items={["Hookups", "ADA", "Pets"]} />);
    expect(screen.getAllByRole("listitem").length).toBe(3);
    expect(screen.getByText("Hookups")).toBeTruthy();
    expect(screen.getByText("ADA")).toBeTruthy();
  });

  it("renders an empty chip row cleanly", () => {
    const { container } = render(<ChipRow items={[]} />);
    expect(container.querySelector(".chip-row")).toBeTruthy();
    expect(container.querySelectorAll("[role='listitem']").length).toBe(0);
  });
});

describe("HeroValue", () => {
  it("renders the headline + caption + unit", () => {
    render(<HeroValue caption="Flow" value="1,234" unit="cfs" />);
    expect(screen.getByText("Flow")).toBeTruthy();
    expect(screen.getByText("1,234")).toBeTruthy();
    expect(screen.getByText("cfs")).toBeTruthy();
  });

  it("renders up/down/flat delta indicators", () => {
    const { rerender, container } = render(
      <HeroValue caption="Flow" value="1" delta={{ label: "+12", direction: "up" }} />,
    );
    expect(container.textContent).toContain("+12");
    expect(container.textContent).toMatch(/▲/);
    rerender(<HeroValue caption="Flow" value="1" delta={{ label: "-3", direction: "down" }} />);
    expect(container.textContent).toMatch(/▼/);
    rerender(<HeroValue caption="Flow" value="1" delta={{ label: "0", direction: "flat" }} />);
    expect(container.textContent).toMatch(/—/);
  });
});

describe("MetricCallout", () => {
  it("renders title + value + optional sub", () => {
    render(<MetricCallout title="Status" value="Open" sub="As of Oct 1" intent="success" />);
    expect(screen.getByText("Status")).toBeTruthy();
    expect(screen.getByText("Open")).toBeTruthy();
    expect(screen.getByText("As of Oct 1")).toBeTruthy();
  });

  it("applies intent modifier", () => {
    const { container } = render(<MetricCallout title="x" value="y" intent="warning" />);
    expect(container.querySelector(".fwp-metric-callout--warning")).toBeTruthy();
  });
});

describe("TipBlock", () => {
  it("renders heading + children in an aside", () => {
    const { container } = render(
      <TipBlock heading="Field tip">Check the water temp first.</TipBlock>,
    );
    expect(container.querySelector("aside.fwp-tip-block")).toBeTruthy();
    expect(screen.getByText("Field tip")).toBeTruthy();
    expect(screen.getByText("Check the water temp first.")).toBeTruthy();
  });

  it("renders without heading when omitted", () => {
    const { container } = render(<TipBlock>Body only.</TipBlock>);
    expect(container.querySelector(".fwp-tip-block__heading")).toBeNull();
  });

  it.each(["tip", "warning", "danger", "info"] as const)("applies %s intent modifier", (intent) => {
    const { container } = render(<TipBlock intent={intent}>x</TipBlock>);
    expect(container.querySelector(`.fwp-tip-block--${intent}`)).toBeTruthy();
  });
});

describe("BadgeRow", () => {
  it("supports plain string items + objects with icon + intent", () => {
    render(
      <BadgeRow
        label="Hatches"
        badges={[
          "Mayfly",
          { label: "Caddis", icon: Fish, intent: "success" },
          { label: "Stonefly" },
        ]}
      />,
    );
    expect(screen.getByText("Hatches")).toBeTruthy();
    expect(screen.getByText("Mayfly")).toBeTruthy();
    expect(screen.getByText("Caddis")).toBeTruthy();
    expect(screen.getByText("Stonefly")).toBeTruthy();
  });

  it("renders without label when omitted", () => {
    const { container } = render(<BadgeRow badges={["a"]} />);
    expect(container.querySelector(".fwp-badge-row__label")).toBeNull();
  });
});

describe("ListCard (key/value variant)", () => {
  it("renders title + rows", () => {
    render(
      <ListCard
        title="Station info"
        rows={[
          { label: "Site number", value: "06054500" },
          { label: "River", value: "Madison" },
        ]}
      />,
    );
    expect(screen.getByText("Station info")).toBeTruthy();
    expect(screen.getByText("Site number")).toBeTruthy();
    expect(screen.getByText("06054500")).toBeTruthy();
    expect(screen.getByText("Madison")).toBeTruthy();
  });

  it("renders without title", () => {
    const { container } = render(<ListCard rows={[{ label: "x", value: "y" }]} />);
    expect(container.querySelector(".fwp-list-card__title")).toBeNull();
  });
});
