/**
 * @file TrackRecorderPanel.tsx
 * @module engage-mt/field
 * @description Field-tools track-recording panel. Drops into
 *              FieldToolsPage as the new top section above the tabs;
 *              also embeddable on the MapPage as a floating control
 *              (future). Surfaces start / pause / resume / stop with
 *              live distance + duration + sample count.
 *
 *              Recorder state lives in `useTrackRecorderStore`; the
 *              actual `<CapturedRoute>` lands in `fieldToolsStore` at
 *              stop time. Stop opens an inline "Name your track" form
 *              so the user can label it before save; cancel discards
 *              the buffer.
 *
 *              Accessibility: every control announces its function via
 *              `aria-label`. The live duration + distance display
 *              carries `aria-live="polite"` so screen readers can pick
 *              up the running totals without flooding them.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-02
 * @updated 2026-07-01
 * @version 1.1.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { Pause, Play, Square, Trash2 } from "lucide-react";
import {
  useTrackRecorderStore,
  formatDistanceMi,
  formatDuration,
} from "@/services/field/trackRecorder";
import { useTrackSave } from "@/hooks/useTrackSave";
import { TrackSaveSheet } from "./TrackSaveSheet";
import { impact } from "@/services/mobile/haptics";
import "./TrackRecorderPanel.css";

export const TrackRecorderPanel = (): JSX.Element => {
  const status = useTrackRecorderStore((s) => s.status);
  const distanceMeters = useTrackRecorderStore((s) => s.distanceMeters);
  const gainFt = useTrackRecorderStore((s) => s.gainFt);
  const durationSeconds = useTrackRecorderStore((s) => s.durationSeconds);
  const pointCount = useTrackRecorderStore((s) => s.path.length);
  const gpsError = useTrackRecorderStore((s) => s.gpsError);
  const start = useTrackRecorderStore((s) => s.start);
  const pause = useTrackRecorderStore((s) => s.pause);
  const resume = useTrackRecorderStore((s) => s.resume);

  // Stop / save / discard now live in the shared
  // useTrackSave hook so this panel and the on-map tracker HUD drive an
  // identical save flow.
  const save = useTrackSave();

  const handleStart = (): void => {
    void impact("medium");
    start();
  };

  const handlePause = (): void => {
    void impact("light");
    pause();
  };

  const handleResume = (): void => {
    void impact("light");
    resume();
  };

  const statusLabel = status === "idle" ? "Ready" : status === "recording" ? "Recording" : "Paused";

  return (
    <section
      className={`track-recorder track-recorder--${status}`}
      aria-labelledby="track-recorder-heading"
    >
      <header className="track-recorder__head">
        <h2 id="track-recorder-heading" className="track-recorder__heading">
          Track recorder
        </h2>
        <span
          className={`track-recorder__status track-recorder__status--${status}`}
          aria-live="polite"
        >
          {statusLabel}
        </span>
      </header>

      {gpsError && (
        <p className="track-recorder__error" role="alert">
          <strong>GPS:</strong> {gpsError}
        </p>
      )}
      {status === "idle" && (
        <p className="track-recorder__note">
          Recording runs while Engage MT is open and keeps the screen on. Locking the phone or
          switching apps pauses it; when you come back the track continues as a new segment.
        </p>
      )}

      {/* Stats update on every GPS sample (every 1–3 s).
          aria-live="polite" on the grid would flood screen readers
          with hundreds of announcements per recording session. The
          status chip above carries the SR cue; sighted users read the
          live numbers off the visible grid. */}
      <dl className="track-recorder__stats">
        <div>
          <dt>Distance</dt>
          <dd>{formatDistanceMi(distanceMeters)}</dd>
        </div>
        <div>
          <dt>Duration</dt>
          <dd>{formatDuration(durationSeconds)}</dd>
        </div>
        <div>
          <dt>Gain</dt>
          <dd>{gainFt.toLocaleString(undefined, { maximumFractionDigits: 0 })} ft</dd>
        </div>
        <div>
          <dt>Points</dt>
          <dd>{pointCount}</dd>
        </div>
      </dl>

      <div className="track-recorder__controls">
        {status === "idle" && (
          <button
            type="button"
            className="fwp-pill-button fwp-pill-button--primary"
            onClick={handleStart}
            aria-label="Start recording a track"
          >
            <Play size={14} strokeWidth={2.25} aria-hidden />
            <span className="fwp-pill-button__label">Start track</span>
          </button>
        )}
        {status === "recording" && (
          <>
            <button
              type="button"
              className="fwp-pill-button fwp-pill-button--sm"
              onClick={handlePause}
              aria-label="Pause the active track"
            >
              <Pause size={14} strokeWidth={2.25} aria-hidden />
              <span className="fwp-pill-button__label">Pause</span>
            </button>
            <button
              type="button"
              className="fwp-pill-button fwp-pill-button--primary fwp-pill-button--sm"
              onClick={save.requestStop}
              aria-label="Stop recording and save the track"
            >
              <Square size={14} strokeWidth={2.25} aria-hidden />
              <span className="fwp-pill-button__label">Stop &amp; save</span>
            </button>
          </>
        )}
        {status === "paused" && (
          <>
            <button
              type="button"
              className="fwp-pill-button fwp-pill-button--primary fwp-pill-button--sm"
              onClick={handleResume}
              aria-label="Resume the paused track"
            >
              <Play size={14} strokeWidth={2.25} aria-hidden />
              <span className="fwp-pill-button__label">Resume</span>
            </button>
            <button
              type="button"
              className="fwp-pill-button fwp-pill-button--sm"
              onClick={save.requestStop}
              aria-label="Stop the paused track and save"
            >
              <Square size={14} strokeWidth={2.25} aria-hidden />
              <span className="fwp-pill-button__label">Stop &amp; save</span>
            </button>
            <button
              type="button"
              className="fwp-pill-button fwp-pill-button--sm"
              onClick={save.confirmDiscard}
              aria-label="Discard the paused track without saving"
            >
              <Trash2 size={14} strokeWidth={2.25} aria-hidden />
              <span className="fwp-pill-button__label">Discard</span>
            </button>
          </>
        )}
      </div>

      <TrackSaveSheet save={save} />

      <p className="track-recorder__hint">
        GPS samples stay on this device. The track is only saved when you tap Stop &amp; save.
      </p>
    </section>
  );
};
