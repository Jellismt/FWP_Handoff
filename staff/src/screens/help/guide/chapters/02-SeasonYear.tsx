/**
 * @file 02-SeasonYear.tsx
 * @module engage-mt/staff
 * @description User Guide chapter 2 — the season year is your book edition.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-14
 * @updated 2026-07-14
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { G, GuideNote, PrintVsApp } from "../guidePrimitives.js";

export function SeasonYearChapter() {
  return (
    <>
      <p>
        Every printed book is stamped with a year — the <strong>2026 Deer, Elk &amp; Antelope
        Regulations</strong>. That year is the single most important thing to get right in the tool,
        because <strong>everything you see and edit belongs to one season year at a time</strong>.
      </p>

      <PrintVsApp
        book={
          <div style={{ textAlign: "center", padding: "18px 6px" }}>
            <div style={{ fontSize: "0.72rem", letterSpacing: "0.08em", textTransform: "uppercase" }}>
              Montana
            </div>
            <div style={{ fontSize: "1.15rem", fontWeight: 700, margin: "6px 0" }}>
              2026 Deer, Elk &amp; Antelope
            </div>
            <div style={{ fontSize: "0.85rem" }}>Hunting Regulations</div>
          </div>
        }
        app={
          <div>
            <label style={{ marginBottom: 4 }}>Season year</label>
            <select value="2026" disabled style={{ width: 160 }} aria-label="Season year (example)">
              <option>2026</option>
            </select>
            <p className="guide-caption" style={{ marginTop: 8 }}>
              The switcher lives at the top-right of every screen.
            </p>
          </div>
        }
        caption={
          <>
            Choosing a <G id="season-year">season year</G> is choosing which edition of the book you
            are looking at. Pick it once; every screen — districts, fees, contacts — then shows that
            year's data.
          </>
        }
      />

      <h4>Why the year runs March to February</h4>
      <p>
        A season year runs <strong>March&nbsp;1 → the end of February</strong>, matching the license
        year, not the calendar year. So season year <strong>2026</strong> covers 2026-03-01 through
        2027-02-28 — the whole 2026 hunting cycle, including late seasons that spill into January.
      </p>

      <GuideNote kind="tip" title="Two years live side by side">
        Next year's book can be built while this year's is still live and selling. You'll often have
        a published <strong>2026</strong> and a draft <strong>2027</strong> at the same time — the
        switcher is how you move between them. Later we'll cover{" "}
        <G id="clone-forward">cloning forward</G>, which starts next year as a copy of this one so
        you only edit what changed.
      </GuideNote>
    </>
  );
}
