/**
 * @file TrackSaveSheet.test.tsx
 * @module engage-mt/field
 * @description The shared stop→save flow (`useTrackSave` +
 *              `TrackSaveSheet`) that both the Field-Tools panel and the
 *              on-map tracker HUD drive. Verifies: a stop with captured
 *              points opens the save sheet; Save persists a CapturedRoute
 *              and returns the recorder to idle; Discard drops the buffer;
 *              a stop with zero points bails silently (no sheet, no route).
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-01
 * @updated 2026-07-03
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { useTrackSave } from "@/hooks/useTrackSave";
import { TrackSaveSheet } from "@/components/field/TrackSaveSheet";
import { useTrackRecorderStore } from "@/services/field/trackRecorder";
import { useFieldToolsStore } from "@/store/field/fieldToolsStore";

const Harness = (): JSX.Element => {
  const save = useTrackSave();
  return (
    <>
      <button type="button" onClick={save.requestStop}>
        request-stop
      </button>
      <TrackSaveSheet save={save} />
    </>
  );
};

/** Seed the recorder as if a recording with `points` samples is active. */
const seedRecording = (points: number): void => {
  const path = Array.from({ length: points }, (_, i) => [-111, 46 + i * 0.001] as [number, number]);
  useTrackRecorderStore.setState({
    status: "recording",
    path,
    elevationFt: path.map(() => Number.NaN),
    distanceMeters: 100 * points,
    gainFt: 0,
    startedAt: new Date().toISOString(),
    durationSeconds: 60,
    _accumulatedSeconds: 60,
    _legStartMs: null,
    _watchHandle: null,
  });
};

describe("useTrackSave + TrackSaveSheet", () => {
  beforeEach(() => {
    useTrackRecorderStore.getState().discard();
    useFieldToolsStore.setState({ waypoints: [], routes: [], shapes: [], measurements: [] });
  });

  it("opens the save sheet when stopping a track with captured points", () => {
    seedRecording(3);
    render(<Harness />);
    fireEvent.click(screen.getByText("request-stop"));

    expect(screen.getByRole("dialog", { name: /save this track/i })).toBeInTheDocument();
  });

  it("Save persists a CapturedRoute and returns the recorder to idle", () => {
    seedRecording(3);
    render(<Harness />);
    fireEvent.click(screen.getByText("request-stop"));

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Morning walk" } });
    fireEvent.click(screen.getByRole("button", { name: "Save track" }));

    const routes = useFieldToolsStore.getState().routes;
    expect(routes).toHaveLength(1);
    expect(routes[0].name).toBe("Morning walk");
    expect(routes[0].path).toHaveLength(3);
    expect(useTrackRecorderStore.getState().status).toBe("idle");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("Discard drops the track without saving", () => {
    seedRecording(3);
    render(<Harness />);
    fireEvent.click(screen.getByText("request-stop"));
    fireEvent.click(screen.getByRole("button", { name: "Discard" }));

    expect(useFieldToolsStore.getState().routes).toHaveLength(0);
    expect(useTrackRecorderStore.getState().status).toBe("idle");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("stopping with zero captured points bails silently — no sheet, no route", () => {
    seedRecording(0);
    render(<Harness />);
    fireEvent.click(screen.getByText("request-stop"));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(useFieldToolsStore.getState().routes).toHaveLength(0);
    expect(useTrackRecorderStore.getState().status).toBe("idle");
  });
});
