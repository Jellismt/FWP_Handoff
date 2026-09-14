/**
 * @file ContactsScreen.tsx
 * @module engage-mt/staff
 * @description Contact-list editor (book pp.143-144): FWP HQ, hotlines, regional offices,
 *              state/federal agencies, and tribal governments. Grouped by contact kind;
 *              editors can add rows and edit fields inline (optimistic-locked).
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-07
 * @updated 2026-07-07
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { Fragment, useCallback, useEffect, useState } from "react";
import { api, type ContactRow } from "../api.js";
import { useApp } from "../store.js";
import { FormCard, conflictMsg } from "../components/ui.js";

const KINDS = ["STATE_HQ", "HOTLINE", "REGIONAL_HQ", "FIELD_OFFICE", "STATE_AGENCY", "FEDERAL", "TRIBAL", "BEAR_SPECIALIST", "OTHER"];
const KIND_LABEL: Record<string, string> = {
  STATE_HQ: "State headquarters", HOTLINE: "Hotlines", REGIONAL_HQ: "Regional headquarters",
  FIELD_OFFICE: "Field offices", STATE_AGENCY: "State agencies", FEDERAL: "Federal agencies",
  TRIBAL: "Tribal governments", BEAR_SPECIALIST: "Bear specialists", OTHER: "Other",
};

function ContactEditor({ row, onSaved, onCancel }: { row: ContactRow; onSaved: () => void; onCancel: () => void }) {
  const [f, setF] = useState({ name: row.name, org: row.org ?? "", address: row.address ?? "", city: row.city ?? "", phone: row.phone ?? "", phone2: row.phone2 ?? "", email: row.email ?? "", url: row.url ?? "", note: row.note ?? "", sort_order: String(row.sort_order) });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const save = async () => {
    setBusy(true); setErr(null);
    try {
      await api.patchContact(row.contact_id, {
        expected_updated_at: row.updated_at, name: f.name, org: f.org || null, address: f.address || null, city: f.city || null,
        phone: f.phone || null, phone2: f.phone2 || null, email: f.email || null, url: f.url || null, note: f.note || null, sort_order: Number(f.sort_order) || 0,
      });
      onSaved();
    } catch (e) { setErr(conflictMsg(e, "reload")); } finally { setBusy(false); }
  };
  return (
    <tr><td colSpan={5} style={{ background: "#f7f9fb" }}>
      <div style={{ padding: "8px 4px", display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div style={{ minWidth: 200 }}><label>Name</label><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} style={{ width: "100%" }} /></div>
        <div><label>Phone</label><input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} style={{ width: 130 }} /></div>
        <div><label>Phone 2</label><input value={f.phone2} onChange={(e) => setF({ ...f, phone2: e.target.value })} style={{ width: 130 }} /></div>
        <div style={{ minWidth: 180 }}><label>Address</label><input value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} style={{ width: "100%" }} /></div>
        <div><label>City</label><input value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} style={{ width: 130 }} /></div>
        <div><label>URL</label><input value={f.url} onChange={(e) => setF({ ...f, url: e.target.value })} style={{ width: 160 }} /></div>
        <div><label>Sort</label><input type="number" value={f.sort_order} onChange={(e) => setF({ ...f, sort_order: e.target.value })} style={{ width: 70 }} /></div>
        <div style={{ flex: 1, minWidth: 180 }}><label>Note</label><input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} style={{ width: "100%" }} /></div>
      </div>
      {err && <p className="error-text" role="alert" style={{ padding: "0 4px" }}>{err}</p>}
      <div style={{ padding: "0 4px 8px", display: "flex", gap: 8 }}>
        <button onClick={save} disabled={busy}>{busy ? "Saving…" : "Save"}</button>
        <button className="secondary" onClick={onCancel}>Cancel</button>
      </div>
    </td></tr>
  );
}

export function ContactsScreen() {
  const seasonYear = useApp((s) => s.seasonYear);
  const me = useApp((s) => s.me);
  const canEdit = me?.role === "editor" || me?.role === "approver" || me?.role === "admin";
  const [rows, setRows] = useState<ContactRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [nc, setNc] = useState({ contact_code: "", contact_kind: "HOTLINE", name: "", phone: "", sort_order: "0" });

  const reload = useCallback(() => api.contacts(seasonYear).then(setRows).catch((e) => setErr(String(e))), [seasonYear]);
  useEffect(() => { void reload(); }, [reload]);
  if (err) return <p className="error-text">{err}</p>;

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createContact({ season_year: seasonYear, contact_code: nc.contact_code, contact_kind: nc.contact_kind, name: nc.name, phone: nc.phone || null, sort_order: Number(nc.sort_order) || 0 });
      setAdding(false); setNc({ contact_code: "", contact_kind: "HOTLINE", name: "", phone: "", sort_order: "0" });
      await reload();
    } catch (e2) { setErr(conflictMsg(e2)); }
  };

  return (
    <section>
      <h2>Contacts — {seasonYear}</h2>
      <p className="subtle">{rows.length} entries — FWP headquarters, hotlines, regional offices, agencies, and tribal governments.</p>

      {canEdit && (adding ? (
        <FormCard title="Add contact" onSubmit={add}>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <div><label>Code</label><input value={nc.contact_code} onChange={(e) => setNc({ ...nc, contact_code: e.target.value })} required style={{ width: 150 }} /></div>
            <div><label>Kind</label><select value={nc.contact_kind} onChange={(e) => setNc({ ...nc, contact_kind: e.target.value })}>{KINDS.map((k) => <option key={k}>{k}</option>)}</select></div>
            <div style={{ minWidth: 200 }}><label>Name</label><input value={nc.name} onChange={(e) => setNc({ ...nc, name: e.target.value })} required style={{ width: "100%" }} /></div>
            <div><label>Phone</label><input value={nc.phone} onChange={(e) => setNc({ ...nc, phone: e.target.value })} style={{ width: 130 }} /></div>
            <div><label>Sort</label><input type="number" value={nc.sort_order} onChange={(e) => setNc({ ...nc, sort_order: e.target.value })} style={{ width: 70 }} /></div>
          </div>
          <div style={{ marginTop: 8, display: "flex", gap: 8 }}><button type="submit">Create</button><button className="secondary" type="button" onClick={() => setAdding(false)}>Cancel</button></div>
        </FormCard>
      ) : <button className="secondary" style={{ marginBottom: 12 }} onClick={() => setAdding(true)}>+ Add contact</button>)}

      {KINDS.filter((k) => rows.some((r) => r.contact_kind === k)).map((kind) => (
        <div key={kind} className="card table-scroll" style={{ marginBottom: 12 }}>
          <h3 style={{ padding: "8px 12px 0" }}>{KIND_LABEL[kind]}</h3>
          <table>
            <thead><tr><th>Name</th><th>Phone</th><th>Address</th><th>Note</th>{canEdit && <th></th>}</tr></thead>
            <tbody>
              {rows.filter((r) => r.contact_kind === kind).map((r) => (
                <Fragment key={r.contact_id}>
                  <tr>
                    <td><strong>{r.name}</strong><div className="subtle" style={{ fontSize: "0.72rem" }}>{r.contact_code}</div></td>
                    <td>{r.phone ?? "–"}{r.phone2 ? ` / ${r.phone2}` : ""}</td>
                    <td className="subtle">{[r.address, r.city].filter(Boolean).join(", ")}</td>
                    <td className="subtle">{r.note ?? ""}</td>
                    {canEdit && <td><button className="secondary" onClick={() => setEditing(editing === r.contact_id ? null : r.contact_id)}>Edit</button></td>}
                  </tr>
                  {editing === r.contact_id && <ContactEditor row={r} onSaved={() => { setEditing(null); void reload(); }} onCancel={() => setEditing(null)} />}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      ))}
      {rows.length === 0 && <p className="subtle">No contacts for {seasonYear} yet.</p>}
    </section>
  );
}
