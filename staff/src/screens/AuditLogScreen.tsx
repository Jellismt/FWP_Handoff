/**
 * @file AuditLogScreen.tsx
 * @module engage-mt/staff
 * @description Read-only audit trail: every create, edit, delete, and publish
 *              with the acting user and a field-level before/after diff.
 *              Filters by table, user, and date window; pages newest-first
 *              with "Load more"; approvers and admins can export the filtered
 *              rows as CSV.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-20
 * @updated 2026-09-06
 * @version 2.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { useCallback, useEffect, useState } from "react";
import { AUDITED_TABLES, ROLE_RANK } from "@engage-mt/regs-shared";
import { api, type AuditLogQueryInput, type AuditRow } from "../api.js";
import { useApp } from "../store.js";

const ACTION_LABEL: Record<string, string> = {
  INSERT: "Created", UPDATE: "Edited", DELETE: "Deleted", PUBLISH: "Published",
};
const actionLabel = (code: string): string => ACTION_LABEL[code] ?? code;
const PAGE_SIZE = 100;

interface FieldDiff { field: string; before: unknown; after: unknown }
function diffRows(oldJson: string | null, newJson: string | null): FieldDiff[] {
  const parse = (s: string | null): Record<string, unknown> => {
    if (!s) return {};
    try { return JSON.parse(s) as Record<string, unknown>; } catch { return {}; }
  };
  const a = parse(oldJson); const b = parse(newJson);
  const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort();
  const out: FieldDiff[] = [];
  for (const k of keys) {
    if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) out.push({ field: k, before: a[k], after: b[k] });
  }
  return out;
}
const fmt = (v: unknown) => (v === undefined ? "∅" : v === null ? "null" : typeof v === "object" ? JSON.stringify(v) : String(v));

/** A `<input type="date">` value → the UTC instant that day starts (or the next day, for an exclusive end). */
const dayBound = (date: string, endExclusive = false): string | undefined => {
  if (!date) return undefined;
  const d = new Date(`${date}T00:00:00Z`);
  if (endExclusive) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString();
};

export function AuditLogScreen() {
  const me = useApp((s) => s.me);
  const canExport = me !== null && ROLE_RANK[me.role] >= ROLE_RANK.approver;
  const [table, setTable] = useState("");
  const [user, setUser] = useState("");
  const [fromDay, setFromDay] = useState("");
  const [toDay, setToDay] = useState("");
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const filters: AuditLogQueryInput = {
    table: table || undefined,
    user: user.trim() || undefined,
    from: dayBound(fromDay),
    to: dayBound(toDay, true),
  };
  const filterKey = JSON.stringify(filters);

  const load = useCallback(async (before?: string) => {
    setBusy(true);
    try {
      const page = await api.auditLog({ ...(JSON.parse(filterKey) as AuditLogQueryInput), before, limit: PAGE_SIZE });
      setRows((prev) => (before ? [...prev, ...page.rows] : page.rows));
      setNextCursor(page.nextCursor);
      setErr(null);
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  }, [filterKey]);

  useEffect(() => { void load(); }, [load]);

  return (
    <section>
      <h2>Audit log</h2>
      <p className="subtle">Every create, edit, delete, and publish, with the acting user and a field-level before/after diff. Read-only, open to every role. Newest first.</p>
      <div className="card" style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <label htmlFor="audit-table">Table</label>
        <select id="audit-table" value={table} onChange={(e) => setTable(e.target.value)}>
          <option value="">All tables</option>
          {AUDITED_TABLES.map((t) => <option key={t}>{t}</option>)}
        </select>
        <label htmlFor="audit-user">User</label>
        <input id="audit-user" value={user} placeholder="email" onChange={(e) => setUser(e.target.value)} />
        <label htmlFor="audit-from">From</label>
        <input id="audit-from" type="date" value={fromDay} onChange={(e) => setFromDay(e.target.value)} />
        <label htmlFor="audit-to">To</label>
        <input id="audit-to" type="date" value={toDay} onChange={(e) => setToDay(e.target.value)} />
        <span className="subtle">Showing {rows.length}{nextCursor ? " · more available" : ""}</span>
        {canExport && (
          <a className="secondary" href={api.auditLogCsvUrl(filters)} download style={{ marginLeft: "auto" }}>
            Export CSV
          </a>
        )}
      </div>
      {err && <p className="error-text">{err}</p>}
      <div className="card table-scroll">
        <table>
          <thead><tr><th>When</th><th>By</th><th>Table</th><th>Action</th><th>Changes</th></tr></thead>
          <tbody>
            {rows.map((r) => {
              const diffs = r.action_code === "PUBLISH" ? [] : diffRows(r.old_row_json, r.new_row_json);
              return (
                <tr key={r.audit_id}>
                  <td className="subtle" style={{ whiteSpace: "nowrap" }}>{r.changed_at.replace("T", " ").replace("Z", "")}</td>
                  <td>{r.changed_by}</td>
                  <td><span className="chip chip-species">{r.table_name}</span></td>
                  <td title={r.action_code}>{actionLabel(r.action_code)}</td>
                  <td>
                    {diffs.length === 0 ? <span className="subtle">—</span> : (
                      <details>
                        <summary className="subtle">{diffs.length} field{diffs.length === 1 ? "" : "s"}</summary>
                        <ul style={{ margin: "4px 0" }}>
                          {diffs.map((d) => (
                            <li key={d.field} className="subtle" style={{ fontSize: "0.78rem" }}>
                              <strong>{d.field}</strong>: {fmt(d.before)} → {fmt(d.after)}
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {rows.length === 0 && !busy && <p className="subtle">No audit entries.</p>}
      {nextCursor && (
        <button type="button" className="secondary" disabled={busy} onClick={() => void load(nextCursor)}>
          {busy ? "Loading…" : "Load more"}
        </button>
      )}
    </section>
  );
}
