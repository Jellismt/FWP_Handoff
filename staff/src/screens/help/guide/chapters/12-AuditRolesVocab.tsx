/**
 * @file 12-AuditRolesVocab.tsx
 * @module engage-mt/staff
 * @description User Guide chapter 12 — audit log, roles, and what you can't edit here (and why).
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-14
 * @updated 2026-07-14
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { Link } from "react-router-dom";
import { G, GuideNote, OpenInApp } from "../guidePrimitives.js";

export function AuditRolesVocabChapter() {
  return (
    <>
      <h4>Everything is logged</h4>
      <p>
        Every insert, update, delete, and publish is written to the{" "}
        <OpenInApp to="/audit">Audit log</OpenInApp> with who did it and a field-level before/after
        diff. It's read-only and open to every role — so "when did this quota change, and to what?"
        always has an answer. This is also what the <G id="optimistic-lock">optimistic lock</G> leans
        on to know a record changed under you.
      </p>

      <h4>Who can do what</h4>
      <p className="subtle" style={{ marginTop: 0 }}>
        Roles are ordered — each includes the ones below it. The server enforces them; the screens
        just hide what you can't do. See <G id="roles">roles</G>.
      </p>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Role</th>
              <th>Can</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <strong>viewer</strong>
              </td>
              <td>Read everything, including the audit log.</td>
            </tr>
            <tr>
              <td>
                <strong>editor</strong>
              </td>
              <td>All of viewer, plus create / edit / archive draft regulations.</td>
            </tr>
            <tr>
              <td>
                <strong>approver</strong>
              </td>
              <td>All of editor, plus publish a season year and approve corrections.</td>
            </tr>
            <tr>
              <td>
                <strong>admin</strong>
              </td>
              <td>All of approver, plus manage staff accounts.</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h4>What you can't edit here — on purpose</h4>
      <p>
        Some things in the book are statutory reference that changes at most once a year: the fixed
        vocabularies (species, the five <G id="season-types">season types</G>,{" "}
        <G id="restriction">restriction</G> codes, <G id="legal-animal-class">legal animal classes</G>,
        pricing <G id="audience">audiences</G>) and the sunrise-sunset shooting-hour tables. Those
        aren't edited through a screen — they're maintained by re-running the data load — so the
        everyday editing surface stays focused on what actually changes each cycle.
      </p>

      <GuideNote kind="tip" title="You've reached the end">
        That's the whole loop: find a district, read its table, edit a draft, validate, publish a
        snapshot, and print the book — with an audit trail the whole way. Keep the{" "}
        <Link className="glossary-link" to="/help/glossary">
          Glossary
        </Link>{" "}
        handy for any single term, and <Link className="glossary-link" to="/help/overview">
          How it fits together
        </Link>{" "}
        for the one-page picture.
      </GuideNote>
    </>
  );
}
