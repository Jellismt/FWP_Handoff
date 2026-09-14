/**
 * @file RestrictedAreasScreen.tsx
 * @module engage-mt/staff
 * @description Restricted-area manager (season-scoped): list restricted / weapons /
 *              closure areas, create them, edit name/type/legal description, edit the
 *              districts each is linked to (with a per-link note), and delete (guarded
 *              while still linked). All optimistic-locked.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-04
 * @updated 2026-07-05
 * @version 1.1.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { Fragment, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type RareaRow, type DistrictRow } from "../api.js";
import { useApp } from "../store.js";
import { ConfirmDialog, FormCard, Toast, conflictToast, type ToastState } from "../components/ui.js";

const AREA_TYPES = ["RESTRICTED", "WEAPONS_RESTR", "CLOSURE", "ARCHERY_ONLY", "MGMT_ZONE"];
/** Plain-English labels for the restricted-area type codes (0006 migration vocabulary). */
const AREA_TYPE_LABEL: Record<string, string> = {
  RESTRICTED: "Restricted",
  WEAPONS_RESTR: "Weapons restricted",
  CLOSURE: "Closure",
  ARCHERY_ONLY: "Archery only",
  MGMT_ZONE: "Management zone",
};
const areaTypeLabel = (code: string): string => AREA_TYPE_LABEL[code] ?? code;

export function RestrictedAreasScreen() {
  const seasonYear = useApp((s) => s.seasonYear);
  const me = useApp((s) => s.me);
  const canEdit = me?.role === "editor" || me?.role === "approver" || me?.role === "admin";
  const [rows, setRows] = useState<RareaRow[]>([]);
  const [districts, setDistricts] = useState<DistrictRow[]>([]);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [adding, setAdding] = useState(false);
  const [nr, setNr] = useState({ area_type: "RESTRICTED", area_name: "", legal_desc: "" });
  const [editId, setEditId] = useState<string | null>(null);
  const [edit, setEdit] = useState({ area_type: "RESTRICTED", area_name: "", legal_desc: "" });
  const [linksFor, setLinksFor] = useState<string | null>(null);
  const [linkSel, setLinkSel] = useState<Set<string>>(new Set());
  const [delReq, setDelReq] = useState<RareaRow | null>(null);

  const reload = () => api.restrictedAreas(seasonYear).then(setRows).catch((e) => setToast({ msg: String(e) }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void reload(); }, [seasonYear]);
  useEffect(() => { void api.districts(seasonYear).then(setDistricts).catch(() => undefined); }, [seasonYear]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createRarea({ season_year: seasonYear, area_type: nr.area_type, area_name: nr.area_name, legal_desc: nr.legal_desc || null });
      setAdding(false); setNr({ area_type: "RESTRICTED", area_name: "", legal_desc: "" });
      setToast({ msg: "Restricted area created." }); await reload();
    } catch (e2) { setToast(conflictToast(e2, "reload", reload)); }
  };

  const saveEdit = async (r: RareaRow) => {
    try {
      await api.patchRarea(r.rarea_id, { area_type: edit.area_type, area_name: edit.area_name, legal_desc: edit.legal_desc || null, expected_updated_at: r.updated_at });
      setEditId(null); setToast({ msg: "Saved." }); await reload();
    } catch (e) { setToast(conflictToast(e, "reload", reload)); }
  };

  const openLinks = async (r: RareaRow) => {
    setLinksFor(r.rarea_id); setEditId(null);
    const cur = await api.rareaDistricts(r.rarea_id).catch(() => []);
    setLinkSel(new Set(cur.map((l) => l.district_id)));
  };
  const saveLinks = async (r: RareaRow) => {
    try {
      await api.putRareaDistricts(r.rarea_id, r.updated_at, [...linkSel].map((district_id) => ({ district_id })));
      setLinksFor(null); setToast({ msg: "District links saved." }); await reload();
    } catch (e) { setToast(conflictToast(e, "reload", reload)); }
  };

  const del = async (r: RareaRow) => {
    setDelReq(null);
    try { await api.deleteRarea(r.rarea_id); setToast({ msg: `Deleted "${r.area_name}".` }); await reload(); }
    catch (e) { setToast(conflictToast(e, "reload", reload)); }
  };

  const toggleLink = (id: string) => {
    const n = new Set(linkSel);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    setLinkSel(n);
  };

  return (
    <section>
      <h2>Restricted areas — {seasonYear}</h2>
      <p className="subtle">
        Weapons-restricted, closure, archery-only, and management-zone <Link className="district-link" to="/help/glossary#restricted-area">areas</Link> that <Link className="district-link" to="/help/glossary#district">districts</Link> reference. Create one, then link it to the districts it applies to. {rows.length} areas.
      </p>
      <Toast toast={toast} onDismiss={() => setToast(null)} />

      {delReq && (
        <ConfirmDialog
          heading={`Delete restricted area "${delReq.area_name}"?`}
          body={<>Removes the restricted area and its type and legal description. This can't be undone. (Unlink its districts first — only unlinked areas can be deleted.)</>}
          confirmLabel="Delete area"
          busy={false}
          onConfirm={() => void del(delReq)}
          onCancel={() => setDelReq(null)}
        />
      )}

      {canEdit && (adding ? (
        <FormCard title="Add restricted area" onSubmit={create}>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <div><label>Type</label><select value={nr.area_type} onChange={(e) => setNr({ ...nr, area_type: e.target.value })}>{AREA_TYPES.map((t) => <option key={t} value={t}>{areaTypeLabel(t)}</option>)}</select></div>
            <div style={{ flex: 1, minWidth: 200 }}><label>Name</label><input value={nr.area_name} onChange={(e) => setNr({ ...nr, area_name: e.target.value })} required style={{ width: "100%" }} /></div>
          </div>
          <label style={{ marginTop: 8 }}>Legal description</label>
          <textarea value={nr.legal_desc} onChange={(e) => setNr({ ...nr, legal_desc: e.target.value })} style={{ width: "100%", minHeight: 80 }} />
          <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
            <button type="submit">Create</button>
            <button className="secondary" type="button" onClick={() => setAdding(false)}>Cancel</button>
          </div>
        </FormCard>
      ) : <button className="secondary" style={{ marginBottom: 12 }} onClick={() => setAdding(true)}>+ Add restricted area</button>)}

      <div className="card table-scroll">
        <table>
          <thead><tr><th>Name</th><th>Type</th><th>Districts</th><th>Legal description</th>{canEdit && <th></th>}</tr></thead>
          <tbody>
            {rows.map((r) => (
              <Fragment key={r.rarea_id}>
                <tr>
                  <td><strong>{r.area_name}</strong></td>
                  <td>{areaTypeLabel(r.area_type)}</td>
                  <td>{r.district_count}</td>
                  <td className="subtle" style={{ maxWidth: 320 }}>{r.legal_desc}</td>
                  {canEdit && (
                    <td style={{ whiteSpace: "nowrap" }}>
                      <button className="secondary" onClick={() => { setEditId(editId === r.rarea_id ? null : r.rarea_id); setEdit({ area_type: r.area_type, area_name: r.area_name, legal_desc: r.legal_desc ?? "" }); setLinksFor(null); }}>Edit</button>
                      <button className="secondary" style={{ marginLeft: 6 }} onClick={() => openLinks(r)}>Districts</button>
                      <button className="danger" style={{ marginLeft: 6 }} disabled={Number(r.district_count) > 0} title={Number(r.district_count) > 0 ? "Unlink its districts first" : ""} onClick={() => setDelReq(r)}>Delete</button>
                    </td>
                  )}
                </tr>
                {editId === r.rarea_id && (
                  <tr><td colSpan={5} style={{ background: "#f7f9fb" }}>
                    <div style={{ padding: 8, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
                      <div><label>Type</label><select value={edit.area_type} onChange={(e) => setEdit({ ...edit, area_type: e.target.value })}>{AREA_TYPES.map((t) => <option key={t} value={t}>{areaTypeLabel(t)}</option>)}</select></div>
                      <div style={{ minWidth: 180 }}><label>Name</label><input value={edit.area_name} onChange={(e) => setEdit({ ...edit, area_name: e.target.value })} style={{ width: "100%" }} /></div>
                      <div style={{ flex: 1, minWidth: 220 }}><label>Legal description</label><input value={edit.legal_desc} onChange={(e) => setEdit({ ...edit, legal_desc: e.target.value })} style={{ width: "100%" }} /></div>
                      <button onClick={() => saveEdit(r)}>Save</button>
                      <button className="secondary" onClick={() => setEditId(null)}>Cancel</button>
                    </div>
                  </td></tr>
                )}
                {linksFor === r.rarea_id && (
                  <tr><td colSpan={5} style={{ background: "#f7f9fb" }}>
                    <div style={{ padding: 8 }}>
                      <strong>Linked districts — {r.area_name}</strong>
                      <div style={{ maxHeight: 180, overflowY: "auto", display: "flex", flexWrap: "wrap", gap: 4, border: "1px solid var(--fwp-border)", borderRadius: 6, padding: 6, marginTop: 6 }}>
                        {districts.map((d) => (
                          <label key={d.district_id} style={{ display: "flex", gap: 4, alignItems: "center", fontSize: "0.8rem", minWidth: 90 }}>
                            <input type="checkbox" checked={linkSel.has(d.district_id!)} onChange={() => toggleLink(d.district_id!)} /> {d.district_code}
                          </label>
                        ))}
                      </div>
                      <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                        <button onClick={() => saveLinks(r)}>Save links</button>
                        <button className="secondary" onClick={() => setLinksFor(null)}>Cancel</button>
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
