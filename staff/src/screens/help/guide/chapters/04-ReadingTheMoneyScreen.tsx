/**
 * @file 04-ReadingTheMoneyScreen.tsx
 * @module engage-mt/staff
 * @description User Guide chapter 4 — reading the district table (the "money screen"), column by column.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-14
 * @updated 2026-07-14
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { BookRow, G, OpenInApp, PrintVsApp } from "../guidePrimitives.js";
import {
  DEER_ELK_SEASON_COLS,
  HD270_DEER,
  WORKED_EXAMPLE_DISTRICT,
  WORKED_EXAMPLE_ROUTE,
} from "../guideExample.js";

export function ReadingTheMoneyScreenChapter() {
  return (
    <>
      <p>
        This is the heart of it. Each district's page in the book is a table, and{" "}
        <strong>every row of that table is one rule</strong> — a license, what it lets you take, when
        the seasons are, how many are issued, and any strings attached. The tool calls one of those
        rows an <G id="opportunity">opportunity</G>, and the district detail screen is the same
        table, made editable.
      </p>

      <PrintVsApp
        bookLabel="In the printed book — HD 270, deer"
        appLabel="On the district detail screen"
        book={<BookRow variant="book" seasonCols={DEER_ELK_SEASON_COLS} rows={HD270_DEER} />}
        app={<BookRow variant="app" seasonCols={DEER_ELK_SEASON_COLS} rows={HD270_DEER} />}
        caption={
          <>
            Same three rows, same columns. On the left they're typeset for print; on the right
            they're live records you can edit. See it for real:{" "}
            <OpenInApp to={WORKED_EXAMPLE_ROUTE}>
              Open HD {WORKED_EXAMPLE_DISTRICT}'s table
            </OpenInApp>
            .
          </>
        }
      />

      <h4>Reading a row, column by column</h4>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Column</th>
              <th>What the book shows</th>
              <th>What it is in the tool</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <strong>Instrument</strong>
              </td>
              <td>The license or permit line — "General Deer License", "Deer Permit 270-50".</td>
              <td>
                The shared <G id="instrument">instrument</G>. One instrument backs every row that
                uses it; a <G id="permit">Permit</G> is a <G id="draw">drawing</G>, a{" "}
                <G id="general">General</G> license is <G id="otc">over-the-counter</G>.
              </td>
            </tr>
            <tr>
              <td>
                <strong>Legal animal</strong>
              </td>
              <td>"Either-sex White-tailed Deer", "Antlered Buck Mule Deer".</td>
              <td>
                The <G id="legal-animal-class">legal animal class</G> — the sex/age/antler category
                that may be taken.
              </td>
            </tr>
            <tr>
              <td>
                <strong>Early · Archery · General · Muzzleloader · Late</strong>
              </td>
              <td>The date ranges printed under each season heading.</td>
              <td>
                The five <G id="season-types">season types</G>. Each date range is a{" "}
                <G id="season-window">season window</G>; a row can have several at once. A dash means
                that season isn't open for this row.
              </td>
            </tr>
            <tr>
              <td>
                <strong>Quota</strong>
              </td>
              <td>A number, or "Unlimited".</td>
              <td>
                The <G id="quota">quota</G>. In the tool it shows the current count with the
                commission range in parentheses — <strong>25 (1–150)</strong> — or{" "}
                <G id="unlimited">UNL</G>.
              </td>
            </tr>
            <tr>
              <td>
                <strong>Restrictions</strong>
              </td>
              <td>The fine print — "Private land only", "Youth only".</td>
              <td>
                Coded <G id="restriction">restrictions</G> plus any{" "}
                <G id="validity-note">validity note</G>.
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <h4>One instrument, printed on many rows</h4>
      <p>
        Look at the <strong>General Deer License</strong> row above. In HD {WORKED_EXAMPLE_DISTRICT}{" "}
        alone that one license appears on several printed lines (either-sex, antlered buck, a youth
        line), and it appears in dozens of <em>other</em> districts too. In the book those are just
        repeated ink. In the tool they are all the <strong>same instrument</strong> — so a fix to its
        dates or quota flows to every row at once. That's the single biggest difference between
        reading the book and editing it, and it's the subject of Chapter&nbsp;6.
      </p>
    </>
  );
}
