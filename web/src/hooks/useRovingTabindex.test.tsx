/**
 * @file useRovingTabindex.test.tsx
 * @module engage-mt/hooks
 * @description One Tab stop, arrow/Home/End movement, focus tracking, and the
 *              portal guard of the roving-tabindex hook.
 * @author Jamie Ellis / Engage MT
 * @created 2026-09-06
 * @updated 2026-09-06
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { useRef } from "react";
import { createPortal } from "react-dom";
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { useRovingTabindex } from "./useRovingTabindex";

const Toolbar = ({ portal = false }: { portal?: boolean }): JSX.Element => {
  const ref = useRef<HTMLDivElement>(null);
  const roving = useRovingTabindex(ref, { orientation: "vertical" });
  return (
    <div ref={ref} role="toolbar" aria-label="Tools" {...roving}>
      <button type="button">One</button>
      <button type="button">Two</button>
      <button type="button">Three</button>
      {portal &&
        createPortal(
          <div role="menu">
            <button type="button">Portaled</button>
          </div>,
          document.body,
        )}
    </div>
  );
};

const stops = (): string[] =>
  screen
    .getAllByRole("button")
    .filter((b) => b.tabIndex === 0)
    .map((b) => b.textContent ?? "");

describe("useRovingTabindex", () => {
  it("makes the first item the only Tab stop", () => {
    render(<Toolbar />);
    expect(stops()).toEqual(["One"]);
  });

  it("moves focus with arrows, wraps, and honours Home/End", () => {
    render(<Toolbar />);
    const [one, two, three] = screen.getAllByRole("button");
    one.focus();
    fireEvent.keyDown(one, { key: "ArrowDown" });
    expect(document.activeElement).toBe(two);
    expect(stops()).toEqual(["Two"]);
    fireEvent.keyDown(two, { key: "ArrowUp" });
    expect(document.activeElement).toBe(one);
    fireEvent.keyDown(one, { key: "ArrowUp" });
    expect(document.activeElement).toBe(three);
    fireEvent.keyDown(three, { key: "Home" });
    expect(document.activeElement).toBe(one);
    fireEvent.keyDown(one, { key: "End" });
    expect(document.activeElement).toBe(three);
  });

  it("horizontal arrows are ignored in vertical orientation", () => {
    render(<Toolbar />);
    const [one] = screen.getAllByRole("button");
    one.focus();
    fireEvent.keyDown(one, { key: "ArrowRight" });
    expect(document.activeElement).toBe(one);
  });

  it("a focused item becomes the next Tab stop", () => {
    render(<Toolbar />);
    const [, , three] = screen.getAllByRole("button");
    fireEvent.focus(three);
    expect(stops()).toEqual(["Three"]);
  });

  it("leaves portaled descendants out of the roving set", () => {
    render(<Toolbar portal />);
    const portaled = screen.getByRole("button", { name: "Portaled" });
    expect(portaled.tabIndex).toBe(0);
    expect(stops()).toEqual(["One", "Portaled"]);
    portaled.focus();
    fireEvent.keyDown(portaled, { key: "ArrowDown" });
    expect(document.activeElement).toBe(portaled);
  });
});
