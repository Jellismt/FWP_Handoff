/**
 * @file PhotoStrip.tsx
 * @module engage-mt/field
 * @description Horizontal photo strip for waypoint editors.
 *              Renders each `WaypointPhoto` as a 96px-square thumbnail
 *              with an inline remove ("×") action; a trailing "+" tile
 *              kicks off `cameraService.capturePhoto()` (native camera on
 *              Capacitor; file-picker fallback on web). Per
 *              [docs/rules/mobile.md](../../../docs/rules/mobile.md)
 *              the capture path is platform-guarded; on the web path the
 *              user gets the OS file picker with `accept="image/*"`.
 *
 * Will swap the inline thumbs for a swipeable
 *              lightbox + thumbnail-from-full-res worker pass; the strip
 *              keeps the same data shape so the upgrade is renderer-only.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-09
 * @updated 2026-07-03
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { useCallback, useState } from "react";
import { ImagePlus, X } from "lucide-react";
import { capturePhoto, capturePhotoViaFilePicker } from "@/services/mobile/cameraService";
import { isCapacitor } from "@/utils/capacitor";
import { createLogger } from "@/utils/logger";
import type { WaypointPhoto } from "@/store/field/fieldToolsStore";
import { PhotoGallery } from "./PhotoGallery";
import "./PhotoStrip.css";

const log = createLogger("photo-strip");

interface Props {
  photos: readonly WaypointPhoto[];
  /** Called with the captured photo's data-URI (web) or file URI (native). */
  onAdd: (uri: string) => void;
  onRemove: (photoId: string) => void;
  /** When true, suppresses the trailing "+" tile (read-only display). */
  readOnly?: boolean;
  /** Optional caption passed to the lightbox (usually the waypoint name). */
  caption?: string;
}

export const PhotoStrip = ({
  photos,
  onAdd,
  onRemove,
  readOnly = false,
  caption,
}: Props): JSX.Element => {
  const [busy, setBusy] = useState(false);
  const [galleryIdx, setGalleryIdx] = useState<number | null>(null);

  const onCapture = useCallback(async (): Promise<void> => {
    setBusy(true);
    try {
      const uri = isCapacitor() ? await capturePhoto() : await capturePhotoViaFilePicker();
      if (uri) onAdd(uri);
    } catch (err) {
      log.warn("photo capture failed", { error: err instanceof Error ? err.message : err });
    } finally {
      setBusy(false);
    }
  }, [onAdd]);

  return (
    <>
      <ul className="wp-photo-strip" aria-label="Photos">
        {photos.map((p, idx) => (
          <li key={p.id} className="wp-photo-strip__item">
            <button
              type="button"
              className="wp-photo-strip__open"
              aria-label={`Open photo ${idx + 1} of ${photos.length}`}
              onClick={() => setGalleryIdx(idx)}
            >
              {/* eslint-disable-next-line jsx-a11y/img-redundant-alt -- photo IS the content */}
              <img src={p.thumbUri ?? p.uri} alt={`Captured photo from ${p.capturedAt}`} />
            </button>
            {!readOnly && (
              <button
                type="button"
                className="wp-photo-strip__remove"
                aria-label="Remove photo"
                onClick={() => onRemove(p.id)}
              >
                <X size={14} aria-hidden />
              </button>
            )}
          </li>
        ))}
        {!readOnly && (
          <li className="wp-photo-strip__item wp-photo-strip__item--add">
            <button
              type="button"
              className="wp-photo-strip__add"
              aria-label="Add a photo"
              onClick={onCapture}
              disabled={busy}
            >
              <ImagePlus size={20} aria-hidden />
              <span>{busy ? "Loading…" : "Add"}</span>
            </button>
          </li>
        )}
      </ul>
      {galleryIdx !== null && (
        <PhotoGallery
          photos={photos}
          initialIndex={galleryIdx}
          caption={caption}
          onClose={() => setGalleryIdx(null)}
        />
      )}
    </>
  );
};
