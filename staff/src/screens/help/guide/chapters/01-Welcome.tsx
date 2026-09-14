/**
 * @file 01-Welcome.tsx
 * @module engage-mt/staff
 * @description User Guide chapter 1 — welcome, how to use the guide, and the HD 270 running example.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-14
 * @updated 2026-07-14
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { Link } from "react-router-dom";
import { GuideNote, OpenInApp } from "../guidePrimitives.js";
import {
  WORKED_EXAMPLE_DISTRICT,
  WORKED_EXAMPLE_NAME,
  WORKED_EXAMPLE_ROUTE,
} from "../guideExample.js";

export function WelcomeChapter() {
  return (
    <>
      <p>
        You already know the printed regulations book cover to cover. This guide connects that
        book — the one hunters hold in their hands — to the tool that now produces it. Every
        section starts from something you recognize in print, then shows you the same thing in the
        Regs Manager, and what happens when you change it.
      </p>
      <p>
        Nothing here is theory. We follow <strong>one real district the whole way through</strong>:{" "}
        <strong>
          HD&nbsp;{WORKED_EXAMPLE_DISTRICT} — {WORKED_EXAMPLE_NAME}
        </strong>
        , in Region&nbsp;2. It has a general license, drawing permits, and B-licenses across both
        deer and elk, so it shows off almost everything the tool can do. Keep it open in a second
        tab as you read:{" "}
        <OpenInApp to={WORKED_EXAMPLE_ROUTE}>Open HD {WORKED_EXAMPLE_DISTRICT} in the app</OpenInApp>.
      </p>

      <div className="card">
        <h4 style={{ margin: "0 0 8px", color: "var(--fwp-blue)" }}>How to use this guide</h4>
        <ul>
          <li>
            <strong>Read top to bottom the first time.</strong> The chapters build on each other —
            geography, then the district table, then editing, then publishing.
          </li>
          <li>
            <strong>Green links with an arrow (↗)</strong> open the actual live screen the chapter
            is describing. Click through and poke around; you can't break anything by looking.
          </li>
          <li>
            <strong>Blue underlined terms</strong> jump to a one-line definition in the{" "}
            <Link className="glossary-link" to="/help/glossary">
              Glossary
            </Link>
            .
          </li>
          <li>
            Want the one-page map of how it all fits instead of the walkthrough? See{" "}
            <Link className="glossary-link" to="/help/overview">
              How it fits together
            </Link>
            .
          </li>
        </ul>
      </div>

      <GuideNote kind="tip" title="You cannot publish anything by accident">
        Everything you type is saved as a <em>draft</em>, and drafts never reach the public app or
        the printed book. Only an approver, on a separate screen, with a required note, makes a year
        go live. So explore freely — we'll cover exactly how publishing works near the end.
      </GuideNote>
    </>
  );
}
