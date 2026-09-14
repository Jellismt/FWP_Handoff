/**
 * @file DashboardScreen.tsx
 * @module engage-mt/staff
 * @description Season-year dashboard: a card per year (status, version, instrument
 *              count), a live validation summary for the active year, and the year
 *              lifecycle actions — create next year, clone-forward a previous year, and
 *              publish (all role-gated server-side).
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-03
 * @updated 2026-07-14
 * @version 1.3.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError, type SeasonYearRow, type ValidationFinding } from "../api.js";
import { useApp } from "../store.js";
import { ConfirmDialog, LiveBanner } from "../components/ui.js";

/** License year convention: Mar 1 <year> → end of Feb <year+1> (see 0001_lookups DDL). */
function defaultYearDates(year: number): { starts_on: string; ends_on: string } {
  return { starts_on: `${year}-03-01`, ends_on: `${year + 1}-02-28` };
}

export function DashboardScreen() {
  const { seasonYear, me, refreshSeasonYears } = useApp();
  const [years, setYears] = useState<SeasonYearRow[]>([]);
  const [findings, setFindings] = useState<ValidationFinding[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [note, setNote] = useState("");
  // Mid-year-correction fields (only shown/sent when this publish creates v2+).
  const [correctionSummary, setCorrectionSummary] = useState("");
  const [affectedSpecies, setAffectedSpecies] = useState("");
  const [affectedDistricts, setAffectedDistricts] = useState("");
  const [cloneReq, setCloneReq] = useState<{ toYear: number; fromYear: number } | null>(null);

  const reload = async (): Promise<void> => {
    setYears(await api.seasonYears());
    setFindings(await api.validation(seasonYear));
  };

  useEffect(() => {
    reload().catch((e) => setMsg(String(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seasonYear]);

  const errors = findings.filter((f) => f.severity === "error");
  const warnings = findings.filter((f) => f.severity === "warning");
  const canApprove = me?.role === "approver" || me?.role === "admin";
  const canEdit = me?.role === "editor" || canApprove;

  const maxYear = years.length > 0 ? Math.max(...years.map((y) => y.season_year)) : seasonYear;
  const nextYear = maxYear + 1;

  const activeYear = years.find((y) => y.season_year === seasonYear);
  // The next snapshot version this publish will create (first publish is v1).
  const nextVersion = (activeYear?.version ?? 0) + 1;

  // A publish that creates v2+ is a mid-year correction of an already-live snapshot.
  const isCorrection = nextVersion >= 2;

  const startPublish = (): void => {
    setNote(""); setCorrectionSummary(""); setAffectedSpecies(""); setAffectedDistricts(""); setMsg(null); setConfirming(true);
  };
  const cancelPublish = (): void => { setConfirming(false); setNote(""); };

  const doPublish = async (): Promise<void> => {
    if (!note.trim()) return;
    setBusy(true);
    setMsg(null);
    try {
      await api.publish(
        seasonYear,
        note.trim(),
        isCorrection
          ? {
              correction_summary: correctionSummary.trim() || undefined,
              affected_species: affectedSpecies.trim() || undefined,
              affected_districts: affectedDistricts.trim() || undefined,
            }
          : undefined,
      );
      setConfirming(false);
      setNote("");
      setMsg(`Published ${seasonYear} (v${nextVersion}).`);
      await reload();
    } catch (err) {
      setMsg(err instanceof ApiError ? err.message : "Publish failed.");
    } finally {
      setBusy(false);
    }
  };

  const createNext = async (): Promise<void> => {
    setBusy(true);
    setMsg(null);
    try {
      await api.createSeasonYear({ season_year: nextYear, ...defaultYearDates(nextYear) });
      setMsg(`Created ${nextYear} (empty draft). Use "Clone from ${maxYear}" to carry the previous year forward.`);
      await reload();
      await refreshSeasonYears();
    } catch (err) {
      setMsg(err instanceof ApiError ? err.message : "Could not create the year.");
    } finally {
      setBusy(false);
    }
  };

  const clone = async (toYear: number, fromYear: number): Promise<void> => {
    setCloneReq(null);
    setBusy(true);
    setMsg(null);
    try {
      const [counts] = await api.cloneForward(toYear, fromYear);
      const summary = counts
        ? Object.entries(counts).map(([k, v]) => `${v} ${k.replace(/_/g, " ")}`).join(" · ")
        : "done";
      setMsg(`Cloned ${fromYear} → ${toYear}: ${summary}.`);
      await reload();
      await refreshSeasonYears();
    } catch (err) {
      setMsg(err instanceof ApiError ? err.message : "Clone failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section>
      <h2>Season years</h2>
      <p className="subtle">
        Everything is scoped to a season year (Mar 1 → end Feb; use the switcher, top-right).
        You edit as <span className="chip chip-draft">DRAFT</span> until an approver publishes —
        publishing materializes the immutable <span className="chip chip-published">PUBLISHED</span> snapshot the public app reads.
        See it as served on the <Link className="district-link" to="/live">Live snapshot</Link>.
        New here? See <Link className="district-link" to="/help/overview">How it fits together</Link>.
      </p>

      <LiveBanner seasonYear={seasonYear} />

      {cloneReq && (
        <ConfirmDialog
          heading={`Clone ${cloneReq.fromYear} into ${cloneReq.toYear}?`}
          body={<>Copies {cloneReq.fromYear}&rsquo;s hunt areas (districts + portions), instruments, opportunities, seasons, restrictions, district notes, and restricted areas into {cloneReq.toYear} as draft, with dates shifted a year for review. Fees and content sections are not copied — set those up separately. You then edit only what changed.</>}
          confirmLabel={`Clone from ${cloneReq.fromYear}`}
          danger={false}
          busy={busy}
          onConfirm={() => void clone(cloneReq.toYear, cloneReq.fromYear)}
          onCancel={() => setCloneReq(null)}
        />
      )}

      <div className="grid" style={{ marginTop: 16 }}>
        {years.map((y) => {
          const isEmptyDraft = y.status_code === "DRAFT" && y.instrument_count === "0";
          const prior = years.filter((o) => o.season_year < y.season_year).map((o) => o.season_year).sort((a, b) => b - a)[0];
          return (
            <div key={y.season_year} className="card accent-stripe">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <strong style={{ fontSize: "1.2rem" }}>{y.season_year}</strong>
                <span className={`chip chip-${y.status_code === "PUBLISHED" ? "published" : "draft"}`}>
                  {y.status_code}{y.version ? ` v${y.version}` : ""}
                </span>
              </div>
              <p className="subtle" style={{ marginTop: 8 }}>
                {y.instrument_count} instruments · {y.starts_on} → {y.ends_on}
              </p>
              {canEdit && isEmptyDraft && prior != null && (
                <>
                  <p className="subtle" style={{ marginTop: 4 }}>
                    Clone copies every {prior} instrument, opportunity, season, restriction, and note into this year — dates shifted a year for review.
                  </p>
                  <button className="secondary" disabled={busy} onClick={() => setCloneReq({ toYear: y.season_year, fromYear: prior })}>
                    Clone from {prior}
                  </button>
                </>
              )}
            </div>
          );
        })}
      </div>

      {canApprove && !years.some((y) => y.season_year === nextYear) && (
        <div className="card" style={{ marginTop: 12 }}>
          <strong>Start next year</strong>
          <p className="subtle" style={{ marginTop: 4 }}>
            Create an empty <b>{nextYear}</b> draft ({defaultYearDates(nextYear).starts_on} → {defaultYearDates(nextYear).ends_on}), then clone {maxYear} into it.
          </p>
          <button disabled={busy} onClick={createNext}>Create {nextYear}</button>
        </div>
      )}

      <div className="card" style={{ marginTop: 20 }}>
        <h3 style={{ marginTop: 0 }}>
          <Link className="district-link" to="/help/glossary#validation">Validation</Link> — {seasonYear}
        </h3>
        <p className="subtle" style={{ marginTop: 0 }}>
          <strong>Blocking</strong> findings must be fixed before you can <Link className="district-link" to="/help/glossary#publish">publish</Link>; <strong>warnings</strong> are advisory and don't block.
        </p>
        {errors.length === 0 && warnings.length === 0 && <p className="subtle">No findings. Ready to publish.</p>}
        {errors.length > 0 && (
          <p><span className="chip chip-error">{errors.length} blocking</span> must be fixed before publishing.</p>
        )}
        {warnings.length > 0 && (
          <p><span className="chip chip-warning">{warnings.length} warnings</span> (non-blocking)</p>
        )}
        <ul>
          {findings.slice(0, 8).map((f, i) => (
            <li key={i} className="subtle">
              [{f.severity}] {f.message} {f.anchor ? `(${f.anchor})` : ""}
            </li>
          ))}
        </ul>

        {confirming ? (
          <div className="card confirm-panel" style={{ marginTop: 12 }}>
            <strong>
              {isCorrection ? `Publish a correction — this creates snapshot v${nextVersion}` : `Publish ${seasonYear} — this creates snapshot v${nextVersion}`}
            </strong>
            <p className="subtle" style={{ marginTop: 4 }}>
              {errors.length} blocking · {warnings.length} warnings. This flips {seasonYear}'s draft rows to published and writes the immutable snapshot the public app reads. It can't be undone (a later change re-publishes as a new version).
            </p>
            {isCorrection && (
              <p className="subtle" style={{ marginTop: 4 }}>
                {seasonYear} is already live at v{nextVersion - 1} — this is a <strong>mid-year correction</strong>. Your edits go out immediately and the correction is logged under Corrections &amp; updates + shown to hunters in the app.
              </p>
            )}
            <label htmlFor="changelog-note" style={{ marginTop: 8 }}>Changelog note (required)</label>
            <input
              id="changelog-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="What changed in this version?"
              style={{ width: "100%" }}
              autoFocus
            />
            {isCorrection && (
              <>
                <label htmlFor="correction-summary" style={{ marginTop: 8 }}>Correction summary (shown to hunters)</label>
                <input
                  id="correction-summary"
                  value={correctionSummary}
                  onChange={(e) => setCorrectionSummary(e.target.value)}
                  placeholder="e.g. HD 380 antlerless elk quota corrected from 50 to 75"
                  style={{ width: "100%" }}
                />
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                  <div>
                    <label htmlFor="affected-species">Affected species</label>
                    <input id="affected-species" value={affectedSpecies} onChange={(e) => setAffectedSpecies(e.target.value)} placeholder="deer, elk" />
                  </div>
                  <div style={{ flex: 1, minWidth: 160 }}>
                    <label htmlFor="affected-districts">Affected districts</label>
                    <input id="affected-districts" value={affectedDistricts} onChange={(e) => setAffectedDistricts(e.target.value)} placeholder="380, 590" style={{ width: "100%" }} />
                  </div>
                </div>
              </>
            )}
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button onClick={doPublish} disabled={busy || !note.trim()}>{busy ? "Publishing…" : isCorrection ? `Publish correction (v${nextVersion})` : `Publish ${seasonYear}`}</button>
              <button className="secondary" onClick={cancelPublish} disabled={busy}>Cancel</button>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button onClick={startPublish} disabled={busy || errors.length > 0 || !canApprove} title={canApprove ? "" : "Approver role required"}>
              Publish {seasonYear}
            </button>
          </div>
        )}
        {!canApprove && <p className="subtle" style={{ marginTop: 8 }}>Publishing requires the approver role.</p>}
        {msg && <p style={{ marginTop: 12 }}>{msg}</p>}
      </div>
    </section>
  );
}
