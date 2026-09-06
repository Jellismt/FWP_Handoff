/**
 * @file OfflineAoiConfirmSheet.tsx
 * @module engage-mt/map
 * @description Confirmation dialog for an on-map offline AOI selection. Opens
 *              when the user finishes drawing a "Download this area" rectangle
 *              (bbox lands in offlineAoiDraftStore). Lets them set a label,
 *              basemap, and max zoom against a live size estimate + storage-cap
 *              warning, then either download immediately or stage the area for
 *              the Offline Maps page. Queues through the shared offlineAreasStore
 *              so the page + map share one queue.
 *
 *              Modal: focus trapped via `useFocusTrap`, Esc / backdrop / Cancel
 *              clear the draft. Privacy: the bbox stays on-device; nothing is
 *              transmitted until the user starts a tile download.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-30
 * @updated 2026-07-14
 * @version 1.1.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Download, X } from "lucide-react";
import { PillButton } from "@/components/shared/forms/PillButton";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { useToast } from "@/hooks/useToast";
import { isCapacitor } from "@/utils/capacitor";
import { useOfflineAoiDraftStore } from "@/store/field/offlineAoiDraftStore";
import { MAX_AREAS, useOfflineAreasStore } from "@/store/field/offlineAreasStore";
import {
  BASEMAP_TEMPLATES,
  DEFAULT_BASEMAP_KEY,
  DEFAULT_OFFLINE_MAX_ZOOM,
  OFFLINE_AREA_MIN_ZOOM,
  OFFLINE_ATTRIBUTION,
  OFFLINE_MAX_ZOOM,
  type BasemapKey,
} from "@/config/offlineBasemaps";
import {
  estimateAreaBytes,
  formatBytes,
  offlineMaxBytes,
} from "@/services/mobile/offlineTileQuota";
import "./OfflineAoiConfirmSheet.css";

const DEFAULT_LABEL = "My hunt area";
const TOO_BIG_BYTES = 500_000_000;

export const OfflineAoiConfirmSheet = (): JSX.Element | null => {
  const titleId = useId();
  const helpId = useId();
  const cardRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { show } = useToast();

  const bbox = useOfflineAoiDraftStore((s) => s.bbox);
  const clearDraft = useOfflineAoiDraftStore((s) => s.clear);
  const areas = useOfflineAreasStore((s) => s.areas);
  const queueArea = useOfflineAreasStore((s) => s.queueArea);
  const startDownload = useOfflineAreasStore((s) => s.startDownload);

  const [label, setLabel] = useState(DEFAULT_LABEL);
  const [basemap, setBasemap] = useState<BasemapKey>(DEFAULT_BASEMAP_KEY);
  const [maxZoom, setMaxZoom] = useState(DEFAULT_OFFLINE_MAX_ZOOM);

  const open = bbox !== null;

  // Reset the form each time a fresh box is captured.
  useEffect(() => {
    if (bbox) {
      setLabel(DEFAULT_LABEL);
      setBasemap(DEFAULT_BASEMAP_KEY);
      setMaxZoom(DEFAULT_OFFLINE_MAX_ZOOM);
    }
  }, [bbox]);

  useFocusTrap({ active: open, containerRef: cardRef, onEscape: clearDraft });

  // Estimate covers BOTH download legs: imagery tiles + the region's vector data
  // (land ownership / districts / boundaries) that rides along for this footprint.
  const estimate = useMemo(
    () => (bbox ? estimateAreaBytes(bbox, maxZoom).totalBytes : 0),
    [bbox, maxZoom],
  );

  const totalBytes = areas.reduce((sum, a) => sum + a.estimatedBytes, 0);
  const maxBytes = offlineMaxBytes();
  const tooBig = estimate > TOO_BIG_BYTES;
  const willExceedCap = totalBytes + estimate > maxBytes;

  if (!open || !bbox) return null;

  const refusedToast = (reason: "over-cap" | "too-many"): void => {
    show(
      reason === "too-many"
        ? {
            kind: "warning",
            title: "Too many offline areas",
            message: `You can keep up to ${MAX_AREAS} areas. Remove one first.`,
          }
        : {
            kind: "warning",
            title: "Over offline storage cap",
            message: `Adding this area would exceed ${formatBytes(maxBytes)} on disk. Remove an existing area first.`,
          },
    );
  };

  const handleDownloadNow = (): void => {
    const result = queueArea({ label, bbox, maxZoom, basemap });
    if (!result.ok) {
      refusedToast(result.reason);
      return;
    }
    clearDraft();
    if (!isCapacitor()) {
      show({
        kind: "warning",
        title: "Web preview — no actual download",
        message: "Run on iOS/Android (the mobile app) to actually save tiles.",
      });
      return;
    }
    void startDownload(result.area)
      .then(() => show({ kind: "success", title: `Saved ${result.area.label}` }))
      .catch(() => show({ kind: "warning", title: `Download failed for ${result.area.label}` }));
  };

  const handleStage = (): void => {
    const result = queueArea({ label, bbox, maxZoom, basemap });
    if (!result.ok) {
      refusedToast(result.reason);
      return;
    }
    clearDraft();
    show({
      kind: "info",
      title: `${result.area.label} added to Offline Maps`,
      message: "Open it from My Device → Offline Maps to start the download.",
    });
    navigate("/manage/offline-tiles");
  };

  return (
    <div
      className="aoi-sheet"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={helpId}
    >
      <div className="aoi-sheet__backdrop" onClick={clearDraft} aria-hidden="true" />
      <div className="aoi-sheet__card" ref={cardRef}>
        <div className="aoi-sheet__header">
          <div>
            <p className="aoi-sheet__eyebrow">Map · Offline area</p>
            <h2 id={titleId} className="aoi-sheet__title">
              Download this area
            </h2>
          </div>
          <button
            type="button"
            className="fwp-icon-close"
            onClick={clearDraft}
            aria-label="Cancel offline area selection"
          >
            <X size={18} strokeWidth={2.25} aria-hidden />
          </button>
        </div>

        <p id={helpId} className="aoi-sheet__help">
          Tiles save to your device only — FWP does not receive a record of where or when you
          downloaded.
        </p>

        <div className="aoi-sheet__extent" aria-label="Selected area bounds">
          {bbox.south.toFixed(3)}, {bbox.west.toFixed(3)} → {bbox.north.toFixed(3)},{" "}
          {bbox.east.toFixed(3)}
        </div>

        <label className="fwp-field">
          <span className="fwp-field__label">Label</span>
          <input
            className="fwp-field__input"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
        </label>

        <fieldset className="aoi-sheet__basemap" aria-label="Choose a basemap">
          <legend className="fwp-sr-only">Basemap</legend>
          {(Object.keys(BASEMAP_TEMPLATES) as BasemapKey[]).map((key) => (
            <label
              key={key}
              className={`aoi-sheet__basemap-option ${
                basemap === key ? "aoi-sheet__basemap-option--active" : ""
              }`}
            >
              <input
                type="radio"
                name="aoi-basemap"
                value={key}
                checked={basemap === key}
                onChange={() => setBasemap(key)}
              />
              <span className="aoi-sheet__basemap-label">{BASEMAP_TEMPLATES[key].label}</span>
            </label>
          ))}
        </fieldset>

        <label className="fwp-field">
          <span className="fwp-field__label">
            Max zoom ({OFFLINE_AREA_MIN_ZOOM}–{OFFLINE_MAX_ZOOM})
          </span>
          <input
            type="number"
            min={OFFLINE_AREA_MIN_ZOOM}
            max={OFFLINE_MAX_ZOOM}
            className="fwp-field__input"
            value={maxZoom}
            onChange={(e) => setMaxZoom(Number(e.target.value))}
          />
        </label>

        <div className="aoi-sheet__estimate" aria-live="polite">
          <strong>Estimated size:</strong>{" "}
          <span className={tooBig ? "aoi-sheet__estimate-warn" : ""}>{formatBytes(estimate)}</span>
        </div>

        <p className="aoi-sheet__includes">
          Includes the map basemap plus land ownership, hunting &amp; fishing districts, and access
          boundaries for this area — so you can tap the map to identify them with no signal. Tiles
          from {OFFLINE_ATTRIBUTION} (public domain).
        </p>

        {tooBig && (
          <p className="aoi-sheet__notice aoi-sheet__notice--warn" role="alert">
            That&rsquo;s a lot of tiles. Areas over ~500 MB take a long time and can fill your
            device — lower the max zoom or draw a smaller box.
          </p>
        )}
        {willExceedCap && (
          <p className="aoi-sheet__notice aoi-sheet__notice--warn" role="alert">
            Queueing this area would push total offline storage past {formatBytes(maxBytes)}. Remove
            an existing area first.
          </p>
        )}

        <div className="aoi-sheet__actions">
          <PillButton variant="ghost" type="button" onClick={handleStage}>
            Add to Offline Maps
          </PillButton>
          <PillButton
            variant="primary"
            type="button"
            iconStart={Download}
            onClick={handleDownloadNow}
            disabled={willExceedCap}
          >
            Download now
          </PillButton>
        </div>
      </div>
    </div>
  );
};
