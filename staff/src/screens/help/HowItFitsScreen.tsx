/**
 * @file HowItFitsScreen.tsx
 * @module engage-mt/staff
 * @description Orientation page for a brand-new employee: what the tool is, the season-year
 *              spine, the data model (hand-authored inline SVG diagram), the spatial-key
 *              link from geography codes to FWP's external GIS, the draft→publish workflow,
 *              where the published data goes, the role ladder, and what isn't edited here.
 *              A map of the tool, not a manual — the Glossary carries term definitions,
 *              linked from each concept.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-05
 * @updated 2026-07-14
 * @version 1.3.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { Link } from "react-router-dom";
import { G } from "./guide/guidePrimitives.js";

export function HowItFitsScreen() {
  return (
    <section className="help-prose">
      <h2>How it fits together</h2>
      <p className="help-lead">
        A five-minute orientation to the Regs Manager: what you're authoring, how the
        pieces relate, and where the data goes. For the meaning of any single term, see
        the <Link className="glossary-link" to="/help/glossary">Glossary</Link>.
      </p>

      <div className="card">
        <h3>What this tool is</h3>
        <p>
          The Regs Manager is where FWP staff author the annual <strong>deer, elk &amp;
          antelope (DEA) hunting regulations</strong>. What you edit here becomes two
          things: the <strong>printed regulations book</strong> and the regulations shown
          in the public <strong>Engage&nbsp;MT</strong> app. It is internal — the public
          never sees it.
        </p>
      </div>

      <div className="card">
        <h3>The season year</h3>
        <p>
          Everything is scoped to a <G id="season-year">season year</G>, chosen with the
          switcher at the top-right of every screen. A season year runs <strong>Mar&nbsp;1
          → end of February</strong>, matching the license year. Pick the year, then work
          within it; two years coexist so you can prepare next year while this year is
          live.
        </p>
      </div>

      <div className="card">
        <h3>The data model, top down</h3>
        <p>
          A season year fans into three branches: the <strong>geography</strong> you hunt
          in, the <strong>regulations</strong> built on top of it, and the <strong>reference
          data</strong> that fills out the book. The heart of it is the{" "}
          <G id="opportunity">opportunity</G> — a single printed row.
        </p>

        <svg className="help-diagram" viewBox="0 0 760 500" role="img"
          aria-label="Data model diagram. A season year fans into three branches. Geography (left): seven regions, each holding districts (HD or antelope) that may split into optional portions. Regulations (center): the opportunity — one printed row — is built from an instrument times a legal animal class times a hunt area, and carries five season windows plus restrictions; restricted areas are linked to the districts they apply to, and the opportunity's hunt area links to districts. Reference (right): fees, content, and maps and assets hang off the season year in parallel. Below, an external box labeled FWP ESRI map layers holds the boundary shapes; the district and restricted-area boxes connect down to it by a dashed keyed-by-code link, showing the map shapes live in FWP's live GIS and never in this database.">
          <defs>
            <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" fill="#636a76" />
            </marker>
            <marker id="arrow-ref" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" fill="#4a6fa5" />
            </marker>
            <marker id="arrow-key" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" fill="#046a38" />
            </marker>
          </defs>
          <style>{`
            .box { fill: #ffffff; stroke: #dee1e6; stroke-width: 1.5; }
            .box-blue { fill: #eef4fb; stroke: #002855; }
            .box-green { fill: #f1f9f4; stroke: #046a38; stroke-width: 2; }
            .box-amber { fill: #fff6e2; stroke: #b3252e; }
            .box-muted { fill: #f7f8fa; stroke: #dee1e6; }
            .lbl { font: 600 13px -apple-system, "Segoe UI", sans-serif; fill: #0f1419; }
            .lbl-sm { font: 500 11px -apple-system, "Segoe UI", sans-serif; fill: #636a76; }
            .hero { font: 700 15px -apple-system, "Segoe UI", sans-serif; fill: #045a30; }
            .ing { font: 600 10px -apple-system, "Segoe UI", sans-serif; fill: #0f1419; }
            .op { font: 700 12px -apple-system, "Segoe UI", sans-serif; fill: #636a76; }
            .branch { font: 700 10px -apple-system, "Segoe UI", sans-serif; fill: #002855; letter-spacing: 0.06em; }
            .ref-lbl { font: 600 9.5px -apple-system, "Segoe UI", sans-serif; fill: #4a6fa5; }
            .edge { stroke: #636a76; stroke-width: 1.5; fill: none; }
            .edge-ref { stroke: #4a6fa5; stroke-width: 1.5; fill: none; }
            .edge-key { stroke: #046a38; stroke-width: 1.5; fill: none; stroke-dasharray: 5 4; }
            .tick { stroke: #b9c1cc; stroke-width: 1.5; fill: none; }
            .box-external { fill: #eef4fb; stroke: #002855; stroke-width: 1.5; stroke-dasharray: 5 3; }
            .eyebrow { font: 700 8.5px -apple-system, "Segoe UI", sans-serif; fill: #4a6fa5; letter-spacing: 0.07em; }
            .lbl-key { font: 600 10px -apple-system, "Segoe UI", sans-serif; fill: #046a38; }
          `}</style>

          {/* ── Edges (drawn first, boxes sit on top) ─────────────────────── */}
          {/* Season year → each branch */}
          <path className="edge" d="M312,60 C214,80 128,84 122,104" markerEnd="url(#arrow)" />
          <path className="edge" d="M380,60 L380,92" markerEnd="url(#arrow)" />
          <path className="edge" d="M448,60 C520,80 546,92 548,120" markerEnd="url(#arrow)" />
          {/* Geography chain (contains) */}
          <path className="edge" d="M125,146 L125,180" markerEnd="url(#arrow)" />
          <path className="edge" d="M125,222 L125,252" markerEnd="url(#arrow)" />
          {/* Reference spine + ticks */}
          <path className="tick" d="M548,120 L548,232" />
          <path className="tick" d="M548,129 L560,129" />
          <path className="tick" d="M548,175 L560,175" />
          <path className="tick" d="M548,221 L560,221" />
          {/* Reference links (blue): hunt area → districts, restricted area → districts */}
          <path className="edge-ref" d="M272,182 C244,190 216,196 204,200" markerEnd="url(#arrow-ref)" />
          <path className="edge-ref" d="M294,300 C250,296 214,242 204,216" markerEnd="url(#arrow-ref)" />

          {/* ── Season year ───────────────────────────────────────────────── */}
          <rect className="box box-blue" x="290" y="16" width="180" height="44" rx="8" />
          <text className="lbl" x="380" y="37" textAnchor="middle">Season year</text>
          <text className="lbl-sm" x="380" y="52" textAnchor="middle">Mar 1 → end Feb</text>

          {/* Branch labels (on the fan edges) */}
          <rect x="176" y="72" width="72" height="15" rx="7" fill="#ffffff" />
          <text className="branch" x="212" y="83" textAnchor="middle">GEOGRAPHY</text>
          <rect x="336" y="72" width="88" height="15" rx="7" fill="#ffffff" />
          <text className="branch" x="380" y="83" textAnchor="middle">REGULATIONS</text>
          <rect x="480" y="76" width="74" height="15" rx="7" fill="#ffffff" />
          <text className="branch" x="517" y="87" textAnchor="middle">REFERENCE</text>

          {/* ── Geography branch (left) ───────────────────────────────────── */}
          <rect className="box box-blue" x="50" y="108" width="150" height="38" rx="8" />
          <text className="lbl" x="125" y="132" textAnchor="middle">Region (1–7)</text>
          <rect className="box box-blue" x="50" y="182" width="150" height="40" rx="8" />
          <text className="lbl" x="125" y="200" textAnchor="middle">District</text>
          <text className="lbl-sm" x="125" y="214" textAnchor="middle">HD / Antelope</text>
          <rect className="box box-muted" x="50" y="254" width="150" height="34" rx="8" />
          <text className="lbl-sm" x="125" y="275" textAnchor="middle">Portion (optional)</text>

          {/* ── The opportunity card (center) ─────────────────────────────── */}
          <rect className="box box-green" x="272" y="96" width="216" height="162" rx="12" />
          <text className="hero" x="380" y="120" textAnchor="middle">Opportunity</text>
          <text className="lbl-sm" x="380" y="135" textAnchor="middle">one printed row · built from:</text>
          {/* Recipe: instrument × animal class × hunt area */}
          <rect className="box box-muted" x="280" y="146" width="61" height="30" rx="6" />
          <text className="ing" x="310" y="164" textAnchor="middle">Instrument</text>
          <text className="op" x="345" y="165" textAnchor="middle">×</text>
          <rect className="box box-muted" x="349" y="146" width="61" height="30" rx="6" />
          <text className="ing" x="379" y="161" textAnchor="middle">Animal</text>
          <text className="ing" x="379" y="172" textAnchor="middle">class</text>
          <text className="op" x="414" y="165" textAnchor="middle">×</text>
          <rect className="box box-muted" x="418" y="146" width="61" height="30" rx="6" />
          <text className="ing" x="448" y="161" textAnchor="middle">Hunt</text>
          <text className="ing" x="448" y="172" textAnchor="middle">area</text>
          {/* Attributes the opportunity carries */}
          <rect className="box" x="294" y="190" width="172" height="26" rx="6" />
          <text className="lbl-sm" x="380" y="207" textAnchor="middle">Season windows (×5)</text>
          <rect className="box" x="294" y="224" width="172" height="26" rx="6" />
          <text className="lbl-sm" x="380" y="241" textAnchor="middle">Restrictions</text>

          {/* Restricted areas (linked to districts) */}
          <rect className="box box-amber" x="294" y="290" width="172" height="34" rx="8" />
          <text className="lbl" x="380" y="311" textAnchor="middle">Restricted areas</text>

          {/* Reference-link labels */}
          <text className="ref-lbl" x="238" y="176" textAnchor="middle">hunt area</text>
          <text className="ref-lbl" x="252" y="266" textAnchor="middle">applies to</text>

          {/* ── Reference branch (right) ──────────────────────────────────── */}
          <rect className="box box-blue" x="560" y="112" width="150" height="34" rx="8" />
          <text className="lbl" x="635" y="134" textAnchor="middle">Fees</text>
          <rect className="box box-blue" x="560" y="158" width="150" height="34" rx="8" />
          <text className="lbl" x="635" y="180" textAnchor="middle">Content</text>
          <rect className="box box-blue" x="560" y="204" width="150" height="34" rx="8" />
          <text className="lbl" x="635" y="226" textAnchor="middle">Maps &amp; assets</text>

          {/* ── Spatial key: geography + restricted areas resolve to FWP's external GIS ── */}
          {/* Node first, then the dashed keyed-by-code edges into it. */}
          <rect className="box box-external" x="150" y="372" width="320" height="58" rx="12" />
          <text className="eyebrow" x="310" y="391" textAnchor="middle">EXTERNAL — FWP'S LIVE GIS</text>
          <text className="lbl" x="310" y="409" textAnchor="middle">FWP ESRI map layers</text>
          <text className="lbl-sm" x="310" y="424" textAnchor="middle">the boundary shapes live here — never in this DB</text>
          {/* District/Portion column → GIS, and Restricted areas → GIS, keyed by code */}
          <path className="edge-key" d="M125,288 C125,332 205,352 246,371" markerEnd="url(#arrow-key)" />
          <path className="edge-key" d="M380,324 L374,371" markerEnd="url(#arrow-key)" />
          <text className="lbl-key" x="150" y="346" textAnchor="middle">keyed by code</text>

          {/* ── Legend ────────────────────────────────────────────────────── */}
          <rect className="box box-green" x="40" y="452" width="16" height="12" rx="3" />
          <text className="lbl-sm" x="62" y="462">Opportunity — the row you author</text>
          <rect className="box box-amber" x="330" y="452" width="16" height="12" rx="3" />
          <text className="lbl-sm" x="352" y="462">Restricted area</text>
          <rect className="box box-external" x="500" y="452" width="16" height="12" rx="3" />
          <text className="lbl-sm" x="522" y="462">External FWP GIS</text>
          <path className="edge" d="M40,482 L66,482" markerEnd="url(#arrow)" />
          <text className="lbl-sm" x="74" y="486">contains</text>
          <path className="edge-ref" d="M200,482 L226,482" markerEnd="url(#arrow-ref)" />
          <text className="lbl-sm" x="234" y="486">links to (hunt area · applies to)</text>
          <path className="edge-key" d="M470,482 L496,482" markerEnd="url(#arrow-key)" />
          <text className="lbl-sm" x="504" y="486">keyed by code → FWP GIS</text>
        </svg>

        <ul>
          <li><strong>Geography (left branch).</strong> A <G id="season-year">season year</G> holds seven <G id="region">regions</G>; each region holds <G id="district">districts</G> — deer/elk (<G id="hd">HD</G>) or <G id="antelope-hd">antelope</G> — and a district can split into optional <G id="portion">portions</G> (synced from FWP's ESRI portion layers; a reg scoped to part of a district links to its portion as a hunt-area member).</li>
          <li><strong>The opportunity (center — the thing you author).</strong> One printed row = an <G id="instrument">instrument</G> × a <G id="legal-animal-class">legal animal class</G> × a <G id="hunt-area">hunt area</G> (× a <G id="split">split #</G>). Each row also carries the five <G id="season-window">season windows</G> and its <G id="restriction">restrictions</G>.</li>
          <li><strong>The hunt area</strong> is the set of districts (or portions) the row is valid in — so one opportunity can span many districts without being repeated. That's the blue <em>hunt area</em> link back to geography.</li>
          <li><strong>The instrument is shared.</strong> One <G id="instrument">instrument</G> backs every opportunity that uses it — edit its quota or dates once and every row that references it changes.</li>
          <li><strong>Restricted areas</strong> — weapons-restricted, closure, or archery-only <G id="restricted-area">areas</G> — are created once and linked to the districts they <em>apply to</em> (the second blue link).</li>
          <li><strong>Reference data (right branch).</strong> <G id="product">Fees</G>, <G id="district-note">content</G>, and <G id="restricted-area">maps</G> hang off the season year in parallel. They don't describe a hunt, but they print in the book and feed the public app alongside the regulations.</li>
          <li><strong>The map lives outside this database.</strong> A district, portion, or restricted area is stored as a <G id="spatial-key">code</G> — never a polygon. The dashed green link shows those codes resolving to their shapes in FWP's <G id="gis-layer">external ESRI map layers</G>. More on that below.</li>
        </ul>
      </div>

      <div className="card">
        <h3>The spatial key — where the map meets the regs</h3>
        <p>
          Here's the part that surprises people: <strong>this database holds no map
          shapes.</strong> A <G id="district">district</G> is a{" "}
          <G id="district-code">code</G> (like <code>380</code>), not a polygon. The
          boundaries — every district, portion, and restricted-area shape — live in FWP's
          own live map service and are never copied in here. That code is the{" "}
          <G id="spatial-key">spatial key</G> that ties a row you author to a shape on the
          map.
        </p>

        <svg className="help-diagram" viewBox="0 0 760 100" role="img"
          aria-label="Runtime flow, left to right: a hunter taps the map asking where am I; FWP's external ESRI layer returns the district code 380; the regs read API is asked for that code; the tabular regulations are shown. Only the code crosses the wire — never a shape.">
          <text className="lbl-sm" x="380" y="14" textAnchor="middle">Only the code crosses the wire — never a shape.</text>
          {/* edges */}
          <path className="edge" d="M162,54 L192,54" markerEnd="url(#arrow)" />
          <path className="edge" d="M382,54 L412,54" markerEnd="url(#arrow)" />
          <path className="edge" d="M568,54 L598,54" markerEnd="url(#arrow)" />
          {/* 1 · tap */}
          <rect className="box box-blue" x="12" y="30" width="150" height="48" rx="8" />
          <text className="lbl" x="87" y="52" textAnchor="middle">Tap the map</text>
          <text className="lbl-sm" x="87" y="67" textAnchor="middle">"where am I?"</text>
          {/* 2 · external GIS returns the code */}
          <rect className="box box-external" x="192" y="30" width="190" height="48" rx="8" />
          <text className="eyebrow" x="287" y="45" textAnchor="middle">EXTERNAL — FWP GIS</text>
          <text className="lbl" x="287" y="63" textAnchor="middle">ESRI layer → DISTRICT 380</text>
          {/* 3 · regs API */}
          <rect className="box box-green" x="412" y="30" width="156" height="48" rx="8" />
          <text className="lbl" x="490" y="52" textAnchor="middle">Regs read API</text>
          <text className="lbl-sm" x="490" y="67" textAnchor="middle">asks for code 380</text>
          {/* 4 · regs shown */}
          <rect className="box box-green" x="598" y="30" width="154" height="48" rx="8" />
          <text className="lbl" x="675" y="52" textAnchor="middle">Regs shown</text>
          <text className="lbl-sm" x="675" y="67" textAnchor="middle">tabular rows</text>
        </svg>

        <p>
          So when a hunter in the field asks the public app "what are the regulations
          where I'm standing?", the app checks the point against FWP's{" "}
          <G id="gis-layer">ESRI map layer</G>, reads back the district code (say{" "}
          <code>380</code>), then asks this system's read API for district 380's
          regulations. Only the code travels — never a shape.
        </p>
        <ul>
          <li><strong>The map stays FWP's.</strong> The GIS is FWP's system of record and never moves here — we point at it by code, we don't copy or fork it. If FWP redraws a boundary, the public app sees the new shape immediately; nothing to re-import.</li>
          <li><strong>Nothing spatial to migrate.</strong> When this database eventually moves to Oracle, there is literally no map data to carry along — no geometry, no spatial index, no spatial licensing. A deliberate choice that keeps the move small and safe.</li>
          <li><strong>One place binds code to map.</strong> A single registry records which code space (a district's <code>DISTRICT</code>, a portion's shape code, a restricted area's name) resolves against which FWP layer, and an automated check re-probes those layers so a renamed field can't quietly break the join.</li>
        </ul>
      </div>

      <div className="card">
        <h3>The workflow</h3>
        <div className="pipeline">
          <span className="step">Draft</span><span className="arrow">→</span>
          <span className="step">Edit</span><span className="arrow">→</span>
          <span className="step">Validate</span><span className="arrow">→</span>
          <span className="step">Publish</span><span className="arrow">→</span>
          <span className="step">Snapshot</span>
        </div>
        <ul>
          <li>Every edit saves as <G id="draft">draft</G>. Drafts never reach the public app.</li>
          <li>Edits are <G id="audit-log">audit-logged</G> and <G id="optimistic-lock">optimistically locked</G> — if someone else changed a row since you loaded it, you'll be told to reload.</li>
          <li><G id="validation">Validation</G> runs live on the dashboard. Blocking errors must be cleared before publishing; warnings are advisory.</li>
          <li>An approver <G id="publish">publishes</G> with a required <G id="changelog-note">changelog note</G>. Publishing writes an immutable, versioned <G id="snapshot">snapshot</G>. See it exactly as the public reads it on the <G id="live-snapshot">Live snapshot</G>.</li>
          <li>To fix a published year, edit the rows and re-publish — that's a <G id="mid-year-correction">mid-year correction</G>, creating <G id="version">v2, v3, …</G>; each is logged under Corrections &amp; updates and shown to hunters as "what changed since the book."</li>
          <li>Next year starts empty, then <G id="clone-forward">clones forward</G> from this year so you edit only what changed.</li>
        </ul>
      </div>

      <div className="card">
        <h3>Where the data goes</h3>
        <ul>
          <li>Publishing writes a <G id="snapshot">snapshot</G> under a new <G id="version">version</G>.</li>
          <li>The public read API (<code>/api/v1/fwp/…</code>) serves that snapshot — never drafts.</li>
          <li>The <strong>Engage&nbsp;MT app</strong> reads the API; the <strong>print export</strong> builds the ICML package for the printed book from the same snapshot.</li>
        </ul>
      </div>

      <div className="card">
        <h3>Who can do what</h3>
        <p className="subtle" style={{ marginTop: 0 }}>Roles are ordered — each includes the ones below it. The server enforces them; the UI just hides what you can't do. See <G id="roles">roles</G>.</p>
        <div className="table-scroll">
          <table>
            <thead><tr><th>Role</th><th>Can</th></tr></thead>
            <tbody>
              <tr><td><strong>viewer</strong></td><td>Read everything, including the audit log.</td></tr>
              <tr><td><strong>editor</strong></td><td>All of viewer, plus create / edit / soft-delete draft regulations.</td></tr>
              <tr><td><strong>approver</strong></td><td>All of editor, plus publish a season year and approve corrections.</td></tr>
              <tr><td><strong>admin</strong></td><td>All of approver, plus manage staff accounts.</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h3>What you can't edit here (and why)</h3>
        <p>
          The fixed vocabularies — species, the five <G id="season-types">season types</G>,
          <G id="restriction"> restriction</G> codes, <G id="legal-animal-class">legal animal
          classes</G>, and pricing <G id="audience">audiences</G> — plus the sunrise-sunset
          shooting-hour tables are stable statutory reference data. They change at most once
          a year and are maintained by re-running the seed / ETL, not through a screen —
          deliberately, to keep the editing surface focused on what actually changes each
          cycle.
        </p>
      </div>

      <p className="subtle" style={{ marginTop: 12 }}>
        Ready to make your first edit? Walk through the{" "}
        <Link className="glossary-link" to="/help/guide">User guide</Link> — a step-by-step tour that
        maps the printed book to every screen, following one real district start to finish.
      </p>
    </section>
  );
}
