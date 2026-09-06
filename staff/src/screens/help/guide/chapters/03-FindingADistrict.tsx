/**
 * @file 03-FindingADistrict.tsx
 * @module engage-mt/staff
 * @description User Guide chapter 3 — finding your district (region → HD 270), and why a
 *              district is a code (the spatial key) rather than a stored map shape.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-14
 * @updated 2026-07-14
 * @version 1.1.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { G, GuideNote, OpenInApp, PrintVsApp } from "../guidePrimitives.js";
import {
  WORKED_EXAMPLE_DISTRICT,
  WORKED_EXAMPLE_NAME,
  WORKED_EXAMPLE_REGION,
  WORKED_EXAMPLE_ROUTE,
} from "../guideExample.js";

export function FindingADistrictChapter() {
  return (
    <>
      <p>
        In the book, a hunter finds their district by flipping to the region map, locating the
        numbered <G id="hd">hunting district</G>, and turning to its page of tables. The Regs Manager
        works the same way, just faster.
      </p>

      <PrintVsApp
        book={
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            <li>Open the book to the region maps.</li>
            <li>
              Find <strong>Region {WORKED_EXAMPLE_REGION}</strong> and the boundary for HD{" "}
              {WORKED_EXAMPLE_DISTRICT}.
            </li>
            <li>Turn to that district's regulation page.</li>
          </ul>
        }
        app={
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            <li>
              Open <strong>Districts</strong> in the left nav.
            </li>
            <li>
              It's grouped by <G id="region">region</G> — expand Region {WORKED_EXAMPLE_REGION}.
            </li>
            <li>
              Click <strong>{WORKED_EXAMPLE_DISTRICT}</strong> to open its detail screen.
            </li>
          </ul>
        }
        caption={
          <>
            Same journey — region, then district, then the rules. Try it:{" "}
            <OpenInApp to="/districts">Open the district browser</OpenInApp> or jump straight to{" "}
            <OpenInApp to={WORKED_EXAMPLE_ROUTE}>
              HD {WORKED_EXAMPLE_DISTRICT} — {WORKED_EXAMPLE_NAME}
            </OpenInApp>
            .
          </>
        }
      />

      <p>
        Deer and elk share the same district map, so HD {WORKED_EXAMPLE_DISTRICT} carries rules for{" "}
        <strong>both</strong> species on one screen. Antelope is mapped separately as an{" "}
        <G id="antelope-hd">Antelope HD</G> — same idea, different numbered map. The tool keeps those
        two geographies distinct exactly as the book does.
      </p>

      <GuideNote title="Why the district is a number, not a shape">
        The boundary you picture for HD {WORKED_EXAMPLE_DISTRICT} doesn't live in this tool — it lives
        in FWP's own live map service. What the Regs Manager stores is the{" "}
        <G id="district-code">district code</G>, and that code is the{" "}
        <G id="spatial-key">spatial key</G> that ties the rules you author to the shape on the map. So
        when a hunter taps the public app, it reads the code back from FWP's{" "}
        <G id="gis-layer">ESRI map layer</G> and asks this system for that code's rules — only the code
        travels, never a shape. It's also why there's no map data to move if this database is ever
        migrated: the maps stay FWP's.
      </GuideNote>
    </>
  );
}
