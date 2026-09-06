/**
 * @file ReviewScreen.tsx
 * @module engage-mt/staff
 * @description Pre-publish review: the diff (added/removed/changed rules vs the last
 *              published snapshot, grouped by district) + publication history. Publish
 *              itself is on the dashboard (approver, validation-gated).
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-04
 * @updated 2026-07-14
 * @version 1.2.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type DiffResultDto, type PublicationDto } from "../api.js";
import { useApp } from "../store.js";
import { LiveBanner } from "../components/ui.js";

export function ReviewScreen() {
  const seasonYear = useApp((s) => s.seasonYear);
  const [diff, setDiff] = useState<DiffResultDto | null>(null);
  const [pubs, setPubs] = useState<PublicationDto[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api.diff(seasonYear).then((r) => setDiff(r[0] ?? null)).catch((e) => setErr(String(e)));
    api.publications(seasonYear).then(setPubs).catch(() => setPubs([]));
  }, [seasonYear]);

  if (err) return <p className="error-text">{err}</p>;

  return (
    <section>
      <h2>Review &amp; publish — {seasonYear}</h2>
      <p className="subtle">
        What will change when this year is published, versus the last published <Link className="district-link" to="/help/glossary#snapshot">snapshot</Link> — the immutable copy the public app currently reads (browse it on the <Link className="district-link" to="/live">Live snapshot</Link>). Publishing itself is on the <Link className="district-link" to="/">Season dashboard</Link>. Re-publishing an already-live year is a <Link className="district-link" to="/help/glossary#mid-year-correction">correction</Link> — it bumps the version and is logged under <Link className="district-link" to="/corrections">Corrections &amp; updates</Link>.
      </p>

      <LiveBanner seasonYear={seasonYear} />

      {diff && (
        <div className="card">
          <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
            <span className="chip chip-published">{diff.totals.added} added</span>
            <span className="chip chip-error">{diff.totals.removed} removed</span>
            <span className="chip chip-warning">{diff.totals.changed} changed</span>
            {diff.baseline_version == null && <span className="subtle">(no prior publication — everything is new)</span>}
          </div>
          <p className="subtle" style={{ marginTop: 8 }}>
            Below, per district: <strong>+</strong> added opportunities · <strong>−</strong> removed · <strong>~</strong> changed (with the before → after fields).
          </p>
          {diff.totals.added + diff.totals.removed + diff.totals.changed === 0 && (
            <p className="subtle" style={{ marginTop: 12 }}>No pending changes. The draft matches the published snapshot.</p>
          )}
          {diff.groups.filter((g) => g.added.length + g.removed.length + g.changed.length > 0).slice(0, 40).map((g) => (
            <div key={g.district_code} className="accent-stripe" style={{ marginTop: 12 }}>
              <strong>District {g.district_code}</strong>
              <span className="subtle"> · +{g.added.length} / −{g.removed.length} / ~{g.changed.length}</span>
              {g.changed.slice(0, 5).map((c) => (
                <div key={c.rule_id} className="subtle" style={{ fontSize: "0.8rem", marginLeft: 12 }}>
                  {c.rule_id}: {c.changes?.map((ch) => `${ch.field}: ${String(ch.before)}→${String(ch.after)}`).join("; ")}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Publication history</h3>
        {pubs.length === 0 && (
          <p className="subtle">Not yet published — an approver publishes this year from the <Link className="district-link" to="/">Season dashboard</Link> once validation is green.</p>
        )}
        <div className="table-scroll">
          <table>
            <thead><tr><th>Version</th><th>Published</th><th>By</th><th>Rows</th><th>Note</th></tr></thead>
            <tbody>
              {pubs.map((p) => (
                <tr key={p.version}>
                  <td>v{p.version}</td><td>{p.published_at.slice(0, 10)}</td><td>{p.published_by}</td>
                  <td>{p.row_count}</td><td>{p.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
