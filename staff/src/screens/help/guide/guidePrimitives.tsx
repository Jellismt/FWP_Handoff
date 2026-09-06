/**
 * @file guidePrimitives.tsx
 * @module engage-mt/staff
 * @description Shared building blocks for the embedded User Guide. The signature piece is
 *              PrintVsApp — a "Printed book → Regs Manager" two-column translation — with
 *              BookRow reproducing the real district-table row (same columns + chip shape as
 *              DistrictDetailScreen) so the mock can never drift from the live screen. Also:
 *              StepList, UpdateFlow (the Draft→…→Snapshot pipeline), OpenInApp deep-links,
 *              GuideNote asides, and the shared glossary-link `G` (promoted from
 *              HowItFitsScreen so both files use one definition).
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-14
 * @updated 2026-07-14
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { Link } from "react-router-dom";

/** Deep-link to a glossary definition (e.g. /help/glossary#hunt-area). */
export function G({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <Link className="glossary-link" to={`/help/glossary#${id}`}>
      {children}
    </Link>
  );
}

/** A deep-link that opens the real, live screen — no screenshot to go stale. */
export function OpenInApp({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link className="guide-open-link" to={to}>
      {children}
    </Link>
  );
}

/** A lightweight aside — a tip (green) or a heads-up (gold). */
export function GuideNote({
  kind = "tip",
  title,
  children,
}: {
  kind?: "tip" | "warning";
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <aside className={`guide-note guide-note--${kind}`}>
      {title && <strong className="guide-note-title">{title}</strong>}
      {children}
    </aside>
  );
}

/** The publish pipeline as pills — reuses the app's .pipeline/.step/.arrow chrome. */
export function UpdateFlow({ steps }: { steps: string[] }) {
  return (
    <div className="pipeline" role="list" aria-label="Update flow">
      {steps.map((s, i) => (
        <span key={s} style={{ display: "contents" }}>
          <span className="step" role="listitem">
            {s}
          </span>
          {i < steps.length - 1 && (
            <span className="arrow" aria-hidden="true">
              →
            </span>
          )}
        </span>
      ))}
    </div>
  );
}

/** A numbered, chip-bulleted step list. */
export function StepList({ steps }: { steps: { title: string; body: React.ReactNode }[] }) {
  return (
    <ol className="guide-steps">
      {steps.map((s) => (
        <li key={s.title}>
          <span className="guide-step-title">{s.title}</span>
          <div>{s.body}</div>
        </li>
      ))}
    </ol>
  );
}

/** One reproduced printed-table row. Same column order as the real money screen. */
export interface BookRowExample {
  /** Instrument code shown in the chip, e.g. "270-50". */
  instrCode: string;
  /** Full instrument name, e.g. "Deer Permit". */
  instrumentName: string;
  /** Drawing instrument? Renders the "· draw" qualifier. */
  isDraw?: boolean;
  /** What may be taken, e.g. "Antlered Buck Mule Deer". */
  legalAnimal: string;
  /** Season-label → date range. Missing labels render as "–". */
  seasons: Record<string, string>;
  /** Quota text, e.g. "45", "25 (1–150)", "UNL", or "–". */
  quota: string;
  /** Coded restrictions + validity note, joined. */
  restrictions?: string;
}

const EMPTY_WINDOW = "–";

/**
 * Reproduce the district-table as it appears either in the printed book (`variant="book"`,
 * on paper) or in the Regs Manager (`variant="app"`, with the chip-coded instrument and a
 * faux actions column). Columns mirror DistrictDetailScreen exactly:
 * Instrument | Legal animal | …season columns… | Quota | Restrictions [| actions].
 */
export function BookRow({
  variant,
  seasonCols,
  rows,
}: {
  variant: "book" | "app";
  seasonCols: string[];
  rows: BookRowExample[];
}) {
  const isApp = variant === "app";
  return (
    <div className="table-scroll">
      <table className={isApp ? "guide-app-table" : "guide-bookrow"}>
        <thead>
          <tr>
            <th>Instrument</th>
            <th>Legal animal</th>
            {seasonCols.map((s) => (
              <th key={s}>{s}</th>
            ))}
            <th>Quota</th>
            <th>Restrictions</th>
            {isApp && <th aria-label="Row actions" />}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={`${r.instrCode}-${r.legalAnimal}`}>
              <td>
                {isApp ? (
                  <>
                    <span className="chip chip-species">{r.instrCode}</span> {r.instrumentName}
                    {r.isDraw ? <span className="subtle"> · draw</span> : null}
                  </>
                ) : (
                  <>
                    <strong>{r.instrCode}</strong> {r.instrumentName}
                    {r.isDraw ? " (draw)" : ""}
                  </>
                )}
              </td>
              <td>{r.legalAnimal}</td>
              {seasonCols.map((s) => (
                <td key={s}>{r.seasons[s] ?? EMPTY_WINDOW}</td>
              ))}
              <td>{r.quota}</td>
              <td className={isApp ? "subtle" : undefined}>{r.restrictions ?? ""}</td>
              {isApp && (
                <td style={{ whiteSpace: "nowrap" }}>
                  <span className="subtle" aria-hidden="true">
                    Seasons · Restrictions · Instrument
                  </span>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * The signature translation: what a concept looks like in the printed book (left, on paper)
 * versus in the Regs Manager (right), with a mapping arrow between. Stacks on narrow screens.
 */
export function PrintVsApp({
  bookLabel = "In the printed book",
  appLabel = "In the Regs Manager",
  book,
  app,
  caption,
}: {
  bookLabel?: string;
  appLabel?: string;
  book: React.ReactNode;
  app: React.ReactNode;
  caption?: React.ReactNode;
}) {
  return (
    <div className="card">
      <div className="guide-split">
        <div className="guide-face guide-face--book">
          <p className="guide-eyebrow">{bookLabel}</p>
          {book}
        </div>
        <div className="guide-split-arrow" aria-hidden="true">
          →
        </div>
        <div className="guide-face">
          <p className="guide-eyebrow">{appLabel}</p>
          {app}
        </div>
      </div>
      {caption && <p className="guide-caption">{caption}</p>}
    </div>
  );
}
