/**
 * @file FeesScreen.tsx
 * @module engage-mt/staff
 * @description License-fee chart editor: products grouped by kind × per-audience price grid.
 *              Editors can edit a product's per-audience prices inline (replace-all PUT,
 *              optimistic-locked) and add new products.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-04
 * @updated 2026-07-05
 * @version 1.2.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { Fragment, useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type ProductRow, type PriceInputDto } from "../api.js";
import { useApp } from "../store.js";
import { FormCard, conflictMsg, isConflict } from "../components/ui.js";

const AUDIENCES = ["RES", "RES_YOUTH", "RES_SENIOR", "RES_DISABLED", "NR", "NR_NATIVE", "NR_YOUTH_SPONSORED", "NR_COLLEGE"];
/** Readable header labels for the audience codes (0013 fee-chart seed vocabulary). */
const AUDIENCE_LABEL: Record<string, string> = {
  RES: "Resident",
  RES_YOUTH: "Resident youth",
  RES_SENIOR: "Resident senior",
  RES_DISABLED: "Resident disabled",
  NR: "Nonresident",
  NR_NATIVE: "Nonresident native",
  NR_YOUTH_SPONSORED: "Nonresident youth (sponsored)",
  NR_COLLEGE: "Nonresident college",
};
const audienceLabel = (code: string): string => AUDIENCE_LABEL[code] ?? code;
const PRODUCT_KINDS = ["PREREQUISITE", "LICENSE", "PERMIT", "COMBO", "B_LICENSE", "SURCHARGE"];
const dollars = (cents?: number) => (cents == null ? "–" : `$${(cents / 100).toLocaleString()}`);
const toCents = (v: string): number | null => (v.trim() === "" ? null : Math.round(Number(v) * 100));

/** Inline per-audience price editor for one product (replace-all PUT). */
function PriceEditor({ product, onSaved, onCancel, onReload }: {
  product: ProductRow; onSaved: (msg: string) => void; onCancel: () => void; onReload: () => void;
}) {
  const [vals, setVals] = useState<Record<string, string>>(() => {
    const m: Record<string, string> = {};
    for (const a of AUDIENCES) m[a] = product.prices[a] != null ? String(product.prices[a]! / 100) : "";
    return m;
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [conflicted, setConflicted] = useState(false);

  const save = async () => {
    setBusy(true); setErr(null); setConflicted(false);
    const prices: PriceInputDto[] = [];
    for (const a of AUDIENCES) {
      const cents = toCents(vals[a] ?? "");
      if (cents != null) prices.push({ audience_code: a, price_cents: cents });
    }
    try {
      await api.putPrices(product.product_id, product.updated_at, prices);
      onSaved(`Saved prices for ${product.product_code}.`);
    } catch (e) { setErr(conflictMsg(e, "reload")); setConflicted(isConflict(e)); } finally { setBusy(false); }
  };

  return (
    <tr>
      <td colSpan={AUDIENCES.length + 2} style={{ background: "#f7f9fb" }}>
        <div style={{ padding: "8px 4px" }}>
          <strong>Edit prices — {product.display_name}</strong> <span className="subtle">(dollars; blank = not offered)</span>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 8 }}>
            {AUDIENCES.map((a) => (
              <div key={a}><label title={a}>{audienceLabel(a)}</label><input type="number" step="0.01" value={vals[a] ?? ""} onChange={(e) => setVals((v) => ({ ...v, [a]: e.target.value }))} style={{ width: 100 }} /></div>
            ))}
          </div>
          {err && (
            <p className="error-text" style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center" }} role="alert">
              <span>{err}</span>
              {conflicted && <button className="secondary" onClick={onReload}>Reload</button>}
            </p>
          )}
          <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
            <button onClick={save} disabled={busy}>{busy ? "Saving…" : "Save prices"}</button>
            <button className="secondary" onClick={onCancel}>Cancel</button>
          </div>
        </div>
      </td>
    </tr>
  );
}

export function FeesScreen() {
  const seasonYear = useApp((s) => s.seasonYear);
  const me = useApp((s) => s.me);
  const canEdit = me?.role === "editor" || me?.role === "approver" || me?.role === "admin";
  const [rows, setRows] = useState<ProductRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [np, setNp] = useState({ product_code: "", display_name: "", product_kind: "LICENSE", species_code: "", chart_note: "", sort_order: "0" });

  const reload = useCallback(() => api.products(seasonYear).then(setRows).catch((e) => setErr(String(e))), [seasonYear]);
  useEffect(() => { void reload(); }, [reload]);
  if (err) return <p className="error-text">{err}</p>;

  const addProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createProduct({
        season_year: seasonYear, product_code: np.product_code, display_name: np.display_name,
        product_kind: np.product_kind, species_code: np.species_code || null,
        chart_note: np.chart_note || null, sort_order: Number(np.sort_order) || 0,
      });
      setAdding(false); setNp({ product_code: "", display_name: "", product_kind: "LICENSE", species_code: "", chart_note: "", sort_order: "0" });
      await reload();
    } catch (e2) { setErr(conflictMsg(e2)); }
  };

  return (
    <section>
      <h2>License fees — {seasonYear}</h2>
      <p className="subtle">
        {rows.length} products. Discounted variants are per-<Link className="district-link" to="/help/glossary#audience">audience</Link> price columns on the same product (mirrors the printed chart).
      </p>

      {canEdit && (adding ? (
        <FormCard title="Add product" onSubmit={addProduct}>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <div><label>Code</label><input value={np.product_code} onChange={(e) => setNp({ ...np, product_code: e.target.value })} required /></div>
            <div style={{ minWidth: 220 }}><label>Name</label><input value={np.display_name} onChange={(e) => setNp({ ...np, display_name: e.target.value })} required style={{ width: "100%" }} /></div>
            <div><label>Kind</label><select value={np.product_kind} onChange={(e) => setNp({ ...np, product_kind: e.target.value })}>{PRODUCT_KINDS.map((k) => <option key={k}>{k}</option>)}</select></div>
            <div><label>Species</label><input value={np.species_code} onChange={(e) => setNp({ ...np, species_code: e.target.value })} placeholder="(optional)" style={{ width: 90 }} /></div>
            <div><label>Sort</label><input type="number" value={np.sort_order} onChange={(e) => setNp({ ...np, sort_order: e.target.value })} style={{ width: 70 }} /></div>
            <div style={{ flex: 1, minWidth: 180 }}><label>Chart note</label><input value={np.chart_note} onChange={(e) => setNp({ ...np, chart_note: e.target.value })} style={{ width: "100%" }} /></div>
          </div>
          <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
            <button type="submit">Create product</button>
            <button className="secondary" type="button" onClick={() => setAdding(false)}>Cancel</button>
          </div>
        </FormCard>
      ) : <button className="secondary" style={{ marginBottom: 12 }} onClick={() => setAdding(true)}>+ Add product</button>)}

      <div className="card table-scroll">
        <table>
          <thead>
            <tr><th>Product</th><th>Kind</th>{AUDIENCES.map((a) => <th key={a} title={a}>{audienceLabel(a)}</th>)}{canEdit && <th></th>}</tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <Fragment key={r.product_id}>
                <tr>
                  <td><strong>{r.display_name}</strong><div className="subtle" style={{ fontSize: "0.72rem" }}>{r.product_code}</div></td>
                  <td>{r.product_kind}</td>
                  {AUDIENCES.map((a) => <td key={a}>{dollars(r.prices[a])}</td>)}
                  {canEdit && <td><button className="secondary" onClick={() => setEditing(editing === r.product_id ? null : r.product_id)}>Prices</button></td>}
                </tr>
                {editing === r.product_id && (
                  <PriceEditor product={r} onSaved={async () => { setEditing(null); await reload(); }} onCancel={() => setEditing(null)}
                    onReload={() => { setEditing(null); void reload(); }} />
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length === 0 && <p className="subtle">No fee products for {seasonYear} yet.</p>}
    </section>
  );
}
