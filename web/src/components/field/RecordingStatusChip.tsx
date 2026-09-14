/**
 * @file RecordingStatusChip.tsx
 * @module engage-mt/field
 * @description Floating tracker HUD rendered over
 *              the map canvas whenever a track recording is in progress
 *              (status === "recording" or "paused"). Surfaces live
 *              distance / duration / gain AND the recording controls
 *              (Pause / Resume, Stop & Save) so the user never has to
 *              leave the map to run a recording — the consumer-app field
 *              flow. Stop opens the shared "Save this track" sheet in
 *              place; a small link still jumps to Field Tools for the
 *              full list.
 *
 *              Renders nothing when the recorder is idle — the parent
 *              MapPage overlay collapses to zero height in that case.
 *
 *              Accessibility: the card is a labelled region; the stat
 *              grid deliberately omits aria-live (it updates every GPS
 *              sample and would flood screen readers) — the status label
 *              carries the cue. The save sheet manages its own focus.
 *
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-03
 * @updated 2026-07-14
 * @version 2.0.1
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Pause, Play, Radio, Square } from "lucide-react";
import {
  useTrackRecorderStore,
  formatDistanceMi,
  formatDuration,
} from "@/services/field/trackRecorder";
import { useTrackSave } from "@/hooks/useTrackSave";
import { impact } from "@/services/mobile/haptics";
import { TrackSaveSheet } from "./TrackSaveSheet";
import "./RecordingStatusChip.css";

export const RecordingStatusChip = (): JSX.Element | null => {
  const status = useTrackRecorderStore((s) => s.status);
  const distanceMeters = useTrackRecorderStore((s) => s.distanceMeters);
  const gainFt = useTrackRecorderStore((s) => s.gainFt);
  const baseDuration = useTrackRecorderStore((s) => s.durationSeconds);
  const startedAt = useTrackRecorderStore((s) => s.startedAt);
  const gpsError = useTrackRecorderStore((s) => s.gpsError);
  const pause = useTrackRecorderStore((s) => s.pause);
  const resume = useTrackRecorderStore((s) => s.resume);

  const save = useTrackSave();

  // Tick a local 1-Hz clock while recording so the HUD's
  // duration updates live. The base duration in the store updates only
  // on pause / resume; we add the wall-clock delta since the last leg
  // started.
  const [legSeconds, setLegSeconds] = useState(0);
  useEffect(() => {
    if (status !== "recording" || !startedAt) {
      setLegSeconds(0);
      return;
    }
    const startMs = new Date(startedAt).getTime();
    const tick = (): void => {
      setLegSeconds(Math.max(0, (Date.now() - startMs) / 1000) - baseDuration);
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [status, startedAt, baseDuration]);

  if (status === "idle") return null;

  const recording = status === "recording";
  const totalSeconds = recording ? baseDuration + Math.max(0, legSeconds) : baseDuration;

  const handlePause = (): void => {
    void impact("light");
    pause();
  };
  const handleResume = (): void => {
    void impact("light");
    resume();
  };

  return (
    <section
      className={`track-hud track-hud--${status}`}
      aria-label={recording ? "Track recording in progress" : "Track recording paused"}
    >
      <div className="track-hud__head">
        <span className="track-hud__dot" aria-hidden />
        {recording ? (
          <Radio size={14} strokeWidth={2.5} aria-hidden />
        ) : (
          <Pause size={14} strokeWidth={2.5} aria-hidden />
        )}
        <span className="track-hud__label">{recording ? "REC" : "Paused"}</span>
      </div>

      <dl className="track-hud__stats">
        <div>
          <dt>Dist</dt>
          <dd>{formatDistanceMi(distanceMeters)}</dd>
        </div>
        <div>
          <dt>Time</dt>
          <dd>{formatDuration(totalSeconds)}</dd>
        </div>
        <div>
          <dt>Gain</dt>
          <dd>{gainFt.toLocaleString(undefined, { maximumFractionDigits: 0 })} ft</dd>
        </div>
      </dl>

      {gpsError && (
        <p className="track-hud__error" role="alert">
          <strong>GPS:</strong> {gpsError}
        </p>
      )}

      {!save.saveOpen && (
        <div className="track-hud__controls">
          {recording ? (
            <button
              type="button"
              className="fwp-pill-button fwp-pill-button--sm"
              onClick={handlePause}
              aria-label="Pause the active track"
            >
              <Pause size={14} strokeWidth={2.25} aria-hidden />
              <span className="fwp-pill-button__label">Pause</span>
            </button>
          ) : (
            <button
              type="button"
              className="fwp-pill-button fwp-pill-button--primary fwp-pill-button--sm"
              onClick={handleResume}
              aria-label="Resume the paused track"
            >
              <Play size={14} strokeWidth={2.25} aria-hidden />
              <span className="fwp-pill-button__label">Resume</span>
            </button>
          )}
          <button
            type="button"
            className="fwp-pill-button fwp-pill-button--primary fwp-pill-button--sm"
            onClick={save.requestStop}
            aria-label="Stop recording and save the track"
          >
            <Square size={14} strokeWidth={2.25} aria-hidden />
            <span className="fwp-pill-button__label">Stop &amp; save</span>
          </button>
        </div>
      )}

      <TrackSaveSheet save={save} />

      {!save.saveOpen && (
        <Link to="/manage/field-tools" className="track-hud__link">
          Open in Field Tools
        </Link>
      )}
    </section>
  );
};
