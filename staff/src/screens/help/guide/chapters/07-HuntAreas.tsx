/**
 * @file 07-HuntAreas.tsx
 * @module engage-mt/staff
 * @description User Guide chapter 7 — hunt areas: one row, many districts (the Multi-District table).
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-14
 * @updated 2026-07-14
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { G, GuideNote, OpenInApp, PrintVsApp } from "../guidePrimitives.js";

export function HuntAreasChapter() {
  return (
    <>
      <p>
        Some licenses aren't valid in just one district. The book has a whole{" "}
        <strong>Multi-District Licenses &amp; Permits</strong> table listing licenses good across a
        list of HDs — "valid in 201, 204, 240…". In the tool, that list is a{" "}
        <G id="hunt-area">hunt area</G>, and it's how one row can span many districts without being
        typed out over and over.
      </p>

      <PrintVsApp
        book={
          <div>
            <p className="guide-eyebrow">Multi-District table (pp. 126–127)</p>
            <p style={{ margin: 0, fontSize: "0.85rem" }}>
              <strong>Permit 240-50</strong> — valid in HDs 201, 204, 240.
            </p>
          </div>
        }
        app={
          <div>
            <p className="guide-eyebrow">A MULTI hunt area</p>
            <p style={{ margin: 0, fontSize: "0.85rem" }}>
              Hunt area <strong>201-204-240</strong> with three district members. One opportunity
              points at it, and the row is valid in all three.
            </p>
          </div>
        }
        caption={
          <>
            A hunt area can be a single district, a named <G id="portion">portion</G> of one, or a{" "}
            MULTI set of many. Manage them on the{" "}
            <OpenInApp to="/hunt-areas">Hunt areas</OpenInApp> screen.
          </>
        }
      />

      <p>
        This is also how a <G id="statewide-archery-license">statewide archery license</G> works: one
        instrument, one shared quota, on a hunt area that lists every district it covers — so the
        book prints it once in the multi-district table instead of in every HD.
      </p>

      <GuideNote kind="tip" title="Working with portions">
        A <G id="portion">portion</G> is a named part of a district (e.g. the R7 antelope areas
        north vs. south of the Yellowstone River). Portions are <strong>synced from FWP's public
        ESRI portion layers</strong>, so you don't hand-author them — browse them on the{" "}
        <OpenInApp to="/portions">District portions</OpenInApp> screen, and attach one to a
        regulation with <strong>Members → Add portion</strong> here. This editor also preserves any
        portion members when you replace an area's district set. When a regulation is scoped to a
        portion, the public app tags it <em>"Applies in: &lt;portion name&gt;"</em> and emphasizes
        that rule when a hunter taps inside the portion on the map.
      </GuideNote>

      <GuideNote kind="warning" title="Re-point before you delete">
        A hunt area can have opportunities riding on it. Before deleting or replacing one, use{" "}
        <G id="re-point">re-point</G> to move its opportunities onto another hunt area first —
        otherwise you'd strand the rows that depend on it.
      </GuideNote>
    </>
  );
}
