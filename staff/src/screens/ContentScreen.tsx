/**
 * @file ContentScreen.tsx
 * @module engage-mt/staff
 * @description Reference-content editor: category-filtered section list + a markdown
 *              editor (body_md, incl. GFM tables) with optimistic-lock save. Editors can
 *              create new sections, archive/restore them, and edit sort order + statute
 *              references. Covers the Laws & Rules / licensing / youth / etc. prose.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-04
 * @updated 2026-07-05
 * @version 1.2.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { useCallback, useEffect, useState } from "react";
import { api, type ContentRow } from "../api.js";
import { useApp } from "../store.js";
import { FormCard, conflictMsg, isConflict } from "../components/ui.js";

const CATS = ["FRONT_MATTER", "LAWS_RULES", "LICENSING", "YOUTH", "DISABILITY", "DRAWING", "SAFETY", "ACCESS", "DEFINITIONS", "CWD", "OTHER"];

export function ContentScreen() {
  const seasonYear = useApp((s) => s.seasonYear);
  const me = useApp((s) => s.me);
  const canEdit = me?.role === "editor" || me?.role === "approver" || me?.role === "admin";
  const [rows, setRows] = useState<ContentRow[]>([]);
  const [sel, setSel] = useState<ContentRow | null>(null);
  const [body, setBody] = useState("");
  const [title, setTitle] = useState("");
  const [statuteRefs, setStatuteRefs] = useState("");
  const [sortOrder, setSortOrder] = useState("0");
  const [cat, setCat] = useState<string>("");
  const [showArchived, setShowArchived] = useState(false);
  const [adding, setAdding] = useState(false);
  const [ns, setNs] = useState({ slug: "", category: "LAWS_RULES", title: "", sort_order: "0", statute_refs: "" });
  const [msg, setMsg] = useState<string | null>(null);
  const [conflicted, setConflicted] = useState(false);

  const reload = useCallback(() => api.contentSections(seasonYear, cat || undefined).then(setRows).catch((e) => setMsg(String(e))), [seasonYear, cat]);
  useEffect(() => { void reload(); }, [reload]);

  const visible = rows.filter((r) => showArchived || r.record_status !== "ARCHIVED");

  const open = async (r: ContentRow) => {
    const full = (await api.contentSection(r.section_id))[0]!;
    setSel(full); setBody(full.body_md ?? ""); setTitle(full.title);
    setStatuteRefs(full.statute_refs ?? ""); setSortOrder(String(full.sort_order)); setMsg(null); setConflicted(false);
  };

  const save = async () => {
    if (!sel) return;
    try {
      await api.patchContent(sel.section_id, {
        title, body_md: body, statute_refs: statuteRefs.trim() === "" ? null : statuteRefs,
        sort_order: Number(sortOrder) || 0, expected_updated_at: sel.updated_at,
      });
      setMsg("Saved."); setConflicted(false); await reload(); await open(sel);
    } catch (e) { setMsg(conflictMsg(e, "reopen")); setConflicted(isConflict(e)); }
  };

  const archive = async () => {
    if (!sel) return;
    try {
      await api.archiveContent(sel.section_id, sel.updated_at);
      setMsg("Archived."); setSel(null); await reload();
    } catch (e) { setMsg(conflictMsg(e, "reopen")); setConflicted(isConflict(e)); }
  };
  const restore = async (r: ContentRow) => {
    try { await api.restoreContent(r.section_id); await reload(); } catch (e) { setMsg(conflictMsg(e)); }
  };

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const [created] = await api.createContent({
        season_year: seasonYear, slug: ns.slug, category: ns.category, title: ns.title,
        body_md: "", statute_refs: ns.statute_refs || null, sort_order: Number(ns.sort_order) || 0,
      });
      setAdding(false); setNs({ slug: "", category: "LAWS_RULES", title: "", sort_order: "0", statute_refs: "" });
      await reload();
      if (created) await open({ section_id: created.section_id } as ContentRow);
    } catch (e2) { setMsg(conflictMsg(e2)); }
  };

  return (
    <section>
      <h2>Reference content — {seasonYear}</h2>
      <p className="subtle">
        Laws &amp; Rules, licensing, youth, and other prose sections. These print in the regulations book <em>and</em> appear in the public Engage&nbsp;MT app. Written in markdown (GFM tables supported).
      </p>

      {canEdit && (adding ? (
        <FormCard title="New section" onSubmit={create}>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <div><label>Slug</label><input value={ns.slug} onChange={(e) => setNs({ ...ns, slug: e.target.value })} required placeholder="lowercase-with-dashes" /><div className="subtle" style={{ fontSize: "0.72rem", marginTop: 2 }}>Lowercase with dashes; permanent once created.</div></div>
            <div><label>Category</label><select value={ns.category} onChange={(e) => setNs({ ...ns, category: e.target.value })}>{CATS.map((c) => <option key={c}>{c}</option>)}</select></div>
            <div style={{ flex: 1, minWidth: 200 }}><label>Title</label><input value={ns.title} onChange={(e) => setNs({ ...ns, title: e.target.value })} required style={{ width: "100%" }} /></div>
            <div><label>Sort</label><input type="number" value={ns.sort_order} onChange={(e) => setNs({ ...ns, sort_order: e.target.value })} style={{ width: 70 }} /></div>
            <div><label>Statute refs</label><input value={ns.statute_refs} onChange={(e) => setNs({ ...ns, statute_refs: e.target.value })} placeholder="(optional)" /></div>
          </div>
          <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
            <button type="submit">Create section</button>
            <button className="secondary" type="button" onClick={() => setAdding(false)}>Cancel</button>
          </div>
        </FormCard>
      ) : <button className="secondary" style={{ marginBottom: 12 }} onClick={() => setAdding(true)}>+ New section</button>)}

      <div style={{ display: "flex", gap: 16 }}>
        <div style={{ minWidth: 280 }}>
          <label>Category</label>
          <select value={cat} onChange={(e) => setCat(e.target.value)} style={{ width: "100%" }}>
            <option value="">All</option>
            {CATS.map((c) => <option key={c}>{c}</option>)}
          </select>
          <label style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 8, fontSize: "0.8rem" }}>
            <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} /> Show archived
          </label>
          <div className="card" style={{ marginTop: 12, maxHeight: "60vh", overflowY: "auto" }}>
            {visible.map((r) => (
              <div key={r.section_id} className="accent-stripe" style={{ marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
                <div style={{ cursor: "pointer", flex: 1 }} onClick={() => open(r)}>
                  <strong style={{ fontSize: "0.9rem" }}>{r.title}</strong>
                  <div className="subtle" style={{ fontSize: "0.75rem" }}>
                    {r.category} · {r.slug}{r.record_status === "ARCHIVED" ? " · archived" : ""}{r.statute_refs ? ` · ${r.statute_refs}` : ""}
                  </div>
                </div>
                {canEdit && r.record_status === "ARCHIVED" && <button className="secondary" onClick={() => restore(r)}>Restore</button>}
              </div>
            ))}
            {visible.length === 0 && <p className="subtle">No sections yet.</p>}
          </div>
        </div>
        <div style={{ flex: 1 }}>
          {sel ? (
            <div className="card">
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 220 }}><label>Title</label><input value={title} onChange={(e) => setTitle(e.target.value)} disabled={!canEdit} style={{ width: "100%" }} /></div>
                <div><label>Sort</label><input type="number" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} disabled={!canEdit} style={{ width: 70 }} /></div>
                <div style={{ minWidth: 160 }}><label>Statute refs</label><input value={statuteRefs} onChange={(e) => setStatuteRefs(e.target.value)} disabled={!canEdit} style={{ width: "100%" }} /></div>
              </div>
              <label style={{ marginTop: 12 }}>Body (markdown)</label>
              <textarea value={body} onChange={(e) => setBody(e.target.value)} disabled={!canEdit}
                style={{ width: "100%", minHeight: "40vh", fontFamily: "monospace", fontSize: "0.85rem" }} />
              {canEdit && (
                <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                  <button onClick={save}>Save section</button>
                  <button className="danger" onClick={archive}>Archive</button>
                </div>
              )}
              {msg && (
                <p className="subtle" style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center" }} role={conflicted ? "alert" : undefined}>
                  <span>{msg}</span>
                  {conflicted && sel && <button className="secondary" onClick={() => void open(sel)}>Reload</button>}
                </p>
              )}
            </div>
          ) : <p className="subtle">Select a section to edit.</p>}
        </div>
      </div>
    </section>
  );
}
