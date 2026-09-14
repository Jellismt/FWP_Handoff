/**
 * @file 06-EditingAnInstrument.tsx
 * @module engage-mt/staff
 * @description User Guide chapter 6 — editing an instrument / quota, and the shared-instrument fan-out.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-14
 * @updated 2026-07-14
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { G, GuideNote, OpenInApp } from "../guidePrimitives.js";
import { WORKED_EXAMPLE_DISTRICT, WORKED_EXAMPLE_ROUTE } from "../guideExample.js";

export function EditingAnInstrumentChapter() {
  return (
    <>
      <p>
        A season window belongs to one row. An <G id="instrument">instrument</G> — the license or
        permit itself — is <strong>shared</strong>. When you click <strong>Instrument</strong> on a
        row and change its quota, apply-by date, or name, <strong>every</strong> row that uses that
        instrument changes with it. In the book that's invisible; in the tool it's the thing to be
        most careful about.
      </p>

      <div className="card">
        <p className="guide-eyebrow" style={{ marginBottom: 8 }}>
          One instrument, many opportunities
        </p>
        <svg className="help-diagram" viewBox="0 0 620 210" role="img"
          aria-label="One instrument box on the left connects to three opportunity rows on the right — the same Deer B License 270-01 appearing as separate printed rows in three hunting districts. Editing the instrument once changes all three.">
          <style>{`
            .i-box { fill: #eef4fb; stroke: #002855; stroke-width: 1.5; }
            .o-box { fill: #ffffff; stroke: #dee1e6; stroke-width: 1.5; }
            .i-lbl { font: 700 13px -apple-system, "Segoe UI", sans-serif; fill: #002855; }
            .i-sub { font: 500 11px -apple-system, "Segoe UI", sans-serif; fill: #636a76; }
            .o-lbl { font: 600 12px -apple-system, "Segoe UI", sans-serif; fill: #0f1419; }
            .o-sub { font: 500 10.5px -apple-system, "Segoe UI", sans-serif; fill: #636a76; }
            .i-edge { stroke: #046a38; stroke-width: 2; fill: none; }
          `}</style>
          <path className="i-edge" d="M230,105 C270,105 270,45 300,45" />
          <path className="i-edge" d="M230,105 L300,105" />
          <path className="i-edge" d="M230,105 C270,105 270,165 300,165" />
          <rect className="i-box" x="24" y="76" width="206" height="58" rx="10" />
          <text className="i-lbl" x="127" y="100" textAnchor="middle">Deer B License 270-01</text>
          <text className="i-sub" x="127" y="118" textAnchor="middle">quota 25 (1–150) · edit once</text>
          <rect className="o-box" x="300" y="24" width="296" height="42" rx="8" />
          <text className="o-lbl" x="316" y="42">Row in HD 270</text>
          <text className="o-sub" x="316" y="57">Antlerless Mule Deer</text>
          <rect className="o-box" x="300" y="84" width="296" height="42" rx="8" />
          <text className="o-lbl" x="316" y="102">Row in a neighboring HD</text>
          <text className="o-sub" x="316" y="117">Antlerless Mule Deer</text>
          <rect className="o-box" x="300" y="144" width="296" height="42" rx="8" />
          <text className="o-lbl" x="316" y="162">…and every other HD it lists under</text>
          <text className="o-sub" x="316" y="177">all move together</text>
        </svg>
      </div>

      <h4>The commission range is a guardrail</h4>
      <p>
        HD {WORKED_EXAMPLE_DISTRICT}'s Deer B License <strong>270-01</strong> has a{" "}
        <G id="quota">quota</G> of <strong>25</strong>, bounded to <strong>1–150</strong>. Those
        bounds are the commission-set range. If you try to set the current quota to 200, the{" "}
        <strong>database itself rejects it</strong> — you cannot save a number outside the range,
        even by accident. To change the count, edit the current quota within the range; to change
        the range, that's a separate, deliberate action.
      </p>

      <GuideNote kind="tip" title="Check before you change a shared instrument">
        Before editing an instrument's quota or dates, remember it may print in many districts. If
        you only mean to change one district, make sure you're editing a district-specific
        instrument, not a statewide one. Open{" "}
        <OpenInApp to={WORKED_EXAMPLE_ROUTE}>HD {WORKED_EXAMPLE_DISTRICT}</OpenInApp> and click{" "}
        <strong>Instrument</strong> on a row to see exactly what it carries.
      </GuideNote>
    </>
  );
}
