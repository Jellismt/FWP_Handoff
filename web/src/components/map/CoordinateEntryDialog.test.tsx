/**
 * @file CoordinateEntryDialog.test.tsx
 * @module engage-mt/map
 * @description Unit tests for the keyboard/SR non-canvas coordinate-entry dialog
 *              (the a11y equivalent of the draw/measure tools). The field-tools
 *              store, toast, and focus-trap hook are mocked at the import seam so
 *              the tests drive real behavior: closed → renders null; the vertex
 *              rows validate against the Montana extent (out-of-range → aria-
 *              invalid + row error, save disabled); a valid polygon dispatches
 *              addShape with the parsed (lon,lat) vertices + chosen color and
 *              toasts; a valid distance dispatches addMeasurement; the min-vertex
 *              gate blocks submit; empty rows are forgiven; close fires onClose.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-03
 * @updated 2026-07-03
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";

const spies = vi.hoisted(() => ({
  addShape: vi.fn(),
  addMeasurement: vi.fn(),
  show: vi.fn(),
}));

vi.mock("@/hooks/useFocusTrap", () => ({ useFocusTrap: vi.fn() }));
vi.mock("@/hooks/useToast", () => ({ useToast: () => ({ show: spies.show }) }));
vi.mock("@/store/field/fieldToolsStore", () => ({
  useFieldToolsStore: (sel: (s: unknown) => unknown) =>
    sel({ addShape: spies.addShape, addMeasurement: spies.addMeasurement }),
}));

import { CoordinateEntryDialog } from "./CoordinateEntryDialog";

/** Type a lat/lon pair into the Nth (0-based) vertex row. */
const fillRow = (index: number, lat: string, lon: string) => {
  const rows = screen.getAllByRole("listitem");
  const row = rows[index];
  fireEvent.change(within(row).getByPlaceholderText("46.6"), { target: { value: lat } });
  fireEvent.change(within(row).getByPlaceholderText("-111.8"), { target: { value: lon } });
};

beforeEach(() => vi.clearAllMocks());

describe("CoordinateEntryDialog — visibility", () => {
  it("renders null when closed", () => {
    const { container } = render(<CoordinateEntryDialog open={false} onClose={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders the dialog when open", () => {
    render(<CoordinateEntryDialog open onClose={vi.fn()} />);
    expect(screen.getByText("Enter coordinates manually")).toBeTruthy();
  });
});

describe("CoordinateEntryDialog — validation", () => {
  it("flags an out-of-Montana latitude with a row error and keeps save disabled", () => {
    render(<CoordinateEntryDialog open initialOperation="distance" onClose={vi.fn()} />);
    fillRow(0, "10", "-111"); // lat 10 is south of Montana (< 43.5)
    expect(screen.getByText(/Lat must be a number between/)).toBeTruthy();
    const save = screen.getByRole("button", { name: /Save measurement/ }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
  });

  it("forgives a fully-empty row (not treated as an error)", () => {
    render(<CoordinateEntryDialog open initialOperation="distance" onClose={vi.fn()} />);
    // Two empty rows by default — no error text, just the min-vertex prompt.
    expect(screen.queryByText(/must be a number/)).toBeNull();
    expect(screen.getByText(/Enter at least 2 valid vertices/)).toBeTruthy();
  });

  it("shows the computed length summary once a valid distance is entered", () => {
    render(<CoordinateEntryDialog open initialOperation="distance" onClose={vi.fn()} />);
    fillRow(0, "46.0", "-111.0");
    fillRow(1, "47.0", "-111.0");
    expect(screen.getByText(/Length: .* mi/)).toBeTruthy();
  });
});

describe("CoordinateEntryDialog — submit dispatch", () => {
  it("dispatches addMeasurement for a valid distance and toasts + closes", () => {
    const onClose = vi.fn();
    render(<CoordinateEntryDialog open initialOperation="distance" onClose={onClose} />);
    fillRow(0, "46.0", "-111.0");
    fillRow(1, "47.0", "-111.0");
    fireEvent.click(screen.getByRole("button", { name: /Save measurement/ }));

    expect(spies.addMeasurement).toHaveBeenCalledTimes(1);
    const m = spies.addMeasurement.mock.calls[0][0];
    expect(m.kind).toBe("distance");
    // vertices stored as [lon, lat]
    expect(m.vertices).toEqual([
      [-111, 46],
      [-111, 47],
    ]);
    expect(spies.show).toHaveBeenCalledWith(expect.objectContaining({ kind: "success" }));
    expect(onClose).toHaveBeenCalled();
    expect(spies.addShape).not.toHaveBeenCalled();
  });

  it("dispatches addShape with (lon,lat) vertices for a valid polygon", () => {
    render(<CoordinateEntryDialog open initialOperation="polygon" onClose={vi.fn()} />);
    // polygon needs 3 vertices — add one more row.
    fireEvent.click(screen.getByRole("button", { name: /Add vertex/ }));
    fillRow(0, "46.0", "-111.0");
    fillRow(1, "47.0", "-111.0");
    fillRow(2, "46.5", "-110.0");
    fireEvent.click(screen.getByRole("button", { name: /Save shape/ }));

    expect(spies.addShape).toHaveBeenCalledTimes(1);
    const s = spies.addShape.mock.calls[0][0];
    expect(s.shape).toBe("polygon");
    expect(s.vertices).toHaveLength(3);
    expect(s.vertices[0]).toEqual([-111, 46]);
  });

  it("keeps save disabled below the minimum vertex count (polygon needs 3)", () => {
    render(<CoordinateEntryDialog open initialOperation="polygon" onClose={vi.fn()} />);
    fillRow(0, "46.0", "-111.0");
    fillRow(1, "47.0", "-111.0");
    const save = screen.getByRole("button", { name: /Save shape/ }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
  });
});

describe("CoordinateEntryDialog — dismissal", () => {
  it("calls onClose from the close button", () => {
    const onClose = vi.fn();
    render(<CoordinateEntryDialog open onClose={onClose} />);
    fireEvent.click(screen.getByLabelText("Close coordinate entry"));
    expect(onClose).toHaveBeenCalled();
  });
});
