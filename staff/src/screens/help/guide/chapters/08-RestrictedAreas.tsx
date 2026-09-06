/**
 * @file 08-RestrictedAreas.tsx
 * @module engage-mt/staff
 * @description User Guide chapter 8 — restricted areas (the Restricted Area Descriptions).
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-14
 * @updated 2026-07-14
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { G, GuideNote, OpenInApp } from "../guidePrimitives.js";

export function RestrictedAreasChapter() {
  return (
    <>
      <p>
        The book's <strong>Restricted Area Descriptions</strong> (pp. 28–30) define named areas with
        special rules — a weapons-restricted zone, a closure, an archery-only area, a{" "}
        <G id="cwd-zone">CWD management zone</G>. Districts then reference those areas by name instead
        of repeating the full description. The tool mirrors this exactly.
      </p>

      <div className="card">
        <h4 style={{ marginTop: 0 }}>Create once, link everywhere</h4>
        <p style={{ marginBottom: 6 }}>
          A <G id="restricted-area">restricted area</G> is authored one time on the{" "}
          <OpenInApp to="/restricted-areas">Restricted areas</OpenInApp> screen, then linked to the
          districts it applies to. Change the description once and every district that references it
          shows the update — the same shared-object idea as instruments.
        </p>
        <p style={{ margin: 0 }}>
          The <G id="restricted-area-types">types</G> match the book's categories: Restricted,
          Weapons restricted, Closure, Archery only, and Management zone.
        </p>
      </div>

      <h4>Restricted area vs. restriction — don't mix them up</h4>
      <p>
        These sound alike but are different tools:
      </p>
      <ul>
        <li>
          A <G id="restricted-area">restricted area</G> is a <strong>place</strong> with special
          rules, linked to districts.
        </li>
        <li>
          A <G id="restriction">restriction</G> is a <strong>coded limit on one row</strong> —
          "Private land only", "Youth only", <G id="pthfv">PTHFV</G> — set with the{" "}
          <strong>Restrictions</strong> button on that opportunity.
        </li>
      </ul>

      <GuideNote kind="tip" title="Free-text belongs in a district note">
        For guidance that isn't a coded restriction or a named area — a plain-English heads-up for a
        district — use a <G id="district-note">district note</G>, optionally scoped to one species.
        It prints alongside that district's tables.
      </GuideNote>
    </>
  );
}
