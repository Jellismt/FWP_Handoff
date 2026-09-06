/**
 * @file UserGuideScreen.tsx
 * @module engage-mt/staff
 * @description The embedded User Guide (/help/guide) — a step-by-step walkthrough that bridges the
 *              printed regulations book to the Regs Manager, one real district (HD 270) the whole
 *              way through. Renders an "On this page" jump list + every chapter from the registry,
 *              in order. Deep-links to `#chapter-id` scroll the target into view (deferred a tick,
 *              matching GlossaryScreen, so the browser's native anchor scroll doesn't win with a
 *              stale pre-React position).
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-14
 * @updated 2026-07-14
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { useEffect } from "react";
import { Link } from "react-router-dom";
import { GUIDE_CHAPTERS } from "./guideChapters.js";
import { WORKED_EXAMPLE_DISTRICT, WORKED_EXAMPLE_NAME } from "./guideExample.js";

export function UserGuideScreen() {
  // On load with a hash (deep-link), scroll the target chapter into view after layout
  // settles — same rationale as GlossaryScreen's deferred scroll.
  useEffect(() => {
    if (!window.location.hash) return;
    const id = window.location.hash.slice(1);
    const timer = window.setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ block: "start" });
    }, 150);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <section className="help-prose">
      <h2>User guide</h2>
      <p className="help-lead">
        The printed book you know, translated to the tool that makes it. Every chapter starts from
        something in print, shows you the same thing in the Regs Manager, and what changes when you
        change it — following one real district, HD&nbsp;{WORKED_EXAMPLE_DISTRICT} (
        {WORKED_EXAMPLE_NAME}), the whole way through.
      </p>

      <nav className="guide-toc" aria-label="Guide chapters">
        <h3>On this page</h3>
        <ol>
          {GUIDE_CHAPTERS.map((ch) => (
            <li key={ch.id}>
              <a href={`#${ch.id}`}>{ch.title}</a>
            </li>
          ))}
        </ol>
      </nav>

      {GUIDE_CHAPTERS.map((ch) => (
        <article key={ch.id} id={ch.id} className="guide-chapter">
          <h3>
            {ch.title}
            {ch.bookRef && <span className="guide-bookref">{ch.bookRef}</span>}
          </h3>
          <ch.Component />
        </article>
      ))}

      <p className="subtle" style={{ marginTop: 16 }}>
        Looking for a single term? See the{" "}
        <Link className="glossary-link" to="/help/glossary">
          Glossary
        </Link>
        . Want the one-page overview? See{" "}
        <Link className="glossary-link" to="/help/overview">
          How it fits together
        </Link>
        .
      </p>
    </section>
  );
}
