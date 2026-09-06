/**
 * @file ImportantDatesScreen.tsx
 * @module engage-mt/staff
 * @description Important-dates editor (book p.11): season dates, application/purchase
 *              deadlines, drawing results, and purchase windows. Grouped by date kind;
 *              editors can add rows and edit label/dates/note inline (optimistic-locked).
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-07
 * @updated 2026-07-07
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { Fragment, useCallback, useEffect, useState } from "react";
import { api, type ImportantDateRow } from "../api.js";
import { useApp } from "../store.js";
import { FormCard, conflictMsg } from "../components/ui.js";

const KINDS = ["SEASON", "DEADLINE", "DRAWING_RESULT", "REFUND", "PURCHASE_WINDOW"];
const KIND_LABEL: Record<string, string> = {
  SEASON: "Season dates", DEADLINE: "Application / purchase deadlines",
  DRAWING_RESULT: "Drawing results", REFUND: "Refunds", PURCHASE_WINDOW: "Purchase windows",
};

/** Inline label/date/note editor for one important-date row. */
function DateEditor({ row, onSaved, onCancel }: { row: ImportantDateRow; onSaved: () => void; onCancel: () => void }) {
  const [f, setF] = useState({ label: row.label, species_scope: row.species_scope ?? "", starts_on: row.starts_on ?? "", ends_on: row.ends_on ?? "", note: row.note ?? "", sort_order: String(row.sort_order) });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const save = async () => {
    setBusy(true); setErr(null);
    try {
      await api.patchImportantDate(row.important_date_id, {
        expected_updated_at: row.updated_at, label: f.label, species_scope: f.species_scope || null,
        starts_on: f.starts_on || null, ends_on: f.ends_on || null, note: f.note || null, sort_order: Number(f.sort_order) || 0,
      });
      onSaved();
    } catch (e) { setErr(conflictMsg(e, "reload")); } finally { setBusy(false); }
  };
  return (
    <tr><td colSpan={5} style={{ background: "#f7f9fb" }}>
      <div style={{ padding: "8px 4px", display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div style={{ minWidth: 240 }}><label>Label</label><input value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} style={{ width: "100%" }} /></div>
        <div><label>Species scope</label><input value={f.species_scope} onChange={(e) => setF({ ...f, species_scope: e.target.value })} style={{ width: 120 }} /></div>
        <div><label>Starts</label><input type="date" value={f.starts_on} onChange={(e) => setF({ ...f, starts_on: e.target.value })} /></div>
        <div><label>Ends</label><input type="date" value={f.ends_on} onChange={(e) => setF({ ...f, ends_on: e.target.value })} /></div>
        <div><label>Sort</label><input type="number" value={f.sort_order} onChange={(e) => setF({ ...f, sort_order: e.target.value })} style={{ width: 70 }} /></div>
        <div style={{ flex: 1, minWidth: 200 }}><label>Note</label><input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} style={{ width: "100%" }} /></div>
      </div>
      {err && <p className="error-text" role="alert" style={{ padding: "0 4px" }}>{err}</p>}
      <div style={{ padding: "0 4px 8px", display: "flex", gap: 8 }}>
        <button onClick={save} disabled={busy}>{busy ? "Saving…" : "Save"}</button>
        <button className="secondary" onClick={onCancel}>Cancel</button>
      </div>
    </td></tr>
  );
}

export function ImportantDatesScreen() {
  const seasonYear = useApp((s) => s.seasonYear);
  const me = useApp((s) => s.me);
  const canEdit = me?.role === "editor" || me?.role === "approver" || me?.role === "admin";
  const [rows, setRows] = useState<ImportantDateRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [nd, setNd] = useState({ date_code: "", date_kind: "SEASON", species_scope: "", label: "", starts_on: "", ends_on: "", note: "", sort_order: "0" });

  const reload = useCallback(() => api.importantDates(seasonYear).then(setRows).catch((e) => setErr(String(e))), [seasonYear]);
  useEffect(() => { void reload(); }, [reload]);
  if (err) return <p className="error-text">{err}</p>;

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createImportantDate({
        season_year: seasonYear, date_code: nd.date_code, date_kind: nd.date_kind, species_scope: nd.species_scope || null,
        label: nd.label, starts_on: nd.starts_on || null, ends_on: nd.ends_on || null, note: nd.note || null, sort_order: Number(nd.sort_order) || 0,
      });
      setAdding(false); setNd({ date_code: "", date_kind: "SEASON", species_scope: "", label: "", starts_on: "", ends_on: "", note: "", sort_order: "0" });
      await reload();
    } catch (e2) { setErr(conflictMsg(e2)); }
  };

  return (
    <section>
      <h2>Important dates — {seasonYear}</h2>
      <p className="subtle">{rows.length} entries — season dates, deadlines, drawing results, and purchase windows from the book's Important Dates page.</p>

      {canEdit && (adding ? (
        <FormCard title="Add date" onSubmit={add}>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <div><label>Code</label><input value={nd.date_code} onChange={(e) => setNd({ ...nd, date_code: e.target.value })} required style={{ width: 150 }} /></div>
            <div><label>Kind</label><select value={nd.date_kind} onChange={(e) => setNd({ ...nd, date_kind: e.target.value })}>{KINDS.map((k) => <option key={k}>{k}</option>)}</select></div>
            <div><label>Species scope</label><input value={nd.species_scope} onChange={(e) => setNd({ ...nd, species_scope: e.target.value })} style={{ width: 110 }} /></div>
            <div style={{ minWidth: 220 }}><label>Label</label><input value={nd.label} onChange={(e) => setNd({ ...nd, label: e.target.value })} required style={{ width: "100%" }} /></div>
            <div><label>Starts</label><input type="date" value={nd.starts_on} onChange={(e) => setNd({ ...nd, starts_on: e.target.value })} /></div>
            <div><label>Ends</label><input type="date" value={nd.ends_on} onChange={(e) => setNd({ ...nd, ends_on: e.target.value })} /></div>
            <div><label>Sort</label><input type="number" value={nd.sort_order} onChange={(e) => setNd({ ...nd, sort_order: e.target.value })} style={{ width: 70 }} /></div>
          </div>
          <div style={{ marginTop: 8, display: "flex", gap: 8 }}><button type="submit">Create</button><button className="secondary" type="button" onClick={() => setAdding(false)}>Cancel</button></div>
        </FormCard>
      ) : <button className="secondary" style={{ marginBottom: 12 }} onClick={() => setAdding(true)}>+ Add date</button>)}

      {KINDS.filter((k) => rows.some((r) => r.date_kind === k)).map((kind) => (
        <div key={kind} className="card table-scroll" style={{ marginBottom: 12 }}>
          <h3 style={{ padding: "8px 12px 0" }}>{KIND_LABEL[kind]}</h3>
          <table>
            <thead><tr><th>Label</th><th>Scope</th><th>Dates</th><th>Note</th>{canEdit && <th></th>}</tr></thead>
            <tbody>
              {rows.filter((r) => r.date_kind === kind).map((r) => (
                <Fragment key={r.important_date_id}>
                  <tr>
                    <td><strong>{r.label}</strong><div className="subtle" style={{ fontSize: "0.72rem" }}>{r.date_code}</div></td>
                    <td>{r.species_scope ?? "–"}</td>
                    <td>{r.starts_on ? (r.ends_on ? `${r.starts_on} → ${r.ends_on}` : r.starts_on) : "–"}</td>
                    <td className="subtle">{r.note ?? ""}</td>
                    {canEdit && <td><button className="secondary" onClick={() => setEditing(editing === r.important_date_id ? null : r.important_date_id)}>Edit</button></td>}
                  </tr>
                  {editing === r.important_date_id && <DateEditor row={r} onSaved={() => { setEditing(null); void reload(); }} onCancel={() => setEditing(null)} />}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      ))}
      {rows.length === 0 && <p className="subtle">No important dates for {seasonYear} yet.</p>}
    </section>
  );
}
