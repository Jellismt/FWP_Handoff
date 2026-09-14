/**
 * @file GlossaryScreen.tsx
 * @module engage-mt/staff
 * @description Glossary of every term of art used in the Regs Manager, grouped by theme
 *              with a client-side filter. Each term has an `#id` anchor so other screens
 *              can deep-link straight to a definition (e.g. /help/glossary#hunt-area).
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-05
 * @updated 2026-07-05
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { GLOSSARY, GLOSSARY_GROUPS, type GlossaryTerm } from "./glossaryData.js";

/** Index every term by id for resolving `seeAlso` labels. */
const BY_ID = new Map(GLOSSARY.map((t) => [t.id, t]));

export function GlossaryScreen() {
  const [q, setQ] = useState("");

  // On load with a hash (deep-link), scroll the target term into view. Deferred a
  // tick: on a full page load the browser fires its own native anchor scroll against
  // the pre-React layout, so an immediate scrollIntoView gets overridden with a stale
  // position. Scrolling after layout settles wins the race in both load paths.
  useEffect(() => {
    if (!window.location.hash) return;
    const id = window.location.hash.slice(1);
    const timer = window.setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ block: "start" });
    }, 150);
    return () => window.clearTimeout(timer);
  }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return GLOSSARY;
    return GLOSSARY.filter(
      (t) => t.term.toLowerCase().includes(needle) || t.definition.toLowerCase().includes(needle),
    );
  }, [q]);

  const byGroup = useMemo(() => {
    const m = new Map<string, GlossaryTerm[]>();
    for (const t of filtered) {
      const list = m.get(t.group) ?? [];
      list.push(t);
      m.set(t.group, list);
    }
    return GLOSSARY_GROUPS.filter((g) => m.has(g)).map((g) => [g, m.get(g)!] as const);
  }, [filtered]);

  return (
    <section className="help-prose">
      <h2>Glossary</h2>
      <p className="subtle">Every term of art used in the Regs Manager, in plain English. Deep-link a definition with its anchor — e.g. <code>/help/glossary#hunt-area</code>.</p>

      <div style={{ margin: "16px 0", maxWidth: 420 }}>
        <label htmlFor="glossary-filter">Filter terms</label>
        <input
          id="glossary-filter"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Filter terms…"
          style={{ width: "100%" }}
        />
      </div>

      {byGroup.map(([group, terms]) => (
        <div key={group} className="card glossary-group">
          <h3>{group}</h3>
          <dl style={{ margin: 0 }}>
            {terms.map((t) => (
              <div key={t.id} id={t.id} className="glossary-term">
                <dt>{t.term}</dt>
                <dd>
                  {t.definition}
                  {t.example && <span className="example">{t.example}</span>}
                  {t.seeAlso && t.seeAlso.length > 0 && (
                    <span className="example" style={{ fontStyle: "normal" }}>
                      See also:{" "}
                      {t.seeAlso
                        .map((id) => BY_ID.get(id))
                        .filter((x): x is GlossaryTerm => Boolean(x))
                        .map((rel, i, arr) => (
                          <span key={rel.id}>
                            <a className="glossary-link" href={`#${rel.id}`}>{rel.term}</a>
                            {i < arr.length - 1 ? ", " : ""}
                          </span>
                        ))}
                    </span>
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      ))}

      {filtered.length === 0 && (
        <p className="subtle">No terms match “{q}”. Try a shorter word, or clear the filter.</p>
      )}

      <p className="subtle" style={{ marginTop: 12 }}>
        New here? Start with <Link className="glossary-link" to="/help/overview">How it fits together</Link>.
      </p>
    </section>
  );
}
