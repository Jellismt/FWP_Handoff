/**
 * @file 11-Publishing.tsx
 * @module engage-mt/staff
 * @description User Guide chapter 11 — publishing, snapshots, corrections, and the printed book.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-14
 * @updated 2026-07-14
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { G, GuideNote, OpenInApp, StepList, UpdateFlow } from "../guidePrimitives.js";

export function PublishingChapter() {
  return (
    <>
      <p>
        This is where your drafts become the real book. Publishing is deliberately a separate step,
        done by an <G id="roles">approver</G>, on its own screen, with a required note — so a year
        never goes live by accident.
      </p>

      <UpdateFlow steps={["Draft", "Edit", "Validate", "Publish", "Snapshot"]} />

      <StepList
        steps={[
          {
            title: "Open Review & publish",
            body: (
              <>
                An approver opens <OpenInApp to="/review">Review &amp; publish</OpenInApp>. It shows
                the year, the next version number, and the validation findings.
              </>
            ),
          },
          {
            title: "Write a changelog note",
            body: (
              <>
                Publishing requires a one-line <G id="changelog-note">changelog note</G> — "moved HD
                270 general deer back one week", say. It's the permanent record of what this version
                changed.
              </>
            ),
          },
          {
            title: "Publish",
            body: (
              <>
                One transaction flips every draft row to published and writes an immutable{" "}
                <G id="snapshot">snapshot</G> under a new <G id="version">version</G> (v1, then v2,
                v3…). Regulations, fees, dates, contacts, and content are all captured together — one
                book, one version.
              </>
            ),
          },
        ]}
      />

      <h4>Where it goes</h4>
      <p>
        The public read API serves only the <G id="snapshot">snapshot</G> — never your drafts — so
        the <strong>Engage MT app</strong> shows the published year. And the{" "}
        <OpenInApp to="/print">Print export</OpenInApp> builds the printed book from the very same
        snapshot: an instant HTML proof, a one-click PDF, or the ICML package the designer flows into
        the print template. The screen you edit and the book on the shelf are guaranteed to match.
      </p>

      <GuideNote kind="tip" title="Fixing an already-published year">
        Found a mistake after publishing? Edit the rows — they become{" "}
        <G id="draft">draft</G> revisions <em>without</em> touching the live snapshot — then have an
        approver re-publish. That's a <G id="mid-year-correction">mid-year correction</G>, and it
        creates v2, v3, and so on, each with its own note. The public app keeps showing the old
        version until the new one is published.
      </GuideNote>
    </>
  );
}
