/**
 * @file 05-EditingASeason.tsx
 * @module engage-mt/staff
 * @description User Guide chapter 5 — editing a season window, step by step (a worked example).
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-14
 * @updated 2026-07-14
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { G, GuideNote, OpenInApp, StepList, UpdateFlow } from "../guidePrimitives.js";
import { WORKED_EXAMPLE_DISTRICT, WORKED_EXAMPLE_ROUTE } from "../guideExample.js";

export function EditingASeasonChapter() {
  return (
    <>
      <p>
        Say the commission moved HD {WORKED_EXAMPLE_DISTRICT}'s general deer season back a week.
        Here's the whole edit, start to finish. Nothing you do here touches the live book until an
        approver publishes — so follow along on a draft year.
      </p>

      <StepList
        steps={[
          {
            title: "Open the district",
            body: (
              <>
                Go to <OpenInApp to={WORKED_EXAMPLE_ROUTE}>HD {WORKED_EXAMPLE_DISTRICT}</OpenInApp> and
                find the row you want — the General Deer License, either-sex, in the deer table.
              </>
            ),
          },
          {
            title: "Click Seasons on that row",
            body: (
              <>
                Each row has <strong>Seasons</strong>, <strong>Restrictions</strong>, and{" "}
                <strong>Instrument</strong> buttons. <strong>Seasons</strong> opens the five season
                windows inline, right under the row.
              </>
            ),
          },
          {
            title: "Set the new dates",
            body: (
              <>
                Change the <strong>General</strong> window's start and end dates. The editor won't
                let you save a window whose end falls before its start, or one that lands outside the{" "}
                <G id="season-year">season year</G>.
              </>
            ),
          },
          {
            title: "Save",
            body: (
              <>
                Saving writes a <G id="draft">draft</G>. The row updates immediately on screen; the
                public app and the book do not change yet.
              </>
            ),
          },
        ]}
      />

      <h4>What just happened, underneath</h4>
      <UpdateFlow steps={["Draft", "Edit", "Validate", "Publish", "Snapshot"]} />
      <p>
        You've completed the first two steps — the row is a <G id="draft">draft</G> edit. It waits
        there, fully reversible, until validation is green and an approver publishes the year. We
        cover the rest of that pipeline in Chapters 10 and 11.
      </p>

      <GuideNote kind="warning" title="If someone edited the row before you">
        Two people can have the same district open. If a teammate saved a change to this row after
        you loaded it, your save is rejected with a "changed by someone else" message — this is the{" "}
        <G id="optimistic-lock">optimistic lock</G>. Reload, re-check the row, and redo your edit.
        It's a safeguard, not an error on your part.
      </GuideNote>
    </>
  );
}
