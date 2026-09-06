/**
 * @file LiveSnapshotScreen.tsx
 * @module engage-mt/staff
 * @description Read-only "what the public sees now" view: the published Deer/Elk/Antelope
 *              regulations exactly as the public Engage MT app reads them (the latest
 *              published snapshot, via the same public read endpoint), grouped by district.
 *              This is deliberately NOT the working draft — it answers "is the live snapshot
 *              right?" without risk of editing it. Edits happen in Districts + re-publish.
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
import type { NormalizedRegulation } from "@engage-mt/regs-shared";
import { api } from "../api.js";
import { useApp } from "../store.js";
import { LiveBanner } from "../components/ui.js";

/** The three species this tool covers today (D/E/A). */
const SPECIES = [
  { id: "", label: "All" },
  { id: "deer", label: "Deer" },
  { id: "elk", label: "Elk" },
  { id: "antelope", label: "Antelope" },
] as const;

/** Format the parsed weapon windows into a compact "Archery Sep 05–Oct 18 · General …" line. */
function windowsLabel(r: NormalizedRegulation): string {
  if (!r.weapon_windows || r.weapon_windows.length === 0) return "—";
  return r.weapon_windows.map((w) => `${w.weapon} ${w.range}`).join(" · ");
}

export function LiveSnapshotScreen() {
  const seasonYear = useApp((s) => s.seasonYear);
  const [species, setSpecies] = useState<string>("");
  const [rows, setRows] = useState<NormalizedRegulation[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [openDistrict, setOpenDistrict] = useState<string | null>(null);

  useEffect(() => {
    setRows(null);
    setErr(null);
    api
      .publishedRegulations(seasonYear, species || undefined)
      .then(setRows)
      .catch((e) => setErr(String(e)));
  }, [seasonYear, species]);

  // Group by district (geography_id), preserving a display name + region.
  const districts = useMemo(() => {
    const map = new Map<string, { code: string; name: string; region: number | null; rows: NormalizedRegulation[] }>();
    for (const r of rows ?? []) {
      let g = map.get(r.geography_id);
      if (!g) {
        g = { code: r.geography_id, name: r.district_name ?? r.geography_id, region: r.region, rows: [] };
        map.set(r.geography_id, g);
      }
      g.rows.push(r);
    }
    return [...map.values()].sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
  }, [rows]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { deer: 0, elk: 0, antelope: 0 };
    for (const r of rows ?? []) if (r.species in c) c[r.species] = (c[r.species] ?? 0) + 1;
    return c;
  }, [rows]);

  return (
    <section>
      <h2>Live snapshot — {seasonYear}</h2>
      <p className="subtle">
        The Deer, Elk &amp; Antelope regulations <strong>exactly as the public Engage&nbsp;MT app reads them right
        now</strong> — the latest published snapshot, not your working draft. This view is read-only. To change what's
        live, edit in <Link className="district-link" to="/districts">Districts</Link> and then{" "}
        <Link className="district-link" to="/review">re-publish</Link>.
      </p>

      <LiveBanner seasonYear={seasonYear} />

      <div className="segmented" role="group" aria-label="Species filter" style={{ margin: "12px 0" }}>
        {SPECIES.map((s) => (
          <button
            key={s.id || "all"}
            className={species === s.id ? "seg-active" : "secondary"}
            aria-pressed={species === s.id}
            onClick={() => { setSpecies(s.id); setOpenDistrict(null); }}
          >
            {s.label}
          </button>
        ))}
      </div>

      {err && <p className="error-text">{err}</p>}
      {rows === null && !err && <p className="subtle">Loading the live snapshot…</p>}

      {rows !== null && rows.length === 0 && (
        <p className="subtle">
          Nothing is published for {seasonYear} yet — the public app shows no D/E/A regulations until an approver
          publishes.
        </p>
      )}

      {rows !== null && rows.length > 0 && (
        <>
          <p className="subtle" style={{ marginBottom: 12 }}>
            <span className="chip chip-species">{counts.deer} deer</span>{" "}
            <span className="chip chip-species">{counts.elk} elk</span>{" "}
            <span className="chip chip-species">{counts.antelope} antelope</span>{" "}
            across <strong>{districts.length}</strong> districts · {rows.length} published rules.
          </p>

          {districts.map((d) => {
            const open = openDistrict === d.code;
            return (
              <div key={d.code} className="card" style={{ padding: 0 }}>
                <button
                  className="live-district-head"
                  aria-expanded={open}
                  onClick={() => setOpenDistrict(open ? null : d.code)}
                >
                  <span>
                    <strong>District {d.code}</strong>
                    {d.name && d.name !== d.code ? <span className="subtle"> · {d.name}</span> : null}
                    {d.region != null ? <span className="subtle"> · Region {d.region}</span> : null}
                  </span>
                  <span className="subtle">{d.rows.length} rule{d.rows.length === 1 ? "" : "s"} {open ? "▲" : "▼"}</span>
                </button>
                {open && (
                  <div className="table-scroll" style={{ padding: "0 16px 12px" }}>
                    <table>
                      <thead>
                        <tr>
                          <th>Species</th><th>Legal animal</th><th>License / permit</th>
                          <th>Draw?</th><th>Seasons</th><th>Quota</th><th>Notes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {d.rows.map((r) => (
                          <tr key={r.rule_id}>
                            <td style={{ textTransform: "capitalize" }}>{r.species}</td>
                            <td>{r.legal_animal}</td>
                            <td>{r.required_license}</td>
                            <td>{r.is_draw ? "Draw" : "OTC"}</td>
                            <td className="subtle">{windowsLabel(r)}</td>
                            <td>{r.quota ?? "—"}</td>
                            <td className="subtle">{r.opportunity_specific || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </>
      )}
    </section>
  );
}
