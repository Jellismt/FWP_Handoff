/**
 * @file useTrackSave.ts
 * @module engage-mt/hooks
 * @description Shared "stop & save the active track" flow. Owns the
 *              save-sheet open state, the name/notes draft, and the
 *              stop / save / discard actions against
 *              `useTrackRecorderStore`. Extracted so the Field-Tools
 *              recorder panel AND the on-map tracker HUD drive an
 *              identical save experience from one source of truth
 *              (no duplicated stop/save/discard logic or copy).
 *
 *              Tapping Stop with zero captured points discards silently
 *              (nothing worth naming); otherwise it seeds a dated
 *              default name and opens the sheet. Save persists the
 *              `CapturedRoute` via the recorder's `stop()`; discard
 *              drops the buffer. Haptics fire on the terminal actions.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-01
 * @updated 2026-07-01
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { useEffect, useRef, useState } from "react";
import { useTrackRecorderStore } from "@/services/field/trackRecorder";
import { impact } from "@/services/mobile/haptics";

export interface TrackSave {
  /** Whether the "Save this track" sheet is currently open. */
  saveOpen: boolean;
  /** Draft track name (seeded with a dated default when the sheet opens). */
  trackName: string;
  /** Draft optional notes. */
  trackNotes: string;
  setTrackName: (value: string) => void;
  setTrackNotes: (value: string) => void;
  /** Focus target — the name input, focused when the sheet opens. */
  nameInputRef: React.RefObject<HTMLInputElement | null>;
  /** True when the draft name is non-empty (Save enabled). */
  canSave: boolean;
  /**
   * Request a stop. With zero captured points, discards immediately.
   * Otherwise seeds a default name + opens the save sheet.
   */
  requestStop: () => void;
  /** Persist the track with the current name/notes, then close the sheet. */
  confirmSave: () => void;
  /** Drop the buffered track without saving, then close the sheet. */
  confirmDiscard: () => void;
}

const defaultTrackName = (): string =>
  `Track · ${new Date().toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;

export const useTrackSave = (): TrackSave => {
  const pointCount = useTrackRecorderStore((s) => s.path.length);
  const stop = useTrackRecorderStore((s) => s.stop);
  const discard = useTrackRecorderStore((s) => s.discard);

  const [saveOpen, setSaveOpen] = useState(false);
  const [trackName, setTrackName] = useState("");
  const [trackNotes, setTrackNotes] = useState("");
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Move keyboard focus to the name input when the sheet opens. Runs only
  // on the open transition, never on re-renders while open.
  useEffect(() => {
    if (saveOpen) nameInputRef.current?.focus();
  }, [saveOpen]);

  const requestStop = (): void => {
    if (pointCount === 0) {
      // Nothing captured worth naming — just bail out of the recording.
      discard();
      return;
    }
    setTrackName(defaultTrackName());
    setTrackNotes("");
    setSaveOpen(true);
  };

  const confirmSave = (): void => {
    void impact("heavy");
    stop(trackName, trackNotes);
    setSaveOpen(false);
    setTrackName("");
    setTrackNotes("");
  };

  const confirmDiscard = (): void => {
    void impact("medium");
    discard();
    setSaveOpen(false);
    setTrackName("");
    setTrackNotes("");
  };

  return {
    saveOpen,
    trackName,
    trackNotes,
    setTrackName,
    setTrackNotes,
    nameInputRef,
    canSave: trackName.trim().length > 0,
    requestStop,
    confirmSave,
    confirmDiscard,
  };
};
