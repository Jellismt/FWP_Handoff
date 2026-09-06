/**
 * @file ImportDialog.tsx
 * @module engage-mt/field
 * @description Lightweight import dialog for GPX files.
 *              Wraps a file `<input type="file">`
 *              + the `parseGpx` service, shows a pre-commit preview of
 *              counts + warnings, and commits via `commitGpxImport` into
 *              the field-tools store. Imports auto-assign to the currently
 *              active trip when one is selected.
 *
 *              Privacy: every file read happens in the browser via
 *              `FileReader` — nothing leaves the device. Per
 *              [docs/rules/privacy.md](../../../docs/rules/privacy.md).
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-09
 * @updated 2026-07-14
 * @version 1.0.1
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, FileUp, Upload, X } from "lucide-react";
import { PillButton } from "@/components/shared/forms/PillButton";
import { commitGpxImport, parseGpx, type GpxImportResult } from "@/services/field/gpxImport";
import { parseKml } from "@/services/field/kmlImport";
import { useFieldToolsStore } from "@/store/field/fieldToolsStore";
import { useToast } from "@/hooks/useToast";
import "./ImportDialog.css";

/**
 * Pick the parser by filename extension, falling back to a content sniff
 * (KML documents contain a `<kml` root; everything else is treated as GPX).
 */
const parseByFormat = (filename: string, text: string): GpxImportResult => {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".kml") || (!lower.endsWith(".gpx") && /<kml[\s>]/i.test(text))) {
    return parseKml(text);
  }
  return parseGpx(text);
};

interface Props {
  open: boolean;
  onClose: () => void;
  /** Pre-parsed result (e.g. a file opened from the OS). Skips the file picker
   * And lands straight on the preview.. */
  initialResult?: GpxImportResult | null;
  /** Source label for a pre-parsed result (e.g. the shared file's name). */
  initialSourceLabel?: string | null;
}

export const ImportDialog = ({
  open,
  onClose,
  initialResult,
  initialSourceLabel,
}: Props): JSX.Element | null => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [filename, setFilename] = useState<string | null>(null);
  const [parsed, setParsed] = useState<GpxImportResult | null>(null);
  const [busy, setBusy] = useState(false);
  const activeTripId = useFieldToolsStore((s) => s.activeTripId);
  const { show } = useToast();

  // Seed the preview from a pre-parsed result (shared-file open) when the
  // dialog opens with one.
  useEffect(() => {
    if (open && initialResult) {
      setParsed(initialResult);
      setFilename(initialSourceLabel ?? "Shared file");
    }
  }, [open, initialResult, initialSourceLabel]);

  const reset = useCallback(() => {
    setFilename(null);
    setParsed(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const onFile = useCallback(
    async (file: File): Promise<void> => {
      setBusy(true);
      setFilename(file.name);
      try {
        const text = await file.text();
        const result = parseByFormat(file.name, text);
        setParsed(result);
      } catch (err) {
        show({
          kind: "warning",
          title: "Couldn't read file",
          message: err instanceof Error ? err.message : "Unknown error.",
        });
        reset();
      } finally {
        setBusy(false);
      }
    },
    [reset, show],
  );

  const onCommit = (): void => {
    if (!parsed) return;
    const { addedWaypoints, addedRoutes } = commitGpxImport(parsed, {
      tripId: activeTripId ?? undefined,
    });
    show({
      kind: "success",
      title: "Imported",
      message: `Added ${addedWaypoints} waypoints and ${addedRoutes} tracks.`,
    });
    reset();
    onClose();
  };

  if (!open) return null;

  return (
    <div
      className="import-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="import-dialog-title"
    >
      <div className="import-dialog__backdrop" onClick={onClose} aria-hidden="true" />
      <div className="import-dialog__card">
        <header className="import-dialog__header">
          <h2 id="import-dialog-title" className="import-dialog__title">
            <Upload size={18} aria-hidden /> Import GPX / KML
          </h2>
          <button
            type="button"
            className="fwp-icon-close"
            aria-label="Close import dialog"
            onClick={onClose}
          >
            <X size={18} aria-hidden />
          </button>
        </header>
        <div className="import-dialog__body">
          {!parsed && (
            <>
              <p className="import-dialog__lede">
                Open a <strong>.gpx</strong> or <strong>.kml</strong> file exported from another
                mapping app or GPS device. Items stay on this device.
              </p>
              <label className="import-dialog__file">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".gpx,.kml,application/gpx+xml,application/vnd.google-earth.kml+xml,text/xml"
                  className="import-dialog__file-input"
                  disabled={busy}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void onFile(file);
                  }}
                />
                <span className="import-dialog__file-cta">
                  <FileUp size={20} aria-hidden />
                  {busy ? "Reading…" : (filename ?? "Choose a .gpx or .kml file")}
                </span>
              </label>
              <p className="import-dialog__external-note">
                Got a <strong>share link from another app</strong> instead of a file? Those often
                only open in that app — ask the sender to <em>Export</em> the pin as GPX or KML and
                send that.
              </p>
            </>
          )}
          {parsed && (
            <div className="import-dialog__preview">
              <h3 className="import-dialog__preview-title">
                <Check size={16} aria-hidden /> Ready to import
              </h3>
              <ul className="import-dialog__counts">
                <li>
                  <strong>{parsed.waypoints.length}</strong> waypoint
                  {parsed.waypoints.length === 1 ? "" : "s"}
                </li>
                <li>
                  <strong>{parsed.routes.length}</strong> track
                  {parsed.routes.length === 1 ? "" : "s"}
                </li>
              </ul>
              {activeTripId && (
                <p className="import-dialog__hint">
                  Items will be assigned to the currently-active trip.
                </p>
              )}
              {parsed.warnings.length > 0 && (
                <details className="import-dialog__warnings">
                  <summary>
                    {parsed.warnings.length} warning{parsed.warnings.length === 1 ? "" : "s"}
                  </summary>
                  <ul>
                    {parsed.warnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )}
        </div>
        <footer className="import-dialog__actions">
          {parsed && (
            <PillButton variant="primary" iconStart={Upload} onClick={onCommit}>
              Import {parsed.waypoints.length + parsed.routes.length} items
            </PillButton>
          )}
          <PillButton variant="ghost" iconStart={X} onClick={onClose}>
            Cancel
          </PillButton>
        </footer>
      </div>
    </div>
  );
};
