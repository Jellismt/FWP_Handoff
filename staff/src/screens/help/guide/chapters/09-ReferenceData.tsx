/**
 * @file 09-ReferenceData.tsx
 * @module engage-mt/staff
 * @description User Guide chapter 9 — the rest of the book: fees, dates, contacts, maps, content.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-14
 * @updated 2026-07-14
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { G, OpenInApp } from "../guidePrimitives.js";

export function ReferenceDataChapter() {
  return (
    <>
      <p>
        The district tables are the core of the book, but they aren't the whole book. The front and
        back — fee charts, important dates, the contact list, the maps, and all the explanatory prose
        — each has its own screen under <strong>Reference</strong> in the left nav. Each screen owns
        one recognizable part of the printed book.
      </p>

      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>In the book</th>
              <th>Screen</th>
              <th>What it holds</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>License &amp; Permit fee charts (pp. 12–16)</td>
              <td>
                <OpenInApp to="/fees">Fees</OpenInApp>
              </td>
              <td>
                Each <G id="product">fee product</G> with its per-<G id="audience">audience</G> price
                grid (resident, nonresident, youth, senior…).
              </td>
            </tr>
            <tr>
              <td>Important Dates (p. 11)</td>
              <td>
                <OpenInApp to="/important-dates">Important dates</OpenInApp>
              </td>
              <td>
                Season windows, application and purchase deadlines, drawing-result dates — each an{" "}
                <G id="important-date">important date</G>.
              </td>
            </tr>
            <tr>
              <td>Contact List (pp. 143–144)</td>
              <td>
                <OpenInApp to="/contacts">Contacts</OpenInApp>
              </td>
              <td>
                FWP offices, hotlines, agencies, tribal governments — grouped by kind. Each is a{" "}
                <G id="contact">contact</G>.
              </td>
            </tr>
            <tr>
              <td>Front matter, CWD, definitions, laws &amp; rules, safety…</td>
              <td>
                <OpenInApp to="/content">Content</OpenInApp>
              </td>
              <td>
                The book's prose sections, each filed under a{" "}
                <G id="content-category">content category</G>, written in markdown.
              </td>
            </tr>
            <tr>
              <td>District &amp; region maps, figures, cover</td>
              <td>
                <OpenInApp to="/assets">Maps &amp; assets</OpenInApp>
              </td>
              <td>
                The map and figure registry. Some are{" "}
                <G id="placeholder-asset">placeholders</G> until FWP's map system is wired in.
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <p>
        All of this reference data publishes into the same immutable{" "}
        <G id="snapshot">snapshot</G> as the regulations, so the book and the public app always show
        one consistent version. That's the next chapter.
      </p>
    </>
  );
}
