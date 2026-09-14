/**
 * @file OfflineTilesPage.tsx
 * @module engage-mt/manage
 * @description Offline-tile staging + download page.
 *              Lets the user stage a custom bounding-box area against one of
 *              three FWP-licensable basemaps (USA Topo, World Imagery, World
 *              Topo). The download queue, cap check, and download orchestration
 *              live in `offlineAreasStore` so the on-map "Download this area"
 *              AOI flow shares the same queue. Downloads run via `downloadArea`
 *              (Capacitor filesystem on mobile, no-op on web).
 *
 *              Total bytes on disk are capped at maxBytes from
 *              offlineTileQuota; the UI rejects any new area that would push
 *              the total over the cap and points the user at "Manage offline
 *              areas" to evict the oldest.
 * @author Jamie Ellis / Engage MT
 * @created 2026-05-29
 * @updated 2026-07-15
 * @version 1.3.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { lazy, Suspense, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CalciteNotice } from "@esri/calcite-components-react";
import { isCapacitor } from "@/utils/capacitor";
import { Download, MapPlus } from "lucide-react";
import { PillButton } from "@/components/shared/forms/PillButton";
import type { AoiBbox } from "@/services/map/aoiGeometry";
import { SkeletonGrid } from "@/components/shared/feedback/Skeleton";
import { useToast } from "@/hooks/useToast";
import {
  estimateAreaBytes,
  formatBytes,
  offlineMaxBytes,
} from "@/services/mobile/offlineTileQuota";
import {
  BASEMAP_TEMPLATES,
  DEFAULT_BASEMAP_KEY,
  DEFAULT_OFFLINE_MAX_ZOOM,
  OFFLINE_AREA_MIN_ZOOM,
  OFFLINE_ATTRIBUTION,
  OFFLINE_MAX_ZOOM,
  type BasemapKey,
} from "@/config/offlineBasemaps";
import { MAX_AREAS, useOfflineAreasStore, type OfflineArea } from "@/store/field/offlineAreasStore";
import "./OfflineTilesPage.css";

// Lazy so the ArcGIS map module only loads when the user opens the picker —
// keeps a second WebGL context (and the SDK) out of the page's initial load.
const AoiPickerMap = lazy(() =>
  import("./AoiPickerMap").then((m) => ({ default: m.AoiPickerMap })),
);

export const OfflineTilesPage = (): JSX.Element => {
  const { show } = useToast();
  const [label, setLabel] = useState("My hunt area");
  const [north, setNorth] = useState(46.0);
  const [south, setSouth] = useState(45.5);
  const [west, setWest] = useState(-111.5);
  const [east, setEast] = useState(-110.5);
  const [maxZoom, setMaxZoom] = useState(DEFAULT_OFFLINE_MAX_ZOOM);
  const [basemap, setBasemap] = useState<BasemapKey>(DEFAULT_BASEMAP_KEY);
  const [showPicker, setShowPicker] = useState(false);

  const areas = useOfflineAreasStore((s) => s.areas);
  const queueArea = useOfflineAreasStore((s) => s.queueArea);
  const removeArea = useOfflineAreasStore((s) => s.removeArea);
  const startDownload = useOfflineAreasStore((s) => s.startDownload);

  const estimate = useMemo(
    () => estimateAreaBytes({ north, south, east, west }, maxZoom).totalBytes,
    [north, south, east, west, maxZoom],
  );
  const maxBytes = offlineMaxBytes();

  // Two-way bridge between the drawn box and the number fields: the map renders
  // this bbox, and a fresh draw writes back into the fields. The fields stay the
  // keyboard / screen-reader equivalent of drawing.
  const bboxValue = useMemo<AoiBbox>(
    () => ({ north, south, east, west }),
    [north, south, east, west],
  );

  const handleDrawnBbox = (b: AoiBbox): void => {
    setNorth(b.north);
    setSouth(b.south);
    setEast(b.east);
    setWest(b.west);
  };

  const totalBytes = areas.reduce((sum, a) => sum + a.estimatedBytes, 0);

  const queue = (): void => {
    const result = queueArea({
      label,
      bbox: { north, south, east, west },
      maxZoom,
      basemap,
    });
    if (!result.ok) {
      show(
        result.reason === "too-many"
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
      return;
    }
    show({
      kind: isCapacitor() ? "info" : "warning",
      title: isCapacitor() ? "Area queued for download" : "Web preview — no actual download",
      message: isCapacitor()
        ? "Tap Start to download. Tiles save to your device only."
        : "Run on iOS/Android (the mobile app) to actually save tiles.",
    });
  };

  const start = async (area: OfflineArea): Promise<void> => {
    try {
      await startDownload(area);
      show({ kind: "success", title: `Saved ${area.label}` });
    } catch {
      show({ kind: "warning", title: `Download failed for ${area.label}` });
    }
  };

  const tooBig = estimate > 500_000_000;
  const willExceedCap = totalBytes + estimate > maxBytes;
  const capUsagePct = Math.min(100, Math.round((totalBytes / maxBytes) * 100));

  return (
    <section className="offline fwp-mobile-safe-bottom">
      <div className="fwp-tool-hero" data-module="manage">
        <Link to="/manage" className="offline__back">
          ← Back to Manage
        </Link>
        <h1 className="fwp-tool-hero__title">Offline Maps</h1>
        <p className="fwp-tool-hero__lede">
          Download a map area for use without a cell signal. Tiles save to your device only — FWP
          does not receive a record of where or when you downloaded.
        </p>
      </div>

      {!isCapacitor() && (
        <CalciteNotice open icon="information" kind="brand">
          <div slot="title">Web preview</div>
          <div slot="message">
            On the web, Engage MT can&rsquo;t persist tiles. Install the mobile app to use an area
            offline.
          </div>
        </CalciteNotice>
      )}

      <div className="offline__cap" aria-live="polite">
        <div className="offline__cap-row">
          <span>
            Storage used: <strong>{formatBytes(totalBytes)}</strong> of {formatBytes(maxBytes)} cap
          </span>
          <span className="offline__cap-pct">{capUsagePct}%</span>
        </div>
        <div
          className="offline__cap-bar"
          role="progressbar"
          aria-valuenow={capUsagePct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Offline storage usage"
        >
          <div className="offline__cap-bar-fill" style={{ width: `${capUsagePct}%` }} />
        </div>
      </div>

      <section className="offline__group" aria-labelledby="offline-add">
        <h2 id="offline-add">Stage a custom area</h2>
        <div className="offline__picker-toggle">
          <PillButton
            variant={showPicker ? "primary" : "ghost"}
            iconStart={MapPlus}
            aria-expanded={showPicker}
            onClick={() => setShowPicker((v) => !v)}
          >
            {showPicker ? "Hide map" : "Draw area on map"}
          </PillButton>
          <span className="offline__picker-hint">
            Tap two corners to set a box, or type the bounds below.
          </span>
        </div>
        {showPicker && (
          <Suspense fallback={<SkeletonGrid count={1} />}>
            <AoiPickerMap value={bboxValue} onChange={handleDrawnBbox} />
          </Suspense>
        )}
        <fieldset className="offline__basemap" aria-label="Choose a basemap">
          <legend className="fwp-sr-only">Basemap</legend>
          {(Object.keys(BASEMAP_TEMPLATES) as BasemapKey[]).map((key) => (
            <label
              key={key}
              className={`offline__basemap-option ${
                basemap === key ? "offline__basemap-option--active" : ""
              }`}
            >
              <input
                type="radio"
                name="basemap"
                value={key}
                checked={basemap === key}
                onChange={() => setBasemap(key)}
              />
              <span className="offline__basemap-label">{BASEMAP_TEMPLATES[key].label}</span>
              <span className="offline__basemap-description">
                {BASEMAP_TEMPLATES[key].description}
              </span>
            </label>
          ))}
        </fieldset>
        <p className="offline__attribution">Tiles from {OFFLINE_ATTRIBUTION} (public domain).</p>
        <div className="offline__inputs">
          <label className="fwp-field">
            <span className="fwp-field__label">Label</span>
            <input
              className="fwp-field__input"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </label>
          <label className="fwp-field">
            <span className="fwp-field__label">North</span>
            <input
              type="number"
              step="0.01"
              className="fwp-field__input"
              value={north}
              onChange={(e) => setNorth(Number(e.target.value))}
            />
          </label>
          <label className="fwp-field">
            <span className="fwp-field__label">South</span>
            <input
              type="number"
              step="0.01"
              className="fwp-field__input"
              value={south}
              onChange={(e) => setSouth(Number(e.target.value))}
            />
          </label>
          <label className="fwp-field">
            <span className="fwp-field__label">West</span>
            <input
              type="number"
              step="0.01"
              className="fwp-field__input"
              value={west}
              onChange={(e) => setWest(Number(e.target.value))}
            />
          </label>
          <label className="fwp-field">
            <span className="fwp-field__label">East</span>
            <input
              type="number"
              step="0.01"
              className="fwp-field__input"
              value={east}
              onChange={(e) => setEast(Number(e.target.value))}
            />
          </label>
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
        </div>
        <div className="offline__estimate">
          <strong>Estimated size:</strong>{" "}
          <span className={tooBig ? "offline__estimate-warn" : ""}>{formatBytes(estimate)}</span>
        </div>
        {tooBig && (
          <CalciteNotice open icon="exclamation-mark-triangle" kind="warning">
            <div slot="title">That&rsquo;s a lot of tiles</div>
            <div slot="message">
              Areas over ~500 MB take a long time to download and can fill your device. Lower max
              zoom or shrink the bbox.
            </div>
          </CalciteNotice>
        )}
        {willExceedCap && (
          <CalciteNotice open icon="exclamation-mark-triangle" kind="warning">
            <div slot="title">Would exceed storage cap</div>
            <div slot="message">
              Queueing this area would push total offline storage past {formatBytes(maxBytes)}.
              Remove an existing area first.
            </div>
          </CalciteNotice>
        )}
        <PillButton variant="primary" iconStart={Download} onClick={queue}>
          Queue this area
        </PillButton>
      </section>

      {areas.length > 0 && (
        <section className="offline__group" aria-labelledby="offline-list">
          <h2 id="offline-list">Staged areas</h2>
          <p className="offline__total">
            Total: <strong>{formatBytes(totalBytes)}</strong> across {areas.length}{" "}
            {areas.length === 1 ? "area" : "areas"}
          </p>
          <ul className="offline__list">
            {areas.map((a) => (
              <li key={a.id} className="offline__row">
                <div className="offline__row-main">
                  <strong>{a.label}</strong>
                  <small>
                    {a.bbox.south.toFixed(2)},{a.bbox.west.toFixed(2)} → {a.bbox.north.toFixed(2)},
                    {a.bbox.east.toFixed(2)} · zoom {a.minZoom ?? OFFLINE_AREA_MIN_ZOOM}–{a.maxZoom}{" "}
                    · {formatBytes(a.estimatedBytes)}
                    {a.basemap ? ` · ${BASEMAP_TEMPLATES[a.basemap].label}` : ""}
                  </small>
                  {a.dataStatus === "downloaded" && (
                    <small>
                      Includes land ownership &amp; districts
                      {a.dataBytes ? ` · ${formatBytes(a.dataBytes)}` : ""}
                    </small>
                  )}
                  {a.regsStatus === "downloaded" && (
                    <small>
                      Regulations{a.regsVersion != null ? ` v${a.regsVersion}` : ""}
                      {a.regsDistricts && a.regsDistricts.length > 0
                        ? ` · HDs ${a.regsDistricts.join(", ")}`
                        : ""}
                    </small>
                  )}
                  {(a.status === "downloading" || typeof a.progressPct === "number") && (
                    <div
                      className="offline__progress"
                      role="progressbar"
                      aria-valuenow={a.progressPct ?? 0}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    >
                      <div
                        className="offline__progress-fill"
                        style={{ width: `${a.progressPct ?? 0}%` }}
                      />
                      <span className="offline__progress-label">
                        {a.status === "downloaded"
                          ? "Saved"
                          : a.status === "failed"
                            ? "Failed"
                            : `${a.progressPct ?? 0}%`}
                      </span>
                    </div>
                  )}
                </div>
                <div className="offline__row-actions">
                  {a.status !== "downloading" && a.status !== "downloaded" && (
                    <button type="button" className="offline__start" onClick={() => void start(a)}>
                      {a.status === "failed" ? "Retry" : "Start"}
                    </button>
                  )}
                  <button
                    type="button"
                    className="offline__rm"
                    onClick={() => removeArea(a.id)}
                    aria-label={`Remove ${a.label}`}
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </section>
  );
};
