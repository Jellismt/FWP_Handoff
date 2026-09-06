/**
 * @file HuntAreasScreen.tsx
 * @module engage-mt/staff
 * @description Hunt-area manager (season-scoped): list areas with member + opportunity
 *              counts, create an area with district members, edit its code/definition,
 *              replace its members, re-point its opportunities onto another area, and
 *              delete it (guarded while still in use). All optimistic-locked.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-04
 * @updated 2026-07-14
 * @version 1.3.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { Fragment, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { HUNT_AREA_KINDS } from "@engage-mt/regs-shared";
import { api, type HuntAreaRow, type DistrictRow, type HuntAreaMemberRow, type PortionRow } from "../api.js";
import { useApp } from "../store.js";
import { ConfirmDialog, FormCard, Toast, conflictToast, type ToastState } from "../components/ui.js";

/** Checkbox grid of districts → an ordered list of selected district_ids. */
function DistrictPicker({ districts, selected, onToggle }: {
  districts: DistrictRow[]; selected: Set<string>; onToggle: (id: string) => void;
}) {
  return (
    <div style={{ maxHeight: 180, overflowY: "auto", display: "flex", flexWrap: "wrap", gap: 4, border: "1px solid var(--fwp-border)", borderRadius: 6, padding: 6 }}>
      {districts.map((d) => (
        <label key={d.district_id} style={{ display: "flex", gap: 4, alignItems: "center", fontSize: "0.8rem", minWidth: 90 }}>
          <input type="checkbox" checked={selected.has(d.district_id!)} onChange={() => onToggle(d.district_id!)} />
          {d.district_code}
        </label>
      ))}
    </div>
  );
}

export function HuntAreasScreen() {
  const seasonYear = useApp((s) => s.seasonYear);
  const me = useApp((s) => s.me);
  const canEdit = me?.role === "editor" || me?.role === "approver" || me?.role === "admin";
  const [rows, setRows] = useState<HuntAreaRow[]>([]);
  const [districts, setDistricts] = useState<DistrictRow[]>([]);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [adding, setAdding] = useState(false);
  const [na, setNa] = useState({ area_code: "", area_kind: "MULTI", definition_text: "" });
  const [naMembers, setNaMembers] = useState<Set<string>>(new Set());
  const [editId, setEditId] = useState<string | null>(null);
  const [edit, setEdit] = useState({ area_code: "", definition_text: "" });
  const [membersFor, setMembersFor] = useState<string | null>(null);
  const [memberSel, setMemberSel] = useState<Set<string>>(new Set());
  // Portion members have no district checkbox (portions are managed on their own
  // surface); we hold them so the full-replace save preserves them instead of dropping them.
  const [memberPortions, setMemberPortions] = useState<HuntAreaMemberRow[]>([]);
  const [allPortions, setAllPortions] = useState<PortionRow[]>([]);
  const [addPortionId, setAddPortionId] = useState("");
  const [repointFor, setRepointFor] = useState<string | null>(null);
  const [repointTo, setRepointTo] = useState("");
  const [delReq, setDelReq] = useState<HuntAreaRow | null>(null);

  const reload = () => api.huntAreas(seasonYear).then(setRows).catch((e) => setToast({ msg: String(e) }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void reload(); }, [seasonYear]);
  useEffect(() => { void api.districts(seasonYear).then(setDistricts).catch(() => undefined); }, [seasonYear]);
  useEffect(() => { void api.portions().then(setAllPortions).catch(() => undefined); }, []);

  /** Curation: add a portion member (idempotent) / drop one, mutating memberPortions. */
  const addPortion = (portionId: string) => {
    if (!portionId || memberPortions.some((m) => m.portion_id === portionId)) return;
    const p = allPortions.find((x) => x.portion_id === portionId);
    if (!p) return;
    setMemberPortions([...memberPortions, { member_seq: 0, district_id: null, district_code: null, portion_id: p.portion_id, portion_code: p.portion_code, portion_name: p.portion_name }]);
    setAddPortionId("");
  };
  const dropPortion = (portionId: string) => setMemberPortions(memberPortions.filter((m) => m.portion_id !== portionId));

  const toggle = (set: Set<string>, id: string, apply: (s: Set<string>) => void) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    apply(next);
  };

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createHuntArea({
        season_year: seasonYear, area_code: na.area_code, area_kind: na.area_kind,
        definition_text: na.definition_text || null,
        members: [...naMembers].map((district_id) => ({ district_id })),
      });
      setAdding(false); setNa({ area_code: "", area_kind: "MULTI", definition_text: "" }); setNaMembers(new Set());
      setToast({ msg: "Hunt area created." }); await reload();
    } catch (e2) { setToast(conflictToast(e2, "reload", reload)); }
  };

  const saveEdit = async (a: HuntAreaRow) => {
    try {
      await api.patchHuntArea(a.hunt_area_id, { area_code: edit.area_code, definition_text: edit.definition_text || null, expected_updated_at: a.updated_at });
      setEditId(null); setToast({ msg: "Saved." }); await reload();
    } catch (e) { setToast(conflictToast(e, "reload", reload)); }
  };

  const openMembers = async (a: HuntAreaRow) => {
    // Open the editor, then load the area's real members so the district checkboxes
    // pre-check what's actually served (mirrors RestrictedAreasScreen.openLinks).
    setMembersFor(a.hunt_area_id); setRepointFor(null); setEditId(null);
    setMemberSel(new Set()); setMemberPortions([]);
    const members = await api.huntAreaMembers(a.hunt_area_id).catch(() => [] as HuntAreaMemberRow[]);
    setMemberSel(new Set(members.filter((m) => m.district_id).map((m) => m.district_id!)));
    setMemberPortions(members.filter((m) => m.portion_id));
  };
  const saveMembers = async (a: HuntAreaRow) => {
    try {
      // Full-replace: send the checked districts AND the loaded portion members, so
      // replacing the district set never silently drops portions.
      const members = [
        ...[...memberSel].map((district_id) => ({ district_id })),
        ...memberPortions.map((p) => ({ portion_id: p.portion_id })),
      ];
      await api.putHuntAreaMembers(a.hunt_area_id, a.updated_at, members);
      setMembersFor(null); setToast({ msg: "Members replaced." }); await reload();
    } catch (e) { setToast(conflictToast(e, "reload", reload)); }
  };

  const doRepoint = async (a: HuntAreaRow) => {
    if (!repointTo) return;
    try {
      const [r] = await api.repointHuntArea(a.hunt_area_id, { to_hunt_area_id: repointTo });
      setRepointFor(null); setRepointTo(""); setToast({ msg: `Re-pointed ${r?.moved ?? 0} opportunities.` }); await reload();
    } catch (e) { setToast(conflictToast(e, "reload", reload)); }
  };

  const del = async (a: HuntAreaRow) => {
    setDelReq(null);
    try { await api.deleteHuntArea(a.hunt_area_id); setToast({ msg: `Deleted hunt area ${a.area_code}.` }); await reload(); }
    catch (e) { setToast(conflictToast(e, "reload", reload)); }
  };

  return (
    <section>
      <h2>Hunt areas — {seasonYear}</h2>
      <p className="subtle">
        A <Link className="district-link" to="/help/glossary#hunt-area">hunt area</Link> is the set of districts (or <Link className="district-link" to="/help/glossary#portion">portions</Link>) an opportunity is valid in — so one opportunity can span many districts without repeating rows. {rows.length} areas.
      </p>
      <Toast toast={toast} onDismiss={() => setToast(null)} />

      {delReq && (
        <ConfirmDialog
          heading={`Delete hunt area ${delReq.area_code}?`}
          body={<>Removes hunt area {delReq.area_code} and its member list. This can't be undone. (Only areas with no opportunities can be deleted — re-point any first.)</>}
          confirmLabel={`Delete ${delReq.area_code}`}
          busy={false}
          onConfirm={() => void del(delReq)}
          onCancel={() => setDelReq(null)}
        />
      )}

      {canEdit && (adding ? (
        <FormCard title="Add hunt area" onSubmit={create}>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <div><label>Code</label><input value={na.area_code} onChange={(e) => setNa({ ...na, area_code: e.target.value })} required /></div>
            <div><label>Kind</label><select value={na.area_kind} onChange={(e) => setNa({ ...na, area_kind: e.target.value })}>{HUNT_AREA_KINDS.map((k) => <option key={k}>{k}</option>)}</select></div>
            <div style={{ flex: 1, minWidth: 200 }}><label>Definition</label><input value={na.definition_text} onChange={(e) => setNa({ ...na, definition_text: e.target.value })} style={{ width: "100%" }} /></div>
          </div>
          <label style={{ marginTop: 8 }}>Member districts</label>
          <DistrictPicker districts={districts} selected={naMembers} onToggle={(id) => toggle(naMembers, id, setNaMembers)} />
          <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
            <button type="submit">Create</button>
            <button className="secondary" type="button" onClick={() => setAdding(false)}>Cancel</button>
          </div>
        </FormCard>
      ) : <button className="secondary" style={{ marginBottom: 12 }} onClick={() => setAdding(true)}>+ Add hunt area</button>)}

      <div className="card table-scroll">
        <table>
          <thead><tr><th>Code</th><th>Kind</th><th>Members</th><th>Opps</th><th>Definition</th>{canEdit && <th></th>}</tr></thead>
          <tbody>
            {rows.map((a) => (
              <Fragment key={a.hunt_area_id}>
                <tr>
                  <td><strong>{a.area_code}</strong></td>
                  <td>{a.area_kind}</td>
                  <td>{a.member_count}</td>
                  <td>{a.opportunity_count}</td>
                  <td className="subtle">{a.definition_text}</td>
                  {canEdit && (
                    <td style={{ whiteSpace: "nowrap" }}>
                      <button className="secondary" onClick={() => { setEditId(editId === a.hunt_area_id ? null : a.hunt_area_id); setEdit({ area_code: a.area_code, definition_text: a.definition_text ?? "" }); setMembersFor(null); setRepointFor(null); }}>Edit</button>
                      <button className="secondary" style={{ marginLeft: 6 }} onClick={() => void openMembers(a)}>Members</button>
                      <button className="secondary" style={{ marginLeft: 6 }} onClick={() => { setRepointFor(repointFor === a.hunt_area_id ? null : a.hunt_area_id); setRepointTo(""); setMembersFor(null); setEditId(null); }}>Re-point</button>
                      <button className="danger" style={{ marginLeft: 6 }} disabled={Number(a.opportunity_count) > 0} title={Number(a.opportunity_count) > 0 ? "Re-point its opportunities first" : ""} onClick={() => setDelReq(a)}>Delete</button>
                    </td>
                  )}
                </tr>
                {editId === a.hunt_area_id && (
                  <tr><td colSpan={6} style={{ background: "#f7f9fb" }}>
                    <div style={{ padding: 8, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
                      <div><label>Code</label><input value={edit.area_code} onChange={(e) => setEdit({ ...edit, area_code: e.target.value })} /></div>
                      <div style={{ flex: 1, minWidth: 200 }}><label>Definition</label><input value={edit.definition_text} onChange={(e) => setEdit({ ...edit, definition_text: e.target.value })} style={{ width: "100%" }} /></div>
                      <button onClick={() => saveEdit(a)}>Save</button>
                      <button className="secondary" onClick={() => setEditId(null)}>Cancel</button>
                    </div>
                  </td></tr>
                )}
                {membersFor === a.hunt_area_id && (
                  <tr><td colSpan={6} style={{ background: "#f7f9fb" }}>
                    <div style={{ padding: 8 }}>
                      <strong>Member districts — {a.area_code}</strong>
                      <p className="subtle" style={{ margin: "4px 0" }}>Checked districts are this area's current members. Saving replaces the full member set (districts + <Link className="district-link" to="/help/glossary#portion">portions</Link> below).</p>
                      <div style={{ margin: "6px 0" }}>
                        <label style={{ display: "block" }}>Portion members {memberPortions.length > 0 ? `(${memberPortions.length})` : ""}</label>
                        {memberPortions.length > 0 && (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, margin: "2px 0" }}>
                            {memberPortions.map((p) => (
                              <span key={p.portion_id!} className="chip" style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
                                {p.portion_name ?? p.portion_code}
                                {canEdit && <button type="button" title="Remove portion" style={{ border: "none", background: "none", cursor: "pointer", padding: 0 }} onClick={() => dropPortion(p.portion_id!)}>×</button>}
                              </span>
                            ))}
                          </div>
                        )}
                        {canEdit && (
                          <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 2 }}>
                            <select value={addPortionId} onChange={(e) => setAddPortionId(e.target.value)} style={{ maxWidth: 360 }}>
                              <option value="">— add a portion —</option>
                              {allPortions.filter((p) => !memberPortions.some((m) => m.portion_id === p.portion_id)).map((p) => (
                                <option key={p.portion_id} value={p.portion_id}>{p.portion_code} · {p.portion_name}</option>
                              ))}
                            </select>
                            <button type="button" className="secondary" disabled={!addPortionId} onClick={() => addPortion(addPortionId)}>Add portion</button>
                          </div>
                        )}
                      </div>
                      <DistrictPicker districts={districts} selected={memberSel} onToggle={(id) => toggle(memberSel, id, setMemberSel)} />
                      <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                        <button onClick={() => saveMembers(a)} disabled={memberSel.size === 0 && memberPortions.length === 0}>Replace members</button>
                        <button className="secondary" onClick={() => setMembersFor(null)}>Cancel</button>
                      </div>
                    </div>
                  </td></tr>
                )}
                {repointFor === a.hunt_area_id && (
                  <tr><td colSpan={6} style={{ background: "#f7f9fb" }}>
                    <div style={{ padding: 8 }}>
                      <p className="subtle" style={{ margin: "0 0 6px" }}>
                        Re-point moves every opportunity on <strong>{a.area_code}</strong> to another area — use it before deleting this one.
                      </p>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
                      <div><label>Move all opportunities to</label>
                        <select value={repointTo} onChange={(e) => setRepointTo(e.target.value)}>
                          <option value="">— target area —</option>
                          {rows.filter((o) => o.hunt_area_id !== a.hunt_area_id).map((o) => <option key={o.hunt_area_id} value={o.hunt_area_id}>{o.area_code}</option>)}
                        </select>
                      </div>
                      <button onClick={() => doRepoint(a)} disabled={!repointTo}>Re-point</button>
                      <button className="secondary" onClick={() => setRepointFor(null)}>Cancel</button>
                    </div>
                    </div>
                  </td></tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
