/**
 * @file PhotoGallery.tsx
 * @module engage-mt/field
 * @description Swipeable lightbox for waypoint photos. Opened
 *              by tapping a thumbnail in `PhotoStrip`. Renders full-res
 *              one-at-a-time with previous / next buttons, keyboard
 *              support (← →, Esc), and a Share action that uses the
 *              shared `shareService` so the OS picker can route the photo
 *              to Messages / Mail / etc.
 *
 *              Per [docs/rules/privacy.md](../../../docs/rules/privacy.md)
 *              the photo blob stays on device until the user explicitly
 *              taps Share.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-09
 * @updated 2026-07-03
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Share2, X } from "lucide-react";
import type { WaypointPhoto } from "@/store/field/fieldToolsStore";
import { share } from "@/services/mobile/shareService";
import { createLogger } from "@/utils/logger";
import "./PhotoGallery.css";

const log = createLogger("photo-gallery");

interface Props {
  photos: readonly WaypointPhoto[];
  initialIndex?: number;
  /** Optional caption — usually the waypoint's name. */
  caption?: string;
  onClose: () => void;
}

const fmtDate = (iso: string): string => {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
};

export const PhotoGallery = ({
  photos,
  initialIndex = 0,
  caption,
  onClose,
}: Props): JSX.Element | null => {
  const [idx, setIdx] = useState(Math.max(0, Math.min(initialIndex, photos.length - 1)));

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") setIdx((i) => Math.min(photos.length - 1, i + 1));
      else if (e.key === "ArrowLeft") setIdx((i) => Math.max(0, i - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, photos.length]);

  if (photos.length === 0) return null;
  const current = photos[idx];

  const onShare = async (): Promise<void> => {
    try {
      await share({
        title: caption ?? "Photo",
        text: `Captured ${fmtDate(current.capturedAt)}`,
        url: current.uri,
      });
    } catch (err) {
      log.warn("photo share failed", { error: err instanceof Error ? err.message : err });
    }
  };

  return (
    <div className="photo-gallery" role="dialog" aria-modal="true" aria-label="Photo viewer">
      <div className="photo-gallery__backdrop" onClick={onClose} aria-hidden="true" />
      <div className="photo-gallery__shell">
        <header className="photo-gallery__header">
          <span className="photo-gallery__caption">
            {caption && <strong>{caption}</strong>}
            <span className="photo-gallery__ts">Captured {fmtDate(current.capturedAt)}</span>
            <span className="photo-gallery__pager">
              {idx + 1} / {photos.length}
            </span>
          </span>
          <div className="photo-gallery__header-actions">
            <button
              type="button"
              className="photo-gallery__icon-btn"
              aria-label="Share photo"
              onClick={onShare}
            >
              <Share2 size={18} aria-hidden />
            </button>
            <button
              type="button"
              className="fwp-icon-close"
              aria-label="Close gallery"
              onClick={onClose}
            >
              <X size={18} aria-hidden />
            </button>
          </div>
        </header>
        <figure className="photo-gallery__figure">
          {/* eslint-disable-next-line jsx-a11y/img-redundant-alt -- photo IS the content */}
          <img src={current.uri} alt={`Photo captured ${current.capturedAt}`} />
        </figure>
        <button
          type="button"
          className="photo-gallery__nav photo-gallery__nav--prev"
          aria-label="Previous photo"
          disabled={idx === 0}
          onClick={() => setIdx((i) => Math.max(0, i - 1))}
        >
          <ChevronLeft size={28} aria-hidden />
        </button>
        <button
          type="button"
          className="photo-gallery__nav photo-gallery__nav--next"
          aria-label="Next photo"
          disabled={idx === photos.length - 1}
          onClick={() => setIdx((i) => Math.min(photos.length - 1, i + 1))}
        >
          <ChevronRight size={28} aria-hidden />
        </button>
      </div>
    </div>
  );
};
