/**
 * @file AssetsScreen.tsx
 * @module engage-mt/staff
 * @description CMS map/figure asset registry: list assets, register a new asset (by CMS
 *              doc id), and link a REGION_MAP asset to a region × geography so the printed
 *              book + public app can place it. Editor-gated.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-04
 * @updated 2026-07-05
 * @version 1.1.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { useEffect, useState } from "react";
import { api, type AssetRow, type RegionRow } from "../api.js";
import { useApp } from "../store.js";
import { FormCard, Toast, conflictMsg, type ToastState } from "../components/ui.js";

const ASSET_KINDS = ["REGION_MAP", "DISTRICT_MAP", "ZONE_MAP", "AREA_MAP", "FIGURE", "COVER"];
const GEOGRAPHIES = ["HD", "ANTELOPE_HD"];

export function AssetsScreen() {
  const seasonYear = useApp((s) => s.seasonYear);
  const me = useApp((s) => s.me);
  const canEdit = me?.role === "editor" || me?.role === "approver" || me?.role === "admin";
  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [regions, setRegions] = useState<RegionRow[]>([]);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [adding, setAdding] = useState(false);
  const [na, setNa] = useState({ cms_doc_id: "", asset_kind: "REGION_MAP", title: "", caption: "", alt_text: "" });
  const [link, setLink] = useState({ region_id: "", geography_code: "HD", asset_id: "" });

  const reload = () => api.assets().then(setAssets).catch((e) => setToast({ msg: String(e) }));
  useEffect(() => { void reload(); }, []);
  useEffect(() => { void api.regions().then(setRegions).catch(() => undefined); }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createAsset({
        cms_doc_id: na.cms_doc_id, asset_kind: na.asset_kind, title: na.title,
        caption: na.caption || null, alt_text: na.alt_text || null, season_year: seasonYear,
      });
      setAdding(false); setNa({ cms_doc_id: "", asset_kind: "REGION_MAP", title: "", caption: "", alt_text: "" });
      setToast({ msg: "Asset registered." }); await reload();
    } catch (e2) { setToast({ msg: conflictMsg(e2) }); }
  };

  const saveLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!link.region_id || !link.asset_id) { setToast({ msg: "Pick a region and an asset." }); return; }
    try {
      await api.setRegionMap(Number(link.region_id), link.geography_code, link.asset_id);
      setToast({ msg: `Linked map to region ${link.region_id}.` });
    } catch (e2) { setToast({ msg: conflictMsg(e2) }); }
  };

  const regionMaps = assets.filter((a) => a.asset_kind === "REGION_MAP");

  return (
    <section>
      <h2>Maps &amp; assets</h2>
      <p className="subtle">
        A registry of maps and figures placed in the printed book and public app. A <strong>CMS doc id</strong> is the id of the source document in the FWP CMS (Bloomreach); registering it here lets the book and app reference the image. {assets.length} assets.
      </p>
      <Toast toast={toast} onDismiss={() => setToast(null)} />

      {canEdit && (adding ? (
        <FormCard title="Register asset" onSubmit={create}>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <div><label>CMS doc id</label><input value={na.cms_doc_id} onChange={(e) => setNa({ ...na, cms_doc_id: e.target.value })} required placeholder="Bloomreach document id" /></div>
            <div><label>Kind</label><select value={na.asset_kind} onChange={(e) => setNa({ ...na, asset_kind: e.target.value })}>{ASSET_KINDS.map((k) => <option key={k}>{k}</option>)}</select></div>
            <div style={{ flex: 1, minWidth: 200 }}><label>Title</label><input value={na.title} onChange={(e) => setNa({ ...na, title: e.target.value })} required style={{ width: "100%" }} /></div>
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 8 }}>
            <div style={{ flex: 1, minWidth: 200 }}><label>Caption</label><input value={na.caption} onChange={(e) => setNa({ ...na, caption: e.target.value })} style={{ width: "100%" }} /></div>
            <div style={{ flex: 1, minWidth: 200 }}><label>Alt text</label><input value={na.alt_text} onChange={(e) => setNa({ ...na, alt_text: e.target.value })} style={{ width: "100%" }} /></div>
          </div>
          <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
            <button type="submit">Register</button>
            <button className="secondary" type="button" onClick={() => setAdding(false)}>Cancel</button>
          </div>
        </FormCard>
      ) : <button className="secondary" style={{ marginBottom: 12 }} onClick={() => setAdding(true)}>+ Register asset</button>)}

      <div className="card table-scroll">
        <table>
          <thead><tr><th>Title</th><th>Kind</th><th>CMS doc id</th><th>Season</th></tr></thead>
          <tbody>
            {assets.map((a) => (
              <tr key={a.asset_id}>
                <td><strong>{a.title}</strong>{a.caption ? <div className="subtle" style={{ fontSize: "0.72rem" }}>{a.caption}</div> : null}</td>
                <td>{a.asset_kind}</td>
                <td className="subtle">{a.cms_doc_id}</td>
                <td>{a.season_year ?? "evergreen"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {assets.length === 0 && <p className="subtle">No assets registered yet.</p>}

      {canEdit && (
        <FormCard title="Link a region map" onSubmit={saveLink}>
          <p className="subtle" style={{ marginTop: 0 }}>Chooses the map plate printed (and shown in the app) for a region × geography.</p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
            <div><label>Region</label>
              <select value={link.region_id} onChange={(e) => setLink({ ...link, region_id: e.target.value })}>
                <option value="">— region —</option>
                {regions.map((r) => <option key={r.region_id} value={r.region_id}>{r.region_id} · {r.region_name}</option>)}
              </select>
            </div>
            <div><label>Geography</label><select value={link.geography_code} onChange={(e) => setLink({ ...link, geography_code: e.target.value })}>{GEOGRAPHIES.map((g) => <option key={g}>{g}</option>)}</select></div>
            <div style={{ minWidth: 220 }}><label>Region-map asset</label>
              <select value={link.asset_id} onChange={(e) => setLink({ ...link, asset_id: e.target.value })} style={{ width: "100%" }}>
                <option value="">— asset —</option>
                {regionMaps.map((a) => <option key={a.asset_id} value={a.asset_id}>{a.title}</option>)}
              </select>
            </div>
            <button type="submit">Link map</button>
          </div>
        </FormCard>
      )}
    </section>
  );
}
