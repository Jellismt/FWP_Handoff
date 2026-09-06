/**
 * @file ImportDialog.test.tsx
 * @module engage-mt/field
 * @description Unit tests for the GPX/KML ImportDialog. The parser + commit +
 *              toast seams are mocked so the tests focus on the dialog's own
 *              behavior: the closed null render, the pre-parse picker copy vs
 *              the parsed preview, the initialResult (shared-file) seed, the
 *              extension/content parser routing (.kml vs .gpx vs sniff), the
 *              file-read error toast + reset, the singular/plural count copy,
 *              the active-trip hint, the warnings <details>, the commit path
 *              (commitGpxImport call + success toast + onClose), and the
 *              close/backdrop handlers.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-01
 * @updated 2026-07-03
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, waitFor } from "@testing-library/react";
import type { GpxImportResult } from "@/services/field/gpxImport";

const h = vi.hoisted(() => ({
  parseGpx: vi.fn(),
  parseKml: vi.fn(),
  commitGpxImport: vi.fn(),
  show: vi.fn(),
}));

vi.mock("@/services/field/gpxImport", () => ({
  parseGpx: h.parseGpx,
  commitGpxImport: h.commitGpxImport,
}));
vi.mock("@/services/field/kmlImport", () => ({ parseKml: h.parseKml }));
vi.mock("@/hooks/useToast", () => ({ useToast: () => ({ show: h.show, dismiss: vi.fn() }) }));

import { ImportDialog } from "./ImportDialog";
import { useFieldToolsStore } from "@/store/field/fieldToolsStore";

const result = (over?: Partial<GpxImportResult>): GpxImportResult => ({
  waypoints: [],
  routes: [],
  warnings: [],
  ...over,
});

/** A File whose `.text()` resolves synchronously to the given content. */
const fileWith = (name: string, text: string, resolve = true): File => {
  const f = new File([text], name, { type: "text/xml" });
  Object.defineProperty(f, "text", {
    value: () => (resolve ? Promise.resolve(text) : Promise.reject(new Error("read fail"))),
  });
  return f;
};

const uploadFile = (container: HTMLElement, file: File): void => {
  const input = container.querySelector<HTMLInputElement>('input[type="file"]')!;
  fireEvent.change(input, { target: { files: [file] } });
};

beforeEach(() => {
  h.parseGpx.mockReset();
  h.parseKml.mockReset();
  h.commitGpxImport.mockReset().mockReturnValue({ addedWaypoints: 0, addedRoutes: 0 });
  h.show.mockReset();
  useFieldToolsStore.setState({ activeTripId: null });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ImportDialog — open/closed", () => {
  it("renders nothing when closed", () => {
    const { container } = render(<ImportDialog open={false} onClose={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders the file picker copy before a file is parsed", () => {
    const { getByText, container } = render(<ImportDialog open onClose={vi.fn()} />);
    expect(getByText(/Import GPX \/ KML/)).toBeTruthy();
    expect(getByText(/Choose a .gpx or .kml file/)).toBeTruthy();
    expect(container.querySelector(".import-dialog__preview")).toBeNull();
  });
});

describe("ImportDialog — parser routing", () => {
  it("routes a .gpx file to parseGpx", async () => {
    h.parseGpx.mockReturnValue(result({ waypoints: [{} as never] }));
    const { container } = render(<ImportDialog open onClose={vi.fn()} />);
    uploadFile(container, fileWith("trip.gpx", "<gpx></gpx>"));
    await waitFor(() => expect(h.parseGpx).toHaveBeenCalledOnce());
    expect(h.parseKml).not.toHaveBeenCalled();
  });

  it("routes a .kml file to parseKml", async () => {
    h.parseKml.mockReturnValue(result());
    const { container } = render(<ImportDialog open onClose={vi.fn()} />);
    uploadFile(container, fileWith("pins.kml", "<kml></kml>"));
    await waitFor(() => expect(h.parseKml).toHaveBeenCalledOnce());
    expect(h.parseGpx).not.toHaveBeenCalled();
  });

  it("sniffs KML content for an extensionless file", async () => {
    h.parseKml.mockReturnValue(result());
    const { container } = render(<ImportDialog open onClose={vi.fn()} />);
    uploadFile(container, fileWith("export", "<kml xmlns='...'></kml>"));
    await waitFor(() => expect(h.parseKml).toHaveBeenCalledOnce());
  });

  it("shows a warning toast and resets when the file read fails", async () => {
    const { container } = render(<ImportDialog open onClose={vi.fn()} />);
    uploadFile(container, fileWith("bad.gpx", "junk", false));
    await waitFor(() =>
      expect(h.show).toHaveBeenCalledWith(
        expect.objectContaining({ kind: "warning", title: "Couldn't read file" }),
      ),
    );
    // Back to the picker (no preview) after the reset.
    expect(container.querySelector(".import-dialog__preview")).toBeNull();
  });
});

describe("ImportDialog — preview", () => {
  it("seeds the preview from a pre-parsed initialResult (shared-file open)", () => {
    const initial = result({ waypoints: [{} as never, {} as never], routes: [{} as never] });
    const { container, getByText } = render(
      <ImportDialog open onClose={vi.fn()} initialResult={initial} initialSourceLabel="pins.gpx" />,
    );
    expect(container.querySelector(".import-dialog__preview")).not.toBeNull();
    expect(getByText(/Ready to import/)).toBeTruthy();
    // 2 waypoints (plural), 1 track (singular).
    const counts = container.querySelector(".import-dialog__counts")?.textContent ?? "";
    expect(counts).toMatch(/2\s*waypoints/);
    expect(counts).toMatch(/1\s*track(?!s)/);
  });

  it("shows the active-trip hint only when a trip is active", () => {
    useFieldToolsStore.setState({ activeTripId: "trip-1" });
    const initial = result({ waypoints: [{} as never] });
    const { getByText } = render(<ImportDialog open onClose={vi.fn()} initialResult={initial} />);
    expect(getByText(/assigned to the currently-active trip/)).toBeTruthy();
  });

  it("renders a warnings details block with the warning list", () => {
    const initial = result({
      waypoints: [{} as never],
      warnings: ["Dropped an out-of-Montana point", "Missing elevation"],
    });
    const { container, getByText } = render(
      <ImportDialog open onClose={vi.fn()} initialResult={initial} />,
    );
    expect(container.querySelector("details.import-dialog__warnings")).not.toBeNull();
    expect(getByText(/2 warnings/)).toBeTruthy();
    expect(getByText(/out-of-Montana/)).toBeTruthy();
  });
});

describe("ImportDialog — commit + close", () => {
  it("commits the parsed import, toasts success, and closes", () => {
    h.commitGpxImport.mockReturnValue({ addedWaypoints: 3, addedRoutes: 1 });
    useFieldToolsStore.setState({ activeTripId: "trip-9" });
    const onClose = vi.fn();
    const initial = result({ waypoints: [{} as never], routes: [{} as never] });
    const { getByText } = render(<ImportDialog open onClose={onClose} initialResult={initial} />);
    fireEvent.click(getByText(/Import 2 items/));
    expect(h.commitGpxImport).toHaveBeenCalledWith(initial, { tripId: "trip-9" });
    expect(h.show).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "success", title: "Imported" }),
    );
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("closes via the Cancel button and the backdrop", () => {
    const onClose = vi.fn();
    const { getByLabelText, container } = render(<ImportDialog open onClose={onClose} />);
    fireEvent.click(getByLabelText("Close import dialog"));
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.click(container.querySelector(".import-dialog__backdrop")!);
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
