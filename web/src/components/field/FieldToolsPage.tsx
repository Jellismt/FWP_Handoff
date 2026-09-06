/**
 * @file FieldToolsPage.tsx
 * @module engage-mt/field
 * @description Consumer-grade field tools dashboard — waypoints, draw, measure,
 *              captured routes, and photo+notes. A mobile-app surface
 *: the /field and /manage/field-tools routes render it
 *              only inside Capacitor. Everything reads/writes
 *              `useFieldToolsStore`. All data is local-first; no coordinates
 *              leave the device. Sharing stays per-item and user-initiated.
 *
 *              Waypoints are created on the map (drop-waypoint on the tool
 *              rail, or the tap panel's "Drop a waypoint here"); this page
 *              lists, shares, and manages what's saved.
 * @author Jamie Ellis / Engage MT
 * @created 2026-05-29
 * @updated 2026-07-16
 * @version 1.3.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Edit3,
  MapPin,
  Route,
  Ruler,
  Pencil,
  Camera,
  Trash2,
  Download,
  Share2,
  Upload,
} from "lucide-react";
import { useFieldToolsStore, WAYPOINT_KIND_INFO } from "@/store/field/fieldToolsStore";
import { useMapNavStore } from "@/store/map/mapNavStore";
import { usePendingImportStore } from "@/store/field/pendingImportStore";
import { PrivacyBadge } from "@/components/shared/widgets/PrivacyBadge";
import { TrackRecorderPanel } from "@/components/field/TrackRecorderPanel";
import { TripSwitcher } from "@/components/field/TripSwitcher";
import { ImportDialog } from "@/components/field/ImportDialog";
import { share, buildPinSharePayload, type ShareOutcome } from "@/services/mobile/shareService";
import { exportLibraryGpx } from "@/services/field/gpxFileExport";
import { useToast } from "@/hooks/useToast";
import { isCapacitor, supportsGpsCapture } from "@/utils/capacitor";
import { ExplainerNote } from "@/components/map/featureCards/core/cardPrimitives";
import "./FieldToolsPage.css";

type Tab = "waypoints" | "routes" | "shapes" | "measurements";

const formatLatLon = (lat: number, lon: number): string => `${lat.toFixed(5)}, ${lon.toFixed(5)}`;

/**
 * Map a saved shape's color name to its brand-token reference. Keeps the
 * mapping next to the consumer so future colors live in one place; the
 * stripe element reads via the `--stripe` CSS custom property.
 */
const SHAPE_COLOR_TOKEN: Record<string, string> = {
  yellow: "var(--fwp-yellow)",
  orange: "var(--fwp-orange)",
  blue: "var(--fwp-blue)",
  green: "var(--fwp-green-dark)",
  purple: "var(--fwp-blue-light)",
  red: "var(--fwp-red)",
};

const shapeColorToken = (color: string): string =>
  SHAPE_COLOR_TOKEN[color] ?? "var(--fwp-text-secondary)";

/**
 * Inline edit form for a saved field item (rename + notes). Renders in place
 * of the entry body; Save writes through the store action the caller wires.
 */
const EntryEditForm = ({
  itemLabel,
  initialName,
  initialNotes,
  onSave,
  onCancel,
}: {
  itemLabel: string;
  initialName: string;
  initialNotes: string;
  onSave: (name: string, notes: string) => void;
  onCancel: () => void;
}): JSX.Element => {
  const [name, setName] = useState(initialName);
  const [notes, setNotes] = useState(initialNotes);
  return (
    <form
      className="field-tools__edit-form"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(name.trim() || initialName, notes.trim());
      }}
    >
      <label className="field-tools__edit-label">
        Name
        <input
          type="text"
          className="field-tools__edit-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-label={`${itemLabel} name`}
        />
      </label>
      <label className="field-tools__edit-label">
        Notes
        <textarea
          className="field-tools__edit-textarea"
          value={notes}
          rows={2}
          onChange={(e) => setNotes(e.target.value)}
          aria-label={`${itemLabel} notes`}
        />
      </label>
      <div className="field-tools__edit-actions">
        <button type="submit" className="fwp-pill-button fwp-pill-button--primary">
          Save
        </button>
        <button type="button" className="fwp-pill-button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
};

export const FieldToolsPage = (): JSX.Element => {
  const [tab, setTab] = useState<Tab>("waypoints");
  // One item editable at a time; the entry body swaps to the form.
  const [editingId, setEditingId] = useState<string | null>(null);
  const {
    waypoints: allWaypoints,
    routes: allRoutes,
    shapes: allShapes,
    measurements,
    removeWaypoint,
    removeRoute,
    removeShape,
    removeMeasurement,
    updateWaypoint,
    updateRoute,
    updateShape,
    clearAll,
  } = useFieldToolsStore();
  const activeTripId = useFieldToolsStore((s) => s.activeTripId);
  // Filter the visible items by the active trip. "All" (null)
  // shows everything; selecting a trip narrows to assigned items.
  const waypoints = useMemo(
    () =>
      activeTripId == null ? allWaypoints : allWaypoints.filter((w) => w.tripId === activeTripId),
    [allWaypoints, activeTripId],
  );
  const routes = useMemo(
    () => (activeTripId == null ? allRoutes : allRoutes.filter((r) => r.tripId === activeTripId)),
    [allRoutes, activeTripId],
  );
  const shapes = useMemo(
    () => (activeTripId == null ? allShapes : allShapes.filter((s) => s.tripId === activeTripId)),
    [allShapes, activeTripId],
  );
  const trips = useFieldToolsStore((s) => s.trips);

  const activeTrip = useMemo(
    () => trips.find((t) => t.id === activeTripId) ?? null,
    [trips, activeTripId],
  );
  const navigate = useNavigate();
  const requestGoto = useMapNavStore((s) => s.requestGoto);
  const { show: showToast } = useToast();
  const [importOpen, setImportOpen] = useState(false);

  // A GPX/KML file opened from the OS lands here (staged by the
  // app-lifecycle handler). Auto-open the import preview with it.
  const pendingImport = usePendingImportStore((s) => s.result);
  const pendingImportLabel = usePendingImportStore((s) => s.sourceLabel);
  const clearPendingImport = usePendingImportStore((s) => s.clear);
  useEffect(() => {
    if (pendingImport) setImportOpen(true);
  }, [pendingImport]);

  // Translate a ShareOutcome from the share service into a
  // user-facing toast. Without this feedback, a user who fell off the
  // native share-sheet path onto the clipboard fallback has no idea
  // anything happened.
  const announceShareOutcome = (outcome: ShareOutcome, label: string): void => {
    if (outcome === "shared") {
      showToast({ kind: "success", title: `Shared ${label}` });
    } else if (outcome === "copied") {
      showToast({
        kind: "info",
        title: `${label} copied to clipboard`,
        message: "Paste into Messages, Mail, or any text field.",
      });
    } else if (outcome === "mailto-opened") {
      showToast({
        kind: "info",
        title: `Opened email draft for ${label}`,
      });
    } else if (outcome === "failed") {
      showToast({
        kind: "warning",
        title: `Couldn't share ${label}`,
        message: "Try again in a moment.",
      });
    }
    // "cancelled" intentionally silent — user dismissed.
  };

  const handleShareWaypoint = async (w: (typeof waypoints)[number]): Promise<void> => {
    // Dual payload: Engage MT deep link (full fidelity) + GPX body.
    const payload = buildPinSharePayload({ waypoints: [w] });
    const outcome = await share(payload);
    announceShareOutcome(outcome, "waypoint");
  };

  const handleShareRoute = async (r: (typeof routes)[number]): Promise<void> => {
    // Warn about message-body truncation for very long
    // tracks. iMessage / WhatsApp soft-cap message bodies; a 1000+
    // point track pastes a 50+ KB GPX into the text. Recommend
    // Export to GPX (file download) for those.
    if (r.path.length > 500) {
      showToast({
        kind: "info",
        title: "Long track — share may truncate",
        message: "Some messaging apps cap text length. Share GPX sends it as a file instead.",
        duration: 6000,
      });
    }
    const payload = buildPinSharePayload({ routes: [r] });
    const outcome = await share(payload);
    announceShareOutcome(outcome, "track");
  };

  // Share the whole active trip (every visible item) as one bundle.
  // The codec auto-falls back to a file-only (GPX) share when the selection
  // exceeds the link budget. The trip wrapper rides in the high-fidelity link.
  const handleExportGpx = async (): Promise<void> => {
    const outcome = await exportLibraryGpx(waypoints, routes);
    if (outcome === "empty") {
      showToast({
        kind: "info",
        title: "Nothing to export yet",
        message: "Save a waypoint or a track first.",
      });
    } else if (outcome === "failed") {
      showToast({
        kind: "warning",
        title: "Couldn't export GPX",
        message: "Try again in a moment.",
      });
    } else if (outcome === "downloaded") {
      showToast({
        kind: "success",
        title: "GPX downloaded",
        message: "Open it in any mapping app or GPS device.",
      });
    } else {
      showToast({ kind: "success", title: "GPX ready to share" });
    }
  };

  const handleShareTrip = async (): Promise<void> => {
    if (!activeTrip) return;
    const payload = buildPinSharePayload({ waypoints, routes, shapes, trip: activeTrip });
    const outcome = await share(payload);
    announceShareOutcome(outcome, "trip");
  };

  return (
    <section className="field-tools fwp-mobile-safe-bottom">
      <div className="fwp-tool-hero" data-module="explore">
        <Link to="/" className="fwp-tool-hero__map-cta">
          <span>View map</span>
          <ArrowRight size={18} strokeWidth={2.25} aria-hidden />
        </Link>
        <Link to="/" className="field-tools__back">
          ← Back to Map
        </Link>
        <h1 className="fwp-tool-hero__title">Field Tools</h1>
        <p className="fwp-tool-hero__lede">
          Waypoints, drawn shapes, measurements, captured routes, and photo notes — all stored on
          this device. <PrivacyBadge label="Local-only" />
        </p>
        <div className="fwp-tool-hero__stats">
          <div>
            <span className="fwp-tool-hero__stat-label">Waypoints</span>
            <span className="fwp-tool-hero__stat-value fwp-tool-hero__stat-value--accent">
              {waypoints.length}
            </span>
          </div>
          <div>
            <span className="fwp-tool-hero__stat-label">Routes</span>
            <span className="fwp-tool-hero__stat-value">{routes.length}</span>
          </div>
          <div>
            <span className="fwp-tool-hero__stat-label">Shapes</span>
            <span className="fwp-tool-hero__stat-value">{shapes.length}</span>
          </div>
          <div>
            <span className="fwp-tool-hero__stat-label">Measurements</span>
            <span className="fwp-tool-hero__stat-value">{measurements.length}</span>
          </div>
        </div>
        <div className="fwp-tool-hero__actions">
          <button
            type="button"
            className="fwp-pill-button fwp-pill-button--primary"
            onClick={() => setImportOpen(true)}
          >
            <Upload size={14} /> Import GPX / KML
          </button>
          <button
            type="button"
            className="fwp-pill-button fwp-pill-button--primary"
            onClick={() => void handleExportGpx()}
            aria-label="Export every waypoint and track as one GPX file"
          >
            <Download size={14} /> Export GPX
          </button>
          {activeTrip && (
            <button
              type="button"
              className="fwp-pill-button fwp-pill-button--primary"
              onClick={() => void handleShareTrip()}
              aria-label={`Share the ${activeTrip.name} trip with another Engage MT user`}
            >
              <Share2 size={14} /> Share trip
            </button>
          )}
          <button
            type="button"
            className="fwp-pill-button fwp-pill-button--primary"
            onClick={() => {
              if (confirm("Clear all field-tools data?")) clearAll();
            }}
          >
            <Trash2 size={14} /> Clear all
          </button>
        </div>
        {/* In-app help: how sharing + importing works, incl. the
            honest cross-app caveat (link vs file). */}
        <ExplainerNote>
          Share any pin, track, or trip: tap Share to send an Engage MT link (opens with everything
          intact for another Engage MT user) plus a GPX file for other mapping apps and GPS devices.
          To open a pin a friend sends you, ask them to <strong>Export</strong> it as a GPX or KML
          file — some apps&rsquo; <em>share links</em> only open in that app.
        </ExplainerNote>
        {/* Web is a planning surface. Field data still saves, but
            only to this browser; the honest storage note lives in the hero. */}
        {!isCapacitor() && (
          <ExplainerNote>
            <strong>Planning on the web:</strong> waypoints, shapes, and measurements you make here
            stay in this browser only. Share an item as GPX to keep it or move it to the Engage MT
            mobile app, where it&rsquo;s saved on your device. Recording a GPS track and downloading
            offline maps are mobile-app features.
          </ExplainerNote>
        )}
      </div>

      {/* Track recorder sits at the top so a hunter mid-trip taps
          Start, slips the phone in a pocket, and the breadcrumb accumulates.
          Mobile-only; GPS track recording isn't meaningful on a
          desktop planning surface. */}
      {supportsGpsCapture() && <TrackRecorderPanel />}

      {/* Trip switcher pulls the visible item list into the
          currently-selected trip (or "All" to see everything). Trips arrive
          as shared bundles; new items are auto-assigned to the active trip. */}
      <TripSwitcher />

      {/* Tab strip — every tab carries an id and
          aria-controls so the matching panel below knows which tab it
          belongs to. Each panel has role=tabpanel + aria-labelledby
          pointing back to its tab. */}
      <div className="field-tools__tabs" role="tablist">
        <button
          type="button"
          id="field-tab-waypoints"
          role="tab"
          aria-selected={tab === "waypoints"}
          aria-controls="field-panel-waypoints"
          className={`field-tools__tab${tab === "waypoints" ? " field-tools__tab--active" : ""}`}
          onClick={() => setTab("waypoints")}
        >
          <MapPin size={16} /> Waypoints
        </button>
        <button
          type="button"
          id="field-tab-routes"
          role="tab"
          aria-selected={tab === "routes"}
          aria-controls="field-panel-routes"
          className={`field-tools__tab${tab === "routes" ? " field-tools__tab--active" : ""}`}
          onClick={() => setTab("routes")}
        >
          <Route size={16} /> Routes
        </button>
        <button
          type="button"
          id="field-tab-shapes"
          role="tab"
          aria-selected={tab === "shapes"}
          aria-controls="field-panel-shapes"
          className={`field-tools__tab${tab === "shapes" ? " field-tools__tab--active" : ""}`}
          onClick={() => setTab("shapes")}
        >
          <Pencil size={16} /> Shapes
        </button>
        <button
          type="button"
          id="field-tab-measurements"
          role="tab"
          aria-selected={tab === "measurements"}
          aria-controls="field-panel-measurements"
          className={`field-tools__tab${tab === "measurements" ? " field-tools__tab--active" : ""}`}
          onClick={() => setTab("measurements")}
        >
          <Ruler size={16} /> Measure
        </button>
      </div>

      {tab === "waypoints" && (
        <div role="tabpanel" id="field-panel-waypoints" aria-labelledby="field-tab-waypoints">
          {waypoints.length === 0 ? (
            <p className="field-tools__empty">
              No waypoints yet. Open the map and tap <strong>Drop waypoint</strong> on the tool rail
              to drop a pin right where you are looking.
            </p>
          ) : (
            <ul className="field-tools__list">
              {waypoints.map((w) => (
                <li key={w.id} className="field-tools__entry">
                  <div
                    className="field-tools__kind-stripe"
                    style={{ "--stripe": WAYPOINT_KIND_INFO[w.kind].color } as CSSProperties}
                    aria-hidden="true"
                  />
                  <div className="field-tools__entry-body">
                    {editingId === w.id ? (
                      <EntryEditForm
                        itemLabel="Waypoint"
                        initialName={w.name}
                        initialNotes={w.notes ?? ""}
                        onSave={(name, notes) => {
                          updateWaypoint(w.id, { name, notes });
                          setEditingId(null);
                        }}
                        onCancel={() => setEditingId(null)}
                      />
                    ) : (
                      <>
                        <div className="field-tools__entry-title">{w.name}</div>
                        <div className="field-tools__entry-sub">
                          {WAYPOINT_KIND_INFO[w.kind].label} · {formatLatLon(w.lat, w.lon)}
                        </div>
                        {w.notes && <p className="field-tools__entry-notes">{w.notes}</p>}
                        {(w.photos[0]?.uri ?? w.photoUri) && (
                          <img
                            src={w.photos[0]?.uri ?? w.photoUri}
                            alt={w.name}
                            className="field-tools__entry-photo"
                          />
                        )}
                      </>
                    )}
                  </div>
                  <div className="field-tools__entry-actions">
                    <button
                      type="button"
                      className="fwp-pill-button"
                      onClick={() => setEditingId(editingId === w.id ? null : w.id)}
                      aria-label={`Edit waypoint ${w.name}`}
                    >
                      <Edit3 size={14} /> Edit
                    </button>
                    <button
                      type="button"
                      className="fwp-pill-button"
                      onClick={() => {
                        requestGoto({ lat: w.lat, lon: w.lon, zoom: 14, label: w.name });
                        navigate("/");
                      }}
                      aria-label={`Show ${w.name} on the map`}
                    >
                      <MapPin size={14} /> Map
                    </button>
                    <button
                      type="button"
                      className="fwp-pill-button"
                      onClick={() => void handleShareWaypoint(w)}
                      aria-label={`Share ${w.name} via email, text, or the native share sheet`}
                    >
                      <Share2 size={14} /> Share
                    </button>
                    <button
                      type="button"
                      className="fwp-pill-button"
                      onClick={() => removeWaypoint(w.id)}
                      aria-label={`Delete waypoint ${w.name}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === "routes" && (
        <div
          role="tabpanel"
          id="field-panel-routes"
          aria-labelledby="field-tab-routes"
          className="field-tools__panel"
        >
          <h2 className="field-tools__panel-heading">Captured routes</h2>
          {routes.length === 0 ? (
            <p className="field-tools__empty">
              No tracks recorded yet. Tap the <strong>Record</strong> button on the map tool rail
              (next to Drop-waypoint) — or <strong>Start track</strong> at the top of this page — to
              begin a GPS recording, then Stop &amp; save to land it here.
            </p>
          ) : (
            <ul className="field-tools__list">
              {routes.map((r) => (
                <li key={r.id} className="field-tools__entry">
                  <div className="field-tools__kind-stripe field-tools__kind-stripe--explore" />
                  <div className="field-tools__entry-body">
                    {editingId === r.id ? (
                      <EntryEditForm
                        itemLabel="Track"
                        initialName={r.name}
                        initialNotes={r.notes ?? ""}
                        onSave={(name, notes) => {
                          updateRoute(r.id, { name, notes });
                          setEditingId(null);
                        }}
                        onCancel={() => setEditingId(null)}
                      />
                    ) : (
                      <>
                        <div className="field-tools__entry-title">{r.name}</div>
                        <div className="field-tools__entry-sub">
                          {r.distanceMi.toFixed(2)} mi ·{" "}
                          {r.gainFt.toLocaleString(undefined, { maximumFractionDigits: 0 })} ft gain
                          · {r.path.length} points
                        </div>
                        {r.notes && <p className="field-tools__entry-notes">{r.notes}</p>}
                      </>
                    )}
                  </div>
                  <div className="field-tools__entry-actions">
                    <button
                      type="button"
                      className="fwp-pill-button"
                      onClick={() => setEditingId(editingId === r.id ? null : r.id)}
                      aria-label={`Edit track ${r.name}`}
                    >
                      <Edit3 size={14} /> Edit
                    </button>
                    <button
                      type="button"
                      className="fwp-pill-button"
                      onClick={() => {
                        // A track spans an area, not a point. Fly to the
                        // middle sample (always on the path) at a slightly
                        // wider zoom than a single feature. requestGoto is
                        // point-only, so we center rather than fit-extent.
                        const mid = r.path[Math.floor(r.path.length / 2)];
                        if (!mid) return;
                        requestGoto({ lat: mid[1], lon: mid[0], zoom: 12, label: r.name });
                        navigate("/");
                      }}
                      aria-label={`Show track ${r.name} on the map`}
                    >
                      <MapPin size={14} /> Map
                    </button>
                    <button
                      type="button"
                      className="fwp-pill-button"
                      onClick={() => void handleShareRoute(r)}
                      aria-label={`Share track ${r.name} as GPX`}
                    >
                      <Share2 size={14} /> Share GPX
                    </button>
                    <button
                      type="button"
                      className="fwp-pill-button"
                      onClick={() => removeRoute(r.id)}
                      aria-label={`Delete track ${r.name}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === "shapes" && (
        <div
          role="tabpanel"
          id="field-panel-shapes"
          aria-labelledby="field-tab-shapes"
          className="field-tools__panel"
        >
          <h2 className="field-tools__panel-heading">Drawn shapes</h2>
          {shapes.length === 0 ? (
            <p className="field-tools__empty">
              No shapes yet. Open the map, choose Draw from the tool rail, and trace a polygon,
              line, or rectangle.
            </p>
          ) : (
            <ul className="field-tools__list">
              {shapes.map((s) => (
                <li key={s.id} className="field-tools__entry">
                  <div
                    className="field-tools__kind-stripe"
                    style={{ "--stripe": shapeColorToken(s.color) } as CSSProperties}
                  />
                  <div className="field-tools__entry-body">
                    {editingId === s.id ? (
                      <EntryEditForm
                        itemLabel="Shape"
                        initialName={s.name}
                        initialNotes={s.notes ?? ""}
                        onSave={(name, notes) => {
                          updateShape(s.id, { name, notes });
                          setEditingId(null);
                        }}
                        onCancel={() => setEditingId(null)}
                      />
                    ) : (
                      <>
                        <div className="field-tools__entry-title">{s.name}</div>
                        <div className="field-tools__entry-sub">
                          {s.shape} · {s.vertices.length} vertices
                        </div>
                        {s.notes && <p className="field-tools__entry-notes">{s.notes}</p>}
                      </>
                    )}
                  </div>
                  <div className="field-tools__entry-actions">
                    <button
                      type="button"
                      className="fwp-pill-button"
                      onClick={() => setEditingId(editingId === s.id ? null : s.id)}
                      aria-label={`Edit shape ${s.name}`}
                    >
                      <Edit3 size={14} /> Edit
                    </button>
                    <button
                      type="button"
                      className="fwp-pill-button"
                      aria-label={`Delete shape ${s.name}`}
                      onClick={() => removeShape(s.id)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === "measurements" && (
        <div
          role="tabpanel"
          id="field-panel-measurements"
          aria-labelledby="field-tab-measurements"
          className="field-tools__panel"
        >
          <h2 className="field-tools__panel-heading">Measurements</h2>
          {measurements.length === 0 ? (
            <p className="field-tools__empty">
              No measurements yet. Open the map and choose the ruler tool to measure distance or
              polygon area.
            </p>
          ) : (
            <ul className="field-tools__list">
              {measurements.map((m) => (
                <li key={m.id} className="field-tools__entry">
                  <div className="field-tools__kind-stripe field-tools__kind-stripe--yellow" />
                  <div className="field-tools__entry-body">
                    <div className="field-tools__entry-title">
                      {m.kind === "distance"
                        ? `${m.value.toFixed(2)} mi`
                        : `${m.value.toFixed(2)} ac`}
                    </div>
                    <div className="field-tools__entry-sub">
                      {m.kind === "distance" ? "Distance" : "Area"} ·{" "}
                      {new Date(m.createdAt).toLocaleString()}
                    </div>
                  </div>
                  <div className="field-tools__entry-actions">
                    <button
                      type="button"
                      className="fwp-pill-button"
                      aria-label={`Delete ${m.kind} measurement (${m.value.toFixed(2)} ${
                        m.kind === "distance" ? "mi" : "ac"
                      })`}
                      onClick={() => removeMeasurement(m.id)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <p className="field-tools__hint">
            <Camera size={14} aria-hidden /> Map-driven draw + measure controls live on the tool
            rail; this panel keeps the saved results.
          </p>
        </div>
      )}
      <ImportDialog
        open={importOpen}
        onClose={() => {
          setImportOpen(false);
          clearPendingImport();
        }}
        initialResult={pendingImport}
        initialSourceLabel={pendingImportLabel}
      />
    </section>
  );
};
