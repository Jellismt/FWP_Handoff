/**
 * @file DistrictBrowserScreen.tsx
 * @module engage-mt/staff
 * @description District browser: filter by geography (deer/elk HD vs antelope HD) +
 *              search, grouped by region, linking into the district detail editor.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-03
 * @updated 2026-07-05
 * @version 1.1.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api, type DistrictRow } from "../api.js";
import { useApp } from "../store.js";

export function DistrictBrowserScreen() {
  const seasonYear = useApp((s) => s.seasonYear);
  const [geography, setGeography] = useState("HD");
  const [rows, setRows] = useState<DistrictRow[]>([]);
  const [q, setQ] = useState("");

  useEffect(() => {
    api.districts(seasonYear, geography).then(setRows).catch(() => setRows([]));
  }, [seasonYear, geography]);

  const filtered = useMemo(
    () =>
      rows.filter(
        (r) =>
          r.district_code.includes(q) ||
          (r.district_name ?? "").toLowerCase().includes(q.toLowerCase()),
      ),
    [rows, q],
  );

  const byRegion = useMemo(() => {
    const m = new Map<number, DistrictRow[]>();
    for (const r of filtered) {
      const list = m.get(r.region_id) ?? [];
      list.push(r);
      m.set(r.region_id, list);
    }
    return [...m.entries()].sort((a, b) => a[0] - b[0]);
  }, [filtered]);

  return (
    <section>
      <h2>Districts</h2>
      <p className="subtle">
        A district is the smallest area regulations are written for. Deer/elk share one map (HD); antelope has its own — pick the geography, then a district to open its opportunities.
      </p>
      <p className="subtle">{filtered.length} districts · {geography === "HD" ? "Deer / Elk" : "Antelope"} geography · {seasonYear}</p>

      <div style={{ display: "flex", gap: 12, margin: "16px 0" }}>
        <div>
          <label>Geography</label>
          <select value={geography} onChange={(e) => setGeography(e.target.value)}>
            <option value="HD">Deer / Elk HD</option>
            <option value="ANTELOPE_HD">Antelope HD</option>
          </select>
        </div>
        <div style={{ flex: 1 }}>
          <label>Search</label>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="district number or name" style={{ width: "100%" }} />
        </div>
      </div>

      {byRegion.map(([region, list]) => (
        <div key={region} className="card">
          <h3 style={{ marginTop: 0 }}>Region {region}</h3>
          <div className="grid">
            {list.map((d) => (
              <div key={d.district_code} className="accent-stripe">
                <Link className="district-link" to={`/districts/${d.district_code}?geo=${geography}`}>
                  {d.district_code} — {d.district_name ?? "Unnamed"}
                </Link>
                <div className="subtle">{d.instrument_count} instruments</div>
              </div>
            ))}
          </div>
        </div>
      ))}
      {byRegion.length === 0 && (
        <p className="subtle">
          {q ? "No districts match — try a shorter code, or clear the search." : "No districts in this geography for this season year."}
        </p>
      )}
    </section>
  );
}
