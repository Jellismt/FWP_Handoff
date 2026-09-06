/**
 * @file CoordinateEntryDialog.tsx
 * @module engage-mt/map
 * @description Non-canvas equivalent for the map-tool-rail
 * Draw + measure tools. Keyboard- and SR-only users build a
 *              polygon shape, a polyline shape, a distance measurement, or an area
 *              measurement by typing in [lat, lon] vertices and submitting. The
 *              dispatch produces the same `addShape` / `addMeasurement` records the
 *              canvas-driven flow does, so downstream features (FieldToolsPage,
 *              GPX export, share sheet) treat hand-entered geometry identically.
 *
 *              The dialog is modal: focus trapped via `useFocusTrap`, Esc cancels,
 *              click-outside cancels. Empty vertex rows are forgiving — adding a
 *              row pre-validates only after the first character is typed so SR
 *              users aren't punished for an in-progress entry.
 *
 *              Privacy: nothing leaves the device. Same store, same persistence.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-02
 * @updated 2026-07-03
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { useId, useMemo, useRef, useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { PillButton } from "@/components/shared/forms/PillButton";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { useToast } from "@/hooks/useToast";
import { useFieldToolsStore, type DrawnShape } from "@/store/field/fieldToolsStore";
import {
  metersToMiles,
  polygonAreaSqMeters,
  polylineLengthMeters,
  sqMetersToAcres,
} from "@/utils/geometry";
import "./CoordinateEntryDialog.css";

type Operation = "polygon" | "polyline" | "distance" | "area";

interface VertexRow {
  /** Stable id for React keys; survives reorder/remove. */
  id: string;
  lat: string;
  lon: string;
}

interface Props {
  open: boolean;
  /** Optional preselected operation — MapToolRail sets this when the user is
   *  already in a draw/measure tool and switches to keyboard entry. */
  initialOperation?: Operation;
  onClose: () => void;
}

// Montana bounding rectangle plus a small buffer so border points stay valid.
const LAT_MIN = 43.5;
const LAT_MAX = 49.5;
const LON_MIN = -117.0;
const LON_MAX = -103.0;

const parseLat = (raw: string): number | null => {
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  if (n < LAT_MIN || n > LAT_MAX) return null;
  return n;
};

const parseLon = (raw: string): number | null => {
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  if (n < LON_MIN || n > LON_MAX) return null;
  return n;
};

const newRowId = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `row-${Date.now()}-${Math.round(Math.random() * 1e6)}`;

const newRow = (): VertexRow => ({ id: newRowId(), lat: "", lon: "" });

const OPERATION_LABELS: Record<Operation, string> = {
  polygon: "Polygon shape",
  polyline: "Line shape",
  distance: "Distance measurement",
  area: "Area measurement",
};

const minVerticesFor = (op: Operation): number => (op === "polygon" || op === "area" ? 3 : 2);

const SHAPE_COLORS: DrawnShape["color"][] = ["yellow", "orange", "blue", "green", "red", "purple"];

export const CoordinateEntryDialog = ({
  open,
  initialOperation = "distance",
  onClose,
}: Props): JSX.Element | null => {
  const titleId = useId();
  const helpId = useId();
  const cardRef = useRef<HTMLDivElement>(null);
  const { show } = useToast();
  const addShape = useFieldToolsStore((s) => s.addShape);
  const addMeasurement = useFieldToolsStore((s) => s.addMeasurement);

  const [operation, setOperation] = useState<Operation>(initialOperation);
  const [name, setName] = useState("");
  const [color, setColor] = useState<DrawnShape["color"]>("yellow");
  const [rows, setRows] = useState<VertexRow[]>(() => [newRow(), newRow()]);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useFocusTrap({ active: open, containerRef: cardRef, onEscape: onClose });

  const { parsedVertices, rowErrors } = useMemo(() => {
    const parsed: Array<[number, number]> = [];
    const errors: Record<string, { lat?: string; lon?: string }> = {};
    for (const row of rows) {
      const trimmedLat = row.lat.trim();
      const trimmedLon = row.lon.trim();
      // Forgive a fully-empty row — counted as "not entered yet" instead of an error.
      if (!trimmedLat && !trimmedLon) continue;
      const lat = parseLat(trimmedLat);
      const lon = parseLon(trimmedLon);
      const rowErr: { lat?: string; lon?: string } = {};
      if (lat === null) rowErr.lat = `Lat must be a number between ${LAT_MIN} and ${LAT_MAX}`;
      if (lon === null) rowErr.lon = `Lon must be a number between ${LON_MIN} and ${LON_MAX}`;
      if (rowErr.lat || rowErr.lon) {
        errors[row.id] = rowErr;
      } else if (lat !== null && lon !== null) {
        parsed.push([lon, lat]);
      }
    }
    return { parsedVertices: parsed, rowErrors: errors };
  }, [rows]);

  const minRequired = minVerticesFor(operation);
  const enoughVertices = parsedVertices.length >= minRequired;
  const anyRowErrors = Object.keys(rowErrors).length > 0;

  const summary = useMemo(() => {
    if (!enoughVertices) return null;
    if (operation === "polyline" || operation === "distance") {
      const meters = polylineLengthMeters(parsedVertices);
      return `Length: ${metersToMiles(meters).toFixed(2)} mi`;
    }
    if (operation === "polygon" || operation === "area") {
      const sqm = polygonAreaSqMeters(parsedVertices);
      return `Area: ${sqMetersToAcres(sqm).toFixed(2)} ac`;
    }
    return null;
  }, [enoughVertices, operation, parsedVertices]);

  const handleAddRow = (): void => {
    setRows((rs) => [...rs, newRow()]);
  };

  const handleRemoveRow = (id: string): void => {
    setRows((rs) => (rs.length <= 1 ? rs : rs.filter((r) => r.id !== id)));
  };

  const handleRowChange = (id: string, field: "lat" | "lon", value: string): void => {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
    if (submitError) setSubmitError(null);
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    setSubmitError(null);
    if (!enoughVertices) {
      setSubmitError(`Add at least ${minRequired} vertices with valid Montana lat/lon values.`);
      return;
    }
    if (anyRowErrors) {
      setSubmitError("Fix the invalid coordinate rows before saving.");
      return;
    }
    const trimmedName = name.trim();
    if (operation === "polygon" || operation === "polyline") {
      addShape({
        name: trimmedName || (operation === "polygon" ? "Untitled polygon" : "Untitled line"),
        shape: operation,
        vertices: parsedVertices,
        color,
      });
      show({
        kind: "success",
        title: `Saved ${operation === "polygon" ? "polygon" : "line"}`,
        message: "Visible in My Device → Field Tools → Shapes.",
      });
    } else {
      const meters = operation === "distance" ? polylineLengthMeters(parsedVertices) : 0;
      const sqm = operation === "area" ? polygonAreaSqMeters(parsedVertices) : 0;
      addMeasurement({
        kind: operation === "distance" ? "distance" : "area",
        vertices: parsedVertices,
        value: operation === "distance" ? metersToMiles(meters) : sqMetersToAcres(sqm),
      });
      show({
        kind: "success",
        title: `Saved ${operation === "distance" ? "distance" : "area"} measurement`,
        message: "Visible in My Device → Field Tools → Measure.",
      });
    }
    // Reset for the next entry.
    setName("");
    setRows([newRow(), newRow()]);
    onClose();
  };

  if (!open) return null;

  return (
    <div
      className="coord-entry"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={helpId}
    >
      <div className="coord-entry__backdrop" onClick={onClose} aria-hidden="true" />
      <div className="coord-entry__card" ref={cardRef}>
        <div className="coord-entry__header">
          <div>
            <p className="coord-entry__eyebrow">Map · Keyboard entry</p>
            <h2 id={titleId} className="coord-entry__title">
              Enter coordinates manually
            </h2>
          </div>
          <button
            type="button"
            className="fwp-icon-close"
            onClick={onClose}
            aria-label="Close coordinate entry"
          >
            <X size={18} strokeWidth={2.25} aria-hidden />
          </button>
        </div>

        <p id={helpId} className="coord-entry__help">
          Build a shape or measurement by typing latitude / longitude vertices (decimal degrees,
          Montana extent). Same result as drawing on the map — stored on this device, exportable to
          GPX from Field Tools.
        </p>

        <form className="coord-entry__form" onSubmit={handleSubmit} noValidate>
          <fieldset className="coord-entry__op">
            <legend className="coord-entry__op-legend">Operation</legend>
            {(Object.keys(OPERATION_LABELS) as Operation[]).map((op) => (
              <label key={op} className="coord-entry__op-option">
                <input
                  type="radio"
                  name="coord-entry-op"
                  value={op}
                  checked={operation === op}
                  onChange={() => setOperation(op)}
                />
                <span>{OPERATION_LABELS[op]}</span>
              </label>
            ))}
          </fieldset>

          {(operation === "polygon" || operation === "polyline") && (
            <div className="coord-entry__row">
              <label className="coord-entry__field">
                <span className="coord-entry__field-label">Name</span>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={
                    operation === "polygon" ? "e.g. North glassing parcel" : "e.g. Drainage line"
                  }
                  className="coord-entry__input"
                />
              </label>
              <label className="coord-entry__field coord-entry__field--narrow">
                <span className="coord-entry__field-label">Color</span>
                <select
                  value={color}
                  onChange={(e) => setColor(e.target.value as DrawnShape["color"])}
                  className="coord-entry__input"
                >
                  {SHAPE_COLORS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}

          <div className="coord-entry__vertices" role="group" aria-label="Vertices">
            <div className="coord-entry__vertices-head">
              <span className="coord-entry__vertices-title">
                Vertices ({parsedVertices.length} valid / min {minRequired})
              </span>
              <button
                type="button"
                className="fwp-pill-button fwp-pill-button--sm"
                onClick={handleAddRow}
              >
                <Plus size={14} aria-hidden /> Add vertex
              </button>
            </div>

            <ul className="coord-entry__rows">
              {rows.map((row, index) => {
                const err = rowErrors[row.id];
                const latId = `${row.id}-lat`;
                const lonId = `${row.id}-lon`;
                const latErrId = `${row.id}-lat-err`;
                const lonErrId = `${row.id}-lon-err`;
                return (
                  <li key={row.id} className="coord-entry__row coord-entry__vertex-row">
                    <span className="coord-entry__vertex-index" aria-hidden="true">
                      {index + 1}
                    </span>
                    <label className="coord-entry__field" htmlFor={latId}>
                      <span className="coord-entry__field-label">Lat</span>
                      <input
                        id={latId}
                        inputMode="decimal"
                        type="text"
                        value={row.lat}
                        onChange={(e) => handleRowChange(row.id, "lat", e.target.value)}
                        placeholder="46.6"
                        className="coord-entry__input"
                        aria-invalid={Boolean(err?.lat)}
                        aria-describedby={err?.lat ? latErrId : undefined}
                      />
                      {err?.lat && (
                        <span id={latErrId} className="coord-entry__row-error" role="alert">
                          {err.lat}
                        </span>
                      )}
                    </label>
                    <label className="coord-entry__field" htmlFor={lonId}>
                      <span className="coord-entry__field-label">Lon</span>
                      <input
                        id={lonId}
                        inputMode="decimal"
                        type="text"
                        value={row.lon}
                        onChange={(e) => handleRowChange(row.id, "lon", e.target.value)}
                        placeholder="-111.8"
                        className="coord-entry__input"
                        aria-invalid={Boolean(err?.lon)}
                        aria-describedby={err?.lon ? lonErrId : undefined}
                      />
                      {err?.lon && (
                        <span id={lonErrId} className="coord-entry__row-error" role="alert">
                          {err.lon}
                        </span>
                      )}
                    </label>
                    <button
                      type="button"
                      className="coord-entry__row-remove"
                      onClick={() => handleRemoveRow(row.id)}
                      aria-label={`Remove vertex ${index + 1}`}
                      disabled={rows.length <= 1}
                    >
                      <Trash2 size={14} aria-hidden />
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="coord-entry__summary" aria-live="polite">
            {summary ?? (
              <span className="coord-entry__summary-empty">
                Enter at least {minRequired} valid vertices to see the result.
              </span>
            )}
          </div>

          {submitError && (
            <p className="coord-entry__submit-error" role="alert">
              {submitError}
            </p>
          )}

          <div className="coord-entry__actions">
            <PillButton variant="ghost" type="button" onClick={onClose}>
              Cancel
            </PillButton>
            <PillButton variant="primary" type="submit" disabled={!enoughVertices || anyRowErrors}>
              Save {operation === "polygon" || operation === "polyline" ? "shape" : "measurement"}
            </PillButton>
          </div>
        </form>
      </div>
    </div>
  );
};
