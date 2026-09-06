/**
 * @file PortionsScreen.tsx
 * @module engage-mt/staff
 * @description District-portions browser: the sub-district areas (e.g. "Portion of HD 314
 *              South of Rock Creek") synced from FWP's public ESRI portion layers by
 *              syncPortions. Read-mostly — portions are GIS-sourced, not hand-authored;
 *              staff link them to regulations as hunt-area members (Hunt areas → Members →
 *              Add portion). Editors can delete an orphan portion (server 409s if it's
 *              referenced). The glossary "Portions" link lands here.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-14
 * @updated 2026-07-14
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api, type PortionRow, type DistrictRow } from "../api.js";
import { useApp } from "../store.js";
import { ConfirmDialog, Toast, conflictToast, type ToastState } from "../components/ui.js";

export function PortionsScreen() {
  const seasonYear = useApp((s) => s.seasonYear);
  const me = useApp((s) => s.me);
  const canEdit = me?.role === "editor" || me?.role === "approver" || me?.role === "admin";
  const [portions, setPortions] = useState<PortionRow[]>([]);
  const [districts, setDistricts] = useState<DistrictRow[]>([]);
  const [q, setQ] = useState("");
  const [toast, setToast] = useState<ToastState | null>(null);
  const [delReq, setDelReq] = useState<PortionRow | null>(null);

  const reload = () => api.portions().then(setPortions).catch((e) => setToast({ msg: String(e) }));
  useEffect(() => { void reload(); }, []);
  // District id → code map (portions carry district_id; show the human code).
  useEffect(() => { void api.districts(seasonYear).then(setDistricts).catch(() => undefined); }, [seasonYear]);
  const codeOf = useMemo(() => {
    const m = new Map<string, string>();
    for (const d of districts) if (d.district_id) m.set(d.district_id, d.district_code);
    return m;
  }, [districts]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const rows = needle
      ? portions.filter((p) => p.portion_code.toLowerCase().includes(needle) || p.portion_name.toLowerCase().includes(needle) || (codeOf.get(p.district_id) ?? "").includes(needle))
      : portions;
    return [...rows].sort((a, b) => a.portion_code.localeCompare(b.portion_code));
  }, [portions, q, codeOf]);

  const del = async (p: PortionRow) => {
    setDelReq(null);
    try { await api.deletePortion(p.portion_id); setToast({ msg: `Deleted portion ${p.portion_code}.` }); await reload(); }
    catch (e) { setToast(conflictToast(e, "reload", reload)); }
  };

  return (
    <section>
      <h2>District portions</h2>
      <p className="subtle">
        A <Link className="district-link" to="/help/glossary#portion">portion</Link> is a sub-district area a regulation can be valid in
        (e.g. "Portion of HD 314 South of Rock Creek"). These are synced from FWP's public ESRI portion layers
        and join to that geometry by <code>SHAPECODE</code>. Link a portion to regulations on
        {" "}<Link className="district-link" to="/hunt-areas">Hunt areas → Members → Add portion</Link>. {portions.length} portions.
      </p>
      <Toast toast={toast} onDismiss={() => setToast(null)} />

      {delReq && (
        <ConfirmDialog
          heading={`Delete portion ${delReq.portion_code}?`}
          body={<>Removes "{delReq.portion_name}". Only unreferenced portions can be deleted (re-sync from GIS restores it).</>}
          confirmLabel={`Delete ${delReq.portion_code}`}
          busy={false}
          onConfirm={() => void del(delReq)}
          onCancel={() => setDelReq(null)}
        />
      )}

      <div style={{ margin: "8px 0" }}>
        <input placeholder="Filter by code, name, or district…" value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 360, width: "100%" }} />
      </div>

      <div className="card table-scroll">
        <table>
          <thead><tr><th>Code</th><th>Parent HD</th><th>Portion</th>{canEdit && <th></th>}</tr></thead>
          <tbody>
            {shown.map((p) => (
              <tr key={p.portion_id}>
                <td><strong>{p.portion_code}</strong></td>
                <td>{codeOf.get(p.district_id) ?? p.district_id}</td>
                <td>{p.portion_name}</td>
                {canEdit && (
                  <td style={{ whiteSpace: "nowrap" }}>
                    <button className="danger" onClick={() => setDelReq(p)}>Delete</button>
                  </td>
                )}
              </tr>
            ))}
            {shown.length === 0 && <tr><td colSpan={canEdit ? 4 : 3} className="subtle">No portions{q ? " match your filter" : " yet — run the portion sync"}.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}
