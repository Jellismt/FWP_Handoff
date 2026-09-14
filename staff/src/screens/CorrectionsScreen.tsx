/**
 * @file CorrectionsScreen.tsx
 * @module engage-mt/staff
 * @description Corrections & updates log: every mid-year correction to an already-published
 *              season year (publication v2, v3, …) — when, by whom, the affected D/E/A scope,
 *              and the plain-English summary that hunters see. This is the errata companion to
 *              the actual fix: a correction both edits the live snapshot (edit rows → re-publish)
 *              AND is recorded here + surfaced in the public app. First publish (v1) is the book,
 *              not a correction, so it is listed separately for context.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-14
 * @updated 2026-07-14
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type PublicationDto } from "../api.js";
import { useApp } from "../store.js";

export function CorrectionsScreen() {
  const seasonYear = useApp((s) => s.seasonYear);
  const [pubs, setPubs] = useState<PublicationDto[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setPubs(null);
    setErr(null);
    api.publications(seasonYear).then(setPubs).catch((e) => setErr(String(e)));
  }, [seasonYear]);

  const corrections = (pubs ?? []).filter((p) => p.is_correction || p.version >= 2);
  const original = (pubs ?? []).find((p) => p.version === 1) ?? null;

  return (
    <section>
      <h2>Corrections &amp; updates — {seasonYear}</h2>
      <p className="subtle">
        Every mid-year correction to the published {seasonYear} regulations. A correction fixes the live snapshot
        (edit the rows in <Link className="district-link" to="/districts">Districts</Link>, then{" "}
        <Link className="district-link" to="/review">re-publish</Link> — that bumps the version) <em>and</em> is logged
        here + shown to hunters in the Engage&nbsp;MT app as “what changed since the book.” The first publish (v1) is the
        book itself, not a correction.
      </p>

      {err && <p className="error-text">{err}</p>}
      {pubs === null && !err && <p className="subtle">Loading…</p>}

      {pubs !== null && corrections.length === 0 && (
        <div className="card">
          <p className="subtle" style={{ margin: 0 }}>
            No corrections yet for {seasonYear}. {original
              ? <>The book was published {original.published_at.slice(0, 10)} (v1). To issue a correction, edit the rows and re-publish — it will appear here as v2.</>
              : <>This year isn't published yet — publish it from the <Link className="district-link" to="/">Season dashboard</Link> first.</>}
          </p>
        </div>
      )}

      {corrections.map((p) => (
        <div key={p.version} className="card accent-stripe">
          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <span className="chip chip-published">v{p.version}</span>
            <strong>{p.correction_summary || p.note || `Correction v${p.version}`}</strong>
            <span className="subtle">· {p.published_at.slice(0, 10)} · {p.published_by} · {p.row_count} rules live</span>
          </div>
          {(p.affected_species || p.affected_districts) && (
            <p className="subtle" style={{ marginTop: 6 }}>
              {p.affected_species && <>Species: <strong>{p.affected_species}</strong>{p.affected_districts ? " · " : ""}</>}
              {p.affected_districts && <>Districts: <strong>{p.affected_districts}</strong></>}
            </p>
          )}
          {p.correction_summary && p.note && p.note !== p.correction_summary && (
            <p className="subtle" style={{ marginTop: 6 }}>Changelog note: “{p.note}”</p>
          )}
        </div>
      ))}

      {original && (
        <p className="subtle" style={{ marginTop: 16 }}>
          Original publication: <strong>v1</strong> · {original.published_at.slice(0, 10)} · {original.published_by}
          {original.note ? ` · “${original.note}”` : ""}.
        </p>
      )}
    </section>
  );
}
