/**
 * @file 10-Validating.tsx
 * @module engage-mt/staff
 * @description User Guide chapter 10 — validating before you publish (blocking vs. warning).
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-14
 * @updated 2026-07-14
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { G, GuideNote, OpenInApp } from "../guidePrimitives.js";

export function ValidatingChapter() {
  return (
    <>
      <p>
        A printed book gets proofread before it goes to press. The tool proofreads continuously. The{" "}
        <OpenInApp to="/">Season dashboard</OpenInApp> runs <G id="validation">validation</G> on the
        active year every time you open it, and sorts what it finds into two buckets.
      </p>

      <div className="card">
        <p style={{ margin: "0 0 8px" }}>
          <span className="chip chip-error">Blocking error</span> — must be fixed before the year can
          be published.
        </p>
        <ul style={{ margin: 0 }}>
          <li>An instrument with no opportunities on it.</li>
          <li>
            A <G id="season-window">season window</G> that falls outside the season year.
          </li>
          <li>
            A <G id="quota">quota</G> outside the commission's min–max range.
          </li>
        </ul>
      </div>

      <div className="card">
        <p style={{ margin: "0 0 8px" }}>
          <span className="chip chip-warning">Warning</span> — advisory; worth a look, but doesn't
          block publishing.
        </p>
        <ul style={{ margin: 0 }}>
          <li>A district with no general-season row, for example — often intentional, sometimes not.</li>
        </ul>
      </div>

      <GuideNote kind="tip" title="Validation is your pre-flight checklist">
        Don't wait until publish day. Glance at the dashboard as you work — clearing errors as they
        appear is far easier than hunting down a dozen at once. When the blocking count hits zero,
        the year is ready for an approver.
      </GuideNote>
    </>
  );
}
