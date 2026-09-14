/**
 * @file TrackSaveSheet.tsx
 * @module engage-mt/field
 * @description Shared "Save this track" form. Renders the name + notes
 *              fields and the Discard / Save actions for a stopped
 *              recording, driven by the `useTrackSave` hook. Used by
 *              both the Field-Tools `TrackRecorderPanel` and the on-map
 *              tracker HUD so the save experience is identical in both
 *              places.
 *
 *              Accessibility: rendered as a labelled modal dialog. The
 *              name input receives focus on open (managed by the hook);
 *              Save is disabled until the name is non-empty.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-01
 * @updated 2026-07-01
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { useId } from "react";
import type { TrackSave } from "@/hooks/useTrackSave";
import "./TrackSaveSheet.css";

interface TrackSaveSheetProps {
  save: TrackSave;
}

export const TrackSaveSheet = ({ save }: TrackSaveSheetProps): JSX.Element | null => {
  // useId keeps the heading association unique even if a panel + HUD ever
  // mount together — no hardcoded duplicate ids.
  const headingId = useId();

  if (!save.saveOpen) return null;

  return (
    <div className="track-save-sheet" role="dialog" aria-modal="true" aria-labelledby={headingId}>
      <h3 id={headingId} className="track-save-sheet__heading">
        Save this track
      </h3>
      <label className="track-save-sheet__field">
        <span>Name</span>
        <input
          ref={save.nameInputRef}
          type="text"
          value={save.trackName}
          onChange={(e) => save.setTrackName(e.target.value)}
        />
      </label>
      <label className="track-save-sheet__field">
        <span>Notes (optional)</span>
        <textarea
          rows={2}
          value={save.trackNotes}
          onChange={(e) => save.setTrackNotes(e.target.value)}
          placeholder="Weather, party, wind direction…"
        />
      </label>
      <div className="track-save-sheet__actions">
        <button
          type="button"
          className="fwp-pill-button fwp-pill-button--sm"
          onClick={save.confirmDiscard}
        >
          Discard
        </button>
        <button
          type="button"
          className="fwp-pill-button fwp-pill-button--primary fwp-pill-button--sm"
          onClick={save.confirmSave}
          disabled={!save.canSave}
        >
          Save track
        </button>
      </div>
    </div>
  );
};
