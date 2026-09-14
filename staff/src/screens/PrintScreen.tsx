/**
 * @file PrintScreen.tsx
 * @module engage-mt/staff
 * @description Print export: a one-click PDF (headless Chromium), an inline HTML proof, and the
 *              ICML package the print designer flows into InDesign. All three render the SAME
 *              5.5×8.5 book model from the current snapshot. Same-origin links to the
 *              server-rendered endpoints.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-04
 * @updated 2026-07-07
 * @version 1.2.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import type { CSSProperties } from "react";
import { useApp } from "../store.js";

export function PrintScreen() {
  const seasonYear = useApp((s) => s.seasonYear);
  const proofUrl = `/api/v1/staff/season-years/${seasonYear}/print/proof.html`;
  const pdfUrl = `/api/v1/staff/season-years/${seasonYear}/print/book.pdf`;
  const icmlUrl = `/api/v1/staff/season-years/${seasonYear}/print/icml.zip`;

  const btn = (bg: string): CSSProperties => ({
    textDecoration: "none",
    color: "#fff",
    padding: "10px 16px",
    background: bg,
    borderRadius: 6,
  });

  return (
    <section>
      <h2>Print export — {seasonYear}</h2>
      <p className="subtle">
        Three outputs, all rendered from the current published snapshot at the physical booklet size (<strong>5.5″ × 8.5″</strong>):
        the <strong>PDF</strong> is a one-click, distributable, book-ordered proof; the <strong>HTML proof</strong> is the same book
        in-browser (Print → Save as PDF as a fallback); the <strong>ICML package</strong> is placed into the InDesign template by the
        print designer — styles bind by name, and maps are listed in the package's manifest for linked placement. The InDesign
        template still owns final print typography.
      </p>
      <div className="card" style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <a className="btn" href={pdfUrl} style={btn("var(--fwp-red, #B3252E)")}>Download PDF (5.5×8.5) ↓</a>
        <a className="btn" href={proofUrl} target="_blank" rel="noreferrer" style={btn("var(--fwp-green)")}>Open HTML proof ↗</a>
        <a className="btn" href={icmlUrl} style={btn("var(--fwp-blue)")}>Download ICML package (.zip)</a>
      </div>
      <p className="subtle" style={{ fontSize: "0.85em", marginTop: 8 }}>
        PDF generation runs headless Chromium on the server and may take several seconds for the full book.
      </p>
      <div className="card">
        <strong>Proof preview</strong>
        <iframe title="proof" src={proofUrl} style={{ width: "100%", height: "70vh", border: "1px solid var(--fwp-border)", marginTop: 8 }} />
      </div>
    </section>
  );
}
