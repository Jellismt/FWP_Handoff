/**
 * @file DistrictDetailScreen.tsx
 * @module engage-mt/staff
 * @description The money screen — mirrors the printed per-HD table (species sections,
 *              5 season-window columns, quota + commission range, restrictions) and makes
 *              the whole row editable for editors: per-opportunity season-window editing,
 *              a restrictions editor, instrument-metadata editing (quota / apply-by / name),
 *              adding a new opportunity (with an inline new-instrument path), district-note
 *              create/edit, archive with undo, and optimistic-lock conflict handling.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-03
 * @updated 2026-07-05
 * @version 1.3.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import { DEA_SPECIES, INSTRUMENT_TYPES } from "@engage-mt/regs-shared";
import {
  api, type DistrictDetail, type DistrictNoteRow, type OpportunityRow, type WindowInputDto,
  type RestrictionInputDto, type RestrictionTypeRow, type HuntAreaRow, type InstrumentRow, type AnimalClassRow,
} from "../api.js";
import { useApp } from "../store.js";
import { Toast, conflictMsg, conflictToast, type ToastState } from "../components/ui.js";

const SEASON_ORDER = ["EARLY", "ARCHERY", "GENERAL", "HERITAGE_ML", "LATE", "SEASON"];
const SEASON_LABEL: Record<string, string> = {
  EARLY: "Early", ARCHERY: "Archery", GENERAL: "General", HERITAGE_ML: "Muzzleloader", LATE: "Late", SEASON: "Season",
};

function windowText(opp: OpportunityRow, seasonType: string): string {
  const w = opp.windows.filter((x) => x.season_type === seasonType);
  return w.length ? w.map((x) => x.raw_range ?? `${x.starts_on}→${x.ends_on}`).join(", ") : "–";
}
function quotaText(opp: OpportunityRow): string {
  if (opp.quota_unlimited) return "UNL";
  const parts: string[] = [];
  if (opp.quota_current != null) parts.push(String(opp.quota_current));
  if (opp.quota_min != null && opp.quota_max != null) parts.push(`(${opp.quota_min}–${opp.quota_max})`);
  return parts.join(" ") || "–";
}
const numOrNull = (v: string): number | null => (v.trim() === "" ? null : Number(v));

/** Editor for one opportunity's season windows (all five, one panel). */
function WindowEditor({ opp, seasons, onSaved, onCancel, onReload }: {
  opp: OpportunityRow; seasons: string[];
  onSaved: (msg: string) => void; onCancel: () => void; onReload: () => void;
}) {
  const seed = useMemo(() => {
    const m: Record<string, { starts_on: string; ends_on: string }> = {};
    for (const s of seasons) {
      const w = opp.windows.find((x) => x.season_type === s);
      m[s] = { starts_on: w?.starts_on ?? "", ends_on: w?.ends_on ?? "" };
    }
    return m;
  }, [opp, seasons]);
  const [rows, setRows] = useState(seed);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const set = (s: string, k: "starts_on" | "ends_on", v: string) =>
    setRows((r) => ({ ...r, [s]: { ...r[s]!, [k]: v } }));

  const save = async () => {
    setBusy(true); setErr(null);
    const windows: WindowInputDto[] = [];
    for (const s of seasons) {
      const r = rows[s]!;
      if (r.starts_on && r.ends_on) {
        if (r.ends_on < r.starts_on) { setErr(`${SEASON_LABEL[s]}: end is before start.`); setBusy(false); return; }
        windows.push({ season_type_code: s, window_seq: 1, starts_on: r.starts_on, ends_on: r.ends_on });
      }
    }
    try {
      await api.putWindows(opp.opportunity_id, opp.updated_at ?? "", windows);
      onSaved(`Saved seasons for ${opp.instr_code}.`);
    } catch (e) { setErr(conflictMsg(e, "reload the district")); } finally { setBusy(false); }
  };

  return (
    <EditorRow>
      <strong>Edit seasons — {opp.instr_code} · {opp.legal_animal}</strong>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 8 }}>
        {seasons.map((s) => (
          <div key={s} style={{ minWidth: 190 }}>
            <label>{SEASON_LABEL[s]}</label>
            <div style={{ display: "flex", gap: 4 }}>
              <input type="date" value={rows[s]!.starts_on} onChange={(e) => set(s, "starts_on", e.target.value)} />
              <input type="date" value={rows[s]!.ends_on} onChange={(e) => set(s, "ends_on", e.target.value)} />
            </div>
          </div>
        ))}
      </div>
      <EditorActions busy={busy} err={err} onSave={save} onCancel={onCancel} saveLabel="Save seasons" onReload={onReload} />
    </EditorRow>
  );
}

/** Editor for one opportunity's structured restrictions (replace-all). */
function RestrictionEditor({ opp, restrTypes, onSaved, onCancel, onReload }: {
  opp: OpportunityRow; restrTypes: RestrictionTypeRow[];
  onSaved: (msg: string) => void; onCancel: () => void; onReload: () => void;
}) {
  const [rows, setRows] = useState<RestrictionInputDto[]>(
    () => opp.restrictions.map((r) => ({ restr_code: r.restr_code, value_text: r.value_text, raw_text: r.raw_text })),
  );
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const needsValue = (code: string) => restrTypes.find((t) => t.restr_code === code)?.needs_value === 1;

  const setRow = (i: number, patch: Partial<RestrictionInputDto>) =>
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const save = async () => {
    setBusy(true); setErr(null);
    const clean = rows.filter((r) => r.restr_code);
    try {
      await api.putRestrictions(opp.opportunity_id, opp.updated_at ?? "", clean.map((r) => ({
        restr_code: r.restr_code,
        value_text: r.value_text?.toString().trim() ? r.value_text : null,
        raw_text: r.raw_text?.toString().trim() ? r.raw_text : r.restr_code,
      })));
      onSaved(`Saved restrictions for ${opp.instr_code}.`);
    } catch (e) { setErr(conflictMsg(e, "reload the district")); } finally { setBusy(false); }
  };

  return (
    <EditorRow>
      <strong>Edit restrictions — {opp.instr_code} · {opp.legal_animal}</strong>
      <div style={{ marginTop: 8 }}>
        {rows.map((r, i) => (
          <div key={i} style={{ display: "flex", gap: 6, marginBottom: 6, flexWrap: "wrap", alignItems: "center" }}>
            <select value={r.restr_code} onChange={(e) => setRow(i, { restr_code: e.target.value })} style={{ minWidth: 200 }}>
              <option value="">— code —</option>
              {restrTypes.map((t) => <option key={t.restr_code} value={t.restr_code}>{t.restr_code} · {t.display_name}</option>)}
            </select>
            <input placeholder="value" value={r.value_text ?? ""} disabled={!needsValue(r.restr_code)}
              onChange={(e) => setRow(i, { value_text: e.target.value })} style={{ width: 120 }} />
            <input placeholder="verbatim text" value={r.raw_text ?? ""}
              onChange={(e) => setRow(i, { raw_text: e.target.value })} style={{ flex: 1, minWidth: 200 }} />
            <button className="secondary" type="button" onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}>Remove</button>
          </div>
        ))}
        <button className="secondary" type="button" onClick={() => setRows((rs) => [...rs, { restr_code: "", value_text: null, raw_text: null }])}>+ Add restriction</button>
      </div>
      <EditorActions busy={busy} err={err} onSave={save} onCancel={onCancel} saveLabel="Save restrictions" onReload={onReload} />
    </EditorRow>
  );
}

/** Editor for the shared license instrument's metadata (quota / dates / name). */
function InstrumentEditor({ opp, onSaved, onCancel, onReload }: {
  opp: OpportunityRow; onSaved: (msg: string) => void; onCancel: () => void; onReload: () => void;
}) {
  const [displayName, setDisplayName] = useState(opp.instrument_name);
  const [quotaCurrent, setQuotaCurrent] = useState(opp.quota_current?.toString() ?? "");
  const [quotaMin, setQuotaMin] = useState(opp.quota_min?.toString() ?? "");
  const [quotaMax, setQuotaMax] = useState(opp.quota_max?.toString() ?? "");
  const [applyBy, setApplyBy] = useState(opp.apply_by ?? "");
  const [otcFrom, setOtcFrom] = useState(opp.otc_from ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const save = async () => {
    setBusy(true); setErr(null);
    try {
      await api.patchInstrument(opp.instrument_id, {
        display_name: displayName,
        quota_current: numOrNull(quotaCurrent),
        quota_min: numOrNull(quotaMin),
        quota_max: numOrNull(quotaMax),
        apply_by: applyBy.trim() === "" ? null : applyBy,
        otc_from: otcFrom.trim() === "" ? null : otcFrom,
        expected_updated_at: opp.instrument_updated_at ?? "",
      });
      onSaved(`Saved instrument ${opp.instr_code}.`);
    } catch (e) { setErr(conflictMsg(e, "reload the district")); } finally { setBusy(false); }
  };

  return (
    <EditorRow>
      <strong>Edit instrument — {opp.instr_code}</strong>
      <p className="subtle" style={{ margin: "4px 0 8px" }}>
        This <Link className="district-link" to="/help/glossary#instrument">instrument</Link> is shared by every opportunity that uses it — changes apply everywhere it appears.
      </p>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <div style={{ minWidth: 240 }}><label>Display name</label><input value={displayName} onChange={(e) => setDisplayName(e.target.value)} style={{ width: "100%" }} /></div>
        <div><label>Quota</label><input type="number" value={quotaCurrent} onChange={(e) => setQuotaCurrent(e.target.value)} style={{ width: 90 }} /></div>
        <div><label>Quota min</label><input type="number" value={quotaMin} onChange={(e) => setQuotaMin(e.target.value)} style={{ width: 90 }} /></div>
        <div><label>Quota max</label><input type="number" value={quotaMax} onChange={(e) => setQuotaMax(e.target.value)} style={{ width: 90 }} /></div>
        <div><label>Apply by</label><input type="date" value={applyBy} onChange={(e) => setApplyBy(e.target.value)} /></div>
        <div><label>OTC from</label><input type="date" value={otcFrom} onChange={(e) => setOtcFrom(e.target.value)} /></div>
      </div>
      <EditorActions busy={busy} err={err} onSave={save} onCancel={onCancel} saveLabel="Save instrument" onReload={onReload} />
    </EditorRow>
  );
}

/** Add-opportunity form: pick (or create) an instrument, an animal class, a hunt area. */
function AddOpportunityForm({ species, seasonYear, districtId, huntAreas, onSaved, onCancel }: {
  species: string; seasonYear: number; districtId: string | null; huntAreas: HuntAreaRow[];
  onSaved: (msg: string) => void; onCancel: () => void;
}) {
  const [instruments, setInstruments] = useState<InstrumentRow[]>([]);
  const [classes, setClasses] = useState<AnimalClassRow[]>([]);
  const [instrumentId, setInstrumentId] = useState("");
  const [newInstr, setNewInstr] = useState(false);
  const [ni, setNi] = useState({ instr_code: "", display_name: "", instr_type_code: "PERMIT", is_draw: true, quota_current: "", quota_min: "", quota_max: "" });
  const [animalClassId, setAnimalClassId] = useState("");
  const [huntAreaId, setHuntAreaId] = useState("");
  const [splitSeq, setSplitSeq] = useState("1");
  const [validityNote, setValidityNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    void api.instruments(seasonYear, { species }).then(setInstruments).catch(() => setInstruments([]));
    void api.animalClasses(species).then(setClasses).catch(() => setClasses([]));
  }, [seasonYear, species]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      let instrId = instrumentId;
      if (newInstr) {
        const [created] = await api.createInstrument({
          season_year: seasonYear, instr_type_code: ni.instr_type_code, species_code: species,
          instr_code: ni.instr_code, display_name: ni.display_name, is_draw: ni.is_draw,
          quota_current: numOrNull(ni.quota_current), quota_min: numOrNull(ni.quota_min), quota_max: numOrNull(ni.quota_max),
        });
        instrId = created!.instrument_id;
      }
      if (!instrId) { setErr("Pick or create an instrument."); setBusy(false); return; }
      if (!animalClassId) { setErr("Pick a legal animal class."); setBusy(false); return; }
      if (!huntAreaId) { setErr("Pick a hunt area."); setBusy(false); return; }
      await api.createOpportunity({
        season_year: seasonYear, instrument_id: instrId, animal_class_id: animalClassId,
        hunt_area_id: huntAreaId, home_district_id: districtId, split_seq: Number(splitSeq) || 1,
        validity_note: validityNote.trim() === "" ? null : validityNote, windows: [], restrictions: [],
      });
      onSaved(`Added ${species} opportunity.`);
    } catch (e2) { setErr(conflictMsg(e2)); } finally { setBusy(false); }
  };

  return (
    <form className="card" onSubmit={save} style={{ background: "#f7f9fb" }}>
      <strong style={{ textTransform: "capitalize" }}>Add {species} opportunity</strong>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 8 }}>
        {!newInstr ? (
          <div style={{ minWidth: 280 }}>
            <label>Instrument</label>
            <select value={instrumentId} onChange={(e) => setInstrumentId(e.target.value)} style={{ width: "100%" }}>
              <option value="">— select —</option>
              {instruments.map((i) => <option key={i.instrument_id} value={i.instrument_id}>{i.instr_code} · {i.display_name}</option>)}
            </select>
            <button className="secondary" type="button" style={{ marginTop: 6 }} onClick={() => setNewInstr(true)}>New instrument…</button>
          </div>
        ) : (
          <div className="card" style={{ margin: 0, minWidth: 320 }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <div><label>Code</label><input value={ni.instr_code} onChange={(e) => setNi({ ...ni, instr_code: e.target.value })} style={{ width: 110 }} /></div>
              <div style={{ flex: 1, minWidth: 160 }}><label>Name</label><input value={ni.display_name} onChange={(e) => setNi({ ...ni, display_name: e.target.value })} style={{ width: "100%" }} /></div>
              <div><label>Type</label><select value={ni.instr_type_code} onChange={(e) => setNi({ ...ni, instr_type_code: e.target.value })}>{INSTRUMENT_TYPES.map((t) => <option key={t}>{t}</option>)}</select></div>
              <div><label>Draw?</label><input type="checkbox" checked={ni.is_draw} onChange={(e) => setNi({ ...ni, is_draw: e.target.checked })} /></div>
              <div><label>Quota</label><input type="number" value={ni.quota_current} onChange={(e) => setNi({ ...ni, quota_current: e.target.value })} style={{ width: 80 }} /></div>
              <div><label>Min</label><input type="number" value={ni.quota_min} onChange={(e) => setNi({ ...ni, quota_min: e.target.value })} style={{ width: 70 }} /></div>
              <div><label>Max</label><input type="number" value={ni.quota_max} onChange={(e) => setNi({ ...ni, quota_max: e.target.value })} style={{ width: 70 }} /></div>
            </div>
            <button className="secondary" type="button" style={{ marginTop: 6 }} onClick={() => setNewInstr(false)}>Use existing instead</button>
          </div>
        )}
        <div style={{ minWidth: 220 }}>
          <label>Legal animal</label>
          <select value={animalClassId} onChange={(e) => setAnimalClassId(e.target.value)} style={{ width: "100%" }}>
            <option value="">— select —</option>
            {classes.map((c) => <option key={c.animal_class_id} value={c.animal_class_id}>{c.display_label}</option>)}
          </select>
        </div>
        <div style={{ minWidth: 220 }}>
          <label>Hunt area</label>
          <select value={huntAreaId} onChange={(e) => setHuntAreaId(e.target.value)} style={{ width: "100%" }}>
            <option value="">— select —</option>
            {huntAreas.map((h) => <option key={h.hunt_area_id} value={h.hunt_area_id}>{h.area_code} ({h.area_kind})</option>)}
          </select>
        </div>
        <div><label>Split #</label><input type="number" value={splitSeq} onChange={(e) => setSplitSeq(e.target.value)} style={{ width: 70 }} /></div>
        <div style={{ flex: 1, minWidth: 200 }}><label>Validity note</label><input value={validityNote} onChange={(e) => setValidityNote(e.target.value)} style={{ width: "100%" }} /></div>
      </div>
      {err && <p className="error-text" style={{ marginTop: 8 }}>{err}</p>}
      <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
        <button type="submit" disabled={busy}>{busy ? "Adding…" : "Add opportunity"}</button>
        <button className="secondary" type="button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

/** Shared collapsible editor row wrapper + action bar (keeps all inline editors uniform). */
function EditorRow({ children }: { children: React.ReactNode }) {
  return <tr><td colSpan={12} style={{ background: "#f7f9fb" }}><div style={{ padding: "8px 4px" }}>{children}</div></td></tr>;
}
function EditorActions({ busy, err, onSave, onCancel, saveLabel, onReload }: {
  busy: boolean; err: string | null; onSave: () => void; onCancel: () => void; saveLabel: string;
  onReload?: () => void;
}) {
  // A "reload the district" hint means an optimistic-lock conflict — offer the re-fetch.
  const isConflict = Boolean(err && err.toLowerCase().includes("reload"));
  return (
    <>
      {err && (
        <p className="error-text" style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center" }} role="alert">
          <span>{err}</span>
          {isConflict && onReload && <button className="secondary" onClick={onReload}>Reload</button>}
        </p>
      )}
      <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
        <button onClick={onSave} disabled={busy}>{busy ? "Saving…" : saveLabel}</button>
        <button className="secondary" onClick={onCancel}>Cancel</button>
      </div>
    </>
  );
}

type EditKind = "seasons" | "restrictions" | "instrument";

export function DistrictDetailScreen() {
  const { code } = useParams();
  const [sp] = useSearchParams();
  const geography = sp.get("geo") ?? "HD";
  const focus = sp.get("focus");
  const seasonYear = useApp((s) => s.seasonYear);
  const me = useApp((s) => s.me);
  const canEdit = me?.role === "editor" || me?.role === "approver" || me?.role === "admin";
  const [detail, setDetail] = useState<DistrictDetail | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ oppId: string; kind: EditKind } | null>(null);
  const [adding, setAdding] = useState<string | null>(null); // species being added to
  const [toast, setToast] = useState<ToastState | null>(null);
  const [restrTypes, setRestrTypes] = useState<RestrictionTypeRow[]>([]);
  const [huntAreas, setHuntAreas] = useState<HuntAreaRow[]>([]);

  const load = useCallback(() => {
    if (!code) return;
    api.districtDetail(code, seasonYear, geography)
      .then((rows) => setDetail(rows[0] ?? null))
      .catch((e) => setErr(String(e)));
  }, [code, seasonYear, geography]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!canEdit) return;
    void api.restrictionTypes().then(setRestrTypes).catch(() => undefined);
    void api.huntAreas(seasonYear).then(setHuntAreas).catch(() => undefined);
  }, [canEdit, seasonYear]);

  const bySpecies = useMemo(() => {
    const m = new Map<string, OpportunityRow[]>();
    for (const o of detail?.opportunities ?? []) {
      const list = m.get(o.species_code) ?? [];
      list.push(o); m.set(o.species_code, list);
    }
    return [...m.entries()];
  }, [detail]);

  const toggle = (oppId: string, kind: EditKind) =>
    setEditing((cur) => (cur && cur.oppId === oppId && cur.kind === kind ? null : { oppId, kind }));

  const archive = async (o: OpportunityRow) => {
    try {
      await api.archiveOpportunity(o.opportunity_id, o.updated_at ?? "");
      setToast({ msg: `Archived ${o.instr_code} · ${o.legal_animal}.`, undo: async () => { await api.restoreOpportunity(o.opportunity_id); load(); } });
      load();
    } catch (e) { setToast(conflictToast(e, "reload the district", load)); }
  };

  if (err) return <p className="error-text">{err}</p>;
  if (!detail) return <p className="subtle">Loading district {code}…</p>;

  const speciesList = bySpecies.length > 0 ? bySpecies.map(([s]) => s) : DEA_SPECIES.slice();

  return (
    <section>
      <Link className="district-link" to="/districts">← Districts</Link>
      <h2 style={{ marginTop: 8 }}>HD {code}</h2>
      <p className="subtle">
        This mirrors the printed page for the district: one section per species, one row per{" "}
        <Link className="district-link" to="/help/glossary#opportunity">opportunity</Link>. The columns are the five season windows; edits save as draft until publish.
      </p>
      <p className="subtle">
        {detail.opportunities.length} opportunities · {seasonYear}
        {canEdit ? " · editing enabled" : ` · read-only — your role is ${me?.role ?? "viewer"}`}
      </p>

      <Toast toast={toast} onDismiss={() => setToast(null)} />

      <NotesCard detail={detail} seasonYear={seasonYear} geography={geography} canEdit={canEdit}
        onChanged={(msg) => { setToast({ msg }); load(); }} onError={(msg) => setToast({ msg })} />

      {canEdit && (
        <div className="card" style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <span className="subtle">Add opportunity:</span>
          {speciesList.map((s) => (
            <button key={s} className="secondary" style={{ textTransform: "capitalize" }} onClick={() => setAdding(adding === s ? null : s)}>{s}</button>
          ))}
        </div>
      )}
      {adding && canEdit && (
        <AddOpportunityForm species={adding} seasonYear={seasonYear} districtId={detail.district_id} huntAreas={huntAreas}
          onSaved={(msg) => { setAdding(null); setToast({ msg }); load(); }} onCancel={() => setAdding(null)} />
      )}

      {bySpecies.map(([species, opps]) => {
        const cols = SEASON_ORDER.filter((s) => s !== "SEASON" || species === "antelope");
        return (
          <div key={species} className="card">
            <h3 style={{ marginTop: 0, textTransform: "capitalize", color: "var(--fwp-blue)" }}>{species}</h3>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th title="The shared license or permit. 'draw' = awarded by drawing.">Instrument</th>
                    <th title="What may legally be taken — the sex/age/antler class.">Legal animal</th>
                    {cols.map((s) => <th key={s} title={`${SEASON_LABEL[s]} season window date range`}>{SEASON_LABEL[s]}</th>)}
                    <th title="Current quota (commission min–max in parentheses). UNL = unlimited.">Quota</th>
                    <th title="Coded restrictions on the opportunity, plus any validity note.">Restrictions</th>{canEdit && <th></th>}
                  </tr>
                </thead>
                <tbody>
                  {opps.map((o) => (
                    <Fragment key={o.opportunity_id}>
                      <tr style={focus && o.instr_code === focus ? { background: "#fff6d9" } : undefined}>
                        <td><span className="chip chip-species">{o.instr_code}</span> {o.instrument_name}{o.is_draw ? <span className="subtle"> · draw</span> : null}</td>
                        <td>{o.legal_animal}</td>
                        {cols.map((s) => <td key={s}>{windowText(o, s)}</td>)}
                        <td>{quotaText(o)}</td>
                        <td className="subtle">
                          {o.restrictions.map((r) => r.restr_code).filter((c) => c !== "OTHER").join(", ")}
                          {o.validity_note ? ` ${o.validity_note}` : ""}
                        </td>
                        {canEdit && (
                          <td style={{ whiteSpace: "nowrap" }}>
                            <button className="secondary" onClick={() => toggle(o.opportunity_id, "seasons")}>Seasons</button>
                            <button className="secondary" style={{ marginLeft: 6 }} onClick={() => toggle(o.opportunity_id, "restrictions")}>Restrictions</button>
                            <button className="secondary" style={{ marginLeft: 6 }} onClick={() => toggle(o.opportunity_id, "instrument")}>Instrument</button>
                            <button className="danger" style={{ marginLeft: 6 }} onClick={() => archive(o)}>Archive</button>
                          </td>
                        )}
                      </tr>
                      {editing?.oppId === o.opportunity_id && editing.kind === "seasons" && (
                        <WindowEditor opp={o} seasons={cols}
                          onSaved={(msg) => { setEditing(null); setToast({ msg }); load(); }} onCancel={() => setEditing(null)}
                          onReload={() => { setEditing(null); load(); }} />
                      )}
                      {editing?.oppId === o.opportunity_id && editing.kind === "restrictions" && (
                        <RestrictionEditor opp={o} restrTypes={restrTypes}
                          onSaved={(msg) => { setEditing(null); setToast({ msg }); load(); }} onCancel={() => setEditing(null)}
                          onReload={() => { setEditing(null); load(); }} />
                      )}
                      {editing?.oppId === o.opportunity_id && editing.kind === "instrument" && (
                        <InstrumentEditor opp={o}
                          onSaved={(msg) => { setEditing(null); setToast({ msg }); load(); }} onCancel={() => setEditing(null)}
                          onReload={() => { setEditing(null); load(); }} />
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </section>
  );
}

/** District notes card with per-note edit + add (editor-gated). */
function NotesCard({ detail, seasonYear, geography, canEdit, onChanged, onError }: {
  detail: DistrictDetail; seasonYear: number; geography: string; canEdit: boolean;
  onChanged: (msg: string) => void; onError: (msg: string) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState("");
  const [species, setSpecies] = useState<string>("");

  const startEdit = (n: DistrictNoteRow) => { setEditingId(n.note_id); setText(n.note_text); setSpecies(n.species_code ?? ""); setAdding(false); };
  const startAdd = () => { setAdding(true); setEditingId(null); setText(""); setSpecies(""); };

  const saveEdit = async (n: DistrictNoteRow) => {
    try {
      await api.patchNote(n.note_id, { note_text: text, species_code: species === "" ? null : species, expected_updated_at: n.updated_at ?? "" });
      setEditingId(null); onChanged("Saved note.");
    } catch (e) { onError(conflictMsg(e)); }
  };
  const saveAdd = async () => {
    if (!text.trim()) return;
    try {
      await api.createNote({ season_year: seasonYear, district_code: detail.district_code, geography_code: geography, species_code: species === "" ? null : species, note_text: text });
      setAdding(false); onChanged("Added note.");
    } catch (e) { onError(conflictMsg(e)); }
  };

  if (!canEdit && detail.notes.length === 0) return null;

  return (
    <div className="card">
      <strong>Notes</strong>
      <ul style={{ marginTop: 6 }}>
        {detail.notes.map((n) => (
          <li key={n.note_id} style={{ marginBottom: 6 }}>
            {editingId === n.note_id ? (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                <SpeciesSelect value={species} onChange={setSpecies} />
                <input value={text} onChange={(e) => setText(e.target.value)} style={{ flex: 1, minWidth: 220 }} />
                <button onClick={() => saveEdit(n)}>Save</button>
                <button className="secondary" onClick={() => setEditingId(null)}>Cancel</button>
              </div>
            ) : (
              <span className="subtle">
                {n.species_code ? <span className="chip chip-species" style={{ marginRight: 6 }}>{n.species_code}</span> : null}
                {n.note_text}
                {canEdit && <button className="secondary" style={{ marginLeft: 8 }} onClick={() => startEdit(n)}>Edit</button>}
              </span>
            )}
          </li>
        ))}
        {detail.notes.length === 0 && <li className="subtle">No notes.</li>}
      </ul>
      {canEdit && (adding ? (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          <SpeciesSelect value={species} onChange={setSpecies} />
          <input placeholder="Note text" value={text} onChange={(e) => setText(e.target.value)} style={{ flex: 1, minWidth: 220 }} />
          <button onClick={saveAdd}>Add</button>
          <button className="secondary" onClick={() => setAdding(false)}>Cancel</button>
        </div>
      ) : <button className="secondary" onClick={startAdd}>Add note</button>)}
    </div>
  );
}

function SpeciesSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">All species</option>
      {DEA_SPECIES.map((s) => <option key={s} value={s}>{s}</option>)}
    </select>
  );
}
