/**
 * @file AttributionPage.tsx
 * @module engage-mt/shared
 * @description Where everything on the map comes from: the author and
 *              license, every map layer's source, every bundled dataset with
 *              its effective and expiry dates and provenance tier, the
 *              basemaps, and the version of the regulations built into the
 *              app.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-20
 * @updated 2026-09-06
 * @version 2.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { useEffect, useState } from "react";
import { ToolHero } from "@/components/shared/ToolHero";
import { layerSourceGroups } from "@/config/layerSources";
import { BASEMAP_TEMPLATES, OFFLINE_ATTRIBUTION } from "@/config/offlineBasemaps";
import { HUNTING_REGS_SLUG } from "@/services/hunt/fetchHuntingRegs";
import { loadBundledRegsSnapshot, type BundledRegsMeta } from "@/services/regs/bundledRegsSnapshot";
import {
  TIER_LABEL,
  fetchDataManifest,
  isDatasetExpired,
  type DatasetManifestEntry,
} from "@/services/data/manifest";
import "./AttributionPage.css";

const TITLE = "Attribution · Engage MT";

const ONLINE_BASEMAPS = "Esri World Imagery, World Hybrid, and World Topographic (ArcGIS Maps SDK)";

export const AttributionPage = (): JSX.Element => {
  const [datasets, setDatasets] = useState<DatasetManifestEntry[] | null>(null);
  const [regs, setRegs] = useState<BundledRegsMeta | null>(null);

  useEffect(() => {
    const prior = document.title;
    document.title = TITLE;
    return () => {
      document.title = prior;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    fetchDataManifest()
      .then((m) => alive && setDatasets(m.datasets))
      .catch(() => alive && setDatasets([]));
    loadBundledRegsSnapshot()
      .then((snap) => alive && setRegs(snap[HUNTING_REGS_SLUG]?.meta ?? null))
      .catch(() => alive && setRegs(null));
    return () => {
      alive = false;
    };
  }, []);

  const groups = layerSourceGroups();

  return (
    <section
      className="attribution-page fwp-mobile-safe-bottom"
      data-module="shared"
      aria-labelledby="attribution-page-heading"
    >
      <ToolHero
        module="shared"
        title="Attribution"
        titleId="attribution-page-heading"
        lede="Who built Engage MT, how it is licensed, and where every layer and dataset comes from."
      />

      <section className="attribution-page__group" aria-labelledby="attribution-fwp-heading">
        <h2 id="attribution-fwp-heading" className="attribution-page__group-title">
          Montana Fish, Wildlife &amp; Parks
        </h2>
        <p className="attribution-page__group-intro">
          Engage MT is built by Jamie Ellis at Montana Fish, Wildlife &amp; Parks and is open source
          under the MIT License.
        </p>
      </section>

      <section className="attribution-page__group" aria-labelledby="attribution-layers-heading">
        <h2 id="attribution-layers-heading" className="attribution-page__group-title">
          Map layers
        </h2>
        <ul className="attribution-page__list">
          {groups.map((g) => (
            <li key={g.sourceLabel} className="attribution-page__item">
              <span className="attribution-page__item-title">
                {g.upstreamUrl ? (
                  <a href={g.upstreamUrl} target="_blank" rel="noreferrer">
                    {g.sourceLabel}
                  </a>
                ) : (
                  g.sourceLabel
                )}
              </span>
              <span className="attribution-page__item-meta">{g.layers.join(" · ")}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="attribution-page__group" aria-labelledby="attribution-datasets-heading">
        <h2 id="attribution-datasets-heading" className="attribution-page__group-title">
          Bundled datasets
        </h2>
        {datasets === null ? (
          <p className="attribution-page__group-intro">Loading the data manifest…</p>
        ) : (
          <ul className="attribution-page__list">
            {datasets.map((d) => {
              const expired = isDatasetExpired(d);
              return (
                <li
                  key={d.id}
                  className={`attribution-page__item${expired ? " attribution-page__item--expired" : ""}`}
                >
                  <span className="attribution-page__item-title">
                    {d.upstreamUrl ? (
                      <a href={d.upstreamUrl} target="_blank" rel="noreferrer">
                        {d.id}
                      </a>
                    ) : (
                      d.id
                    )}
                  </span>
                  <span className="attribution-page__item-meta">{d.source}</span>
                  <span className="attribution-page__item-meta">
                    Effective {d.effectiveDate}
                    {d.expiresDate
                      ? ` · ${expired ? "Expired" : "Expires"} ${d.expiresDate}`
                      : ""}{" "}
                    · {d.license} · {TIER_LABEL[d.provenanceTier]}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="attribution-page__group" aria-labelledby="attribution-basemaps-heading">
        <h2 id="attribution-basemaps-heading" className="attribution-page__group-title">
          Basemaps
        </h2>
        <ul className="attribution-page__list">
          <li className="attribution-page__item">
            <span className="attribution-page__item-title">Online</span>
            <span className="attribution-page__item-meta">{ONLINE_BASEMAPS}</span>
          </li>
          <li className="attribution-page__item">
            <span className="attribution-page__item-title">Offline areas</span>
            <span className="attribution-page__item-meta">
              {Object.values(BASEMAP_TEMPLATES)
                .map((b) => b.label)
                .join(" and ")}{" "}
              from {OFFLINE_ATTRIBUTION} (public domain)
            </span>
          </li>
        </ul>
      </section>

      <section className="attribution-page__group" aria-labelledby="attribution-regs-heading">
        <h2 id="attribution-regs-heading" className="attribution-page__group-title">
          Regulations built into this app
        </h2>
        <p className="attribution-page__group-intro">
          {regs
            ? `${regs.sourceLabel}${regs.version != null ? ` — version ${regs.version}` : ""}, effective ${regs.effectiveDate ?? "unknown"}, exported ${regs.generatedAt.slice(0, 10)}. Used only when the live regulations service and every stored copy are unavailable.`
            : "No built-in regulations copy is bundled with this build."}
        </p>
      </section>
    </section>
  );
};
