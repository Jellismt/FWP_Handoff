/**
 * @file HuntingDistrictsBrowser.tsx
 * @module engage-mt/hunt
 * @description The district-lookup entry to Montana's hunting districts.
 *              Pick a species (Deer / Elk / Antelope), type a district
 *              number, and open that district's report — the tabbed detail
 *              page fed by the live FWP regulations API. A note points
 *              hunters at the map for the spatial path: turn on the species
 *              district layers and tap a district to get the same report.
 *
 *              Data: hunting-district-facts.json (region, name, acres,
 *              counties) — bundled reference dataset, used to resolve a
 *              typed number to its district.
 *
 *              Privacy: the species pick + typed number live in component
 *              state only. Nothing leaves the device.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-06
 * @updated 2026-07-16
 * @version 3.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import type { DistrictFactsRow } from "@/services/data/districtFacts";
import { useFetchJson } from "@/hooks/useFetchJson";
import { PrivacyBadge } from "@/components/shared/widgets/PrivacyBadge";
import { PillButton } from "@/components/shared/forms/PillButton";
import { ListCard } from "@/components/shared/widgets/ListCard";
import { SkeletonGrid } from "@/components/shared/feedback/Skeleton";
import { EmptyStateCard } from "@/components/shared/feedback/EmptyStateCard";
import { FetchErrorCard } from "@/components/shared/feedback/FetchErrorCard";
import "./HuntingDistrictsBrowser.css";

/* ─────────────────────────── Types / constants ──────────────────────── */

type Species = "Deer" | "Elk" | "Antelope";

const SPECIES_CHOICES: Species[] = ["Deer", "Elk", "Antelope"];

const MAX_MATCHES = 12;

/* ─────────────────────────── Component ───────────────────────────────── */

export const HuntingDistrictsBrowser = (): JSX.Element => {
  const navigate = useNavigate();

  // Species pick + typed district number — component state only.
  const [species, setSpecies] = useState<Species | null>(null);
  const [query, setQuery] = useState("");

  const facts = useFetchJson<DistrictFactsRow[]>("/data/hunting-district-facts.json");

  const trimmed = query.trim();

  const matches = useMemo(() => {
    if (!species || trimmed.length === 0) return [];
    return (facts.data ?? [])
      .filter((d) => d.district.startsWith(trimmed))
      .sort((a, b) => a.district.localeCompare(b.district, undefined, { numeric: true }))
      .slice(0, MAX_MATCHES);
  }, [facts.data, species, trimmed]);

  if (facts.error) {
    return (
      <section className="hd-browser fwp-mobile-safe-bottom" data-module="hunt">
        <FetchErrorCard
          subject="hunting district facts"
          error={facts.error}
          onRetry={facts.retry}
        />
      </section>
    );
  }

  const isLoading = facts.data === null;

  return (
    <section className="hd-browser fwp-mobile-safe-bottom" data-module="hunt">
      <div className="fwp-tool-hero" data-module="hunt">
        <h1 className="fwp-tool-hero__title">Hunting Districts</h1>
        <p className="fwp-tool-hero__lede">
          Pick a species, then search a district number to open its report — live seasons and
          regulations straight from FWP. <PrivacyBadge label="Stays on device" />
        </p>
        <p className="fwp-tool-hero__intro">
          Prefer the map? Open the map and turn on the Deer, Elk, or Antelope hunting-district
          layers — tap any district and this same district report pops up.
        </p>
      </div>

      <div className="hd-browser__filters fwp-control-card">
        <div className="hd-browser__filter-group">
          <span className="hd-browser__filter-label">Species</span>
          <div className="hd-browser__chip-row" role="group" aria-label="Species">
            {SPECIES_CHOICES.map((s) => (
              <button
                key={s}
                type="button"
                className="hd-browser__chip"
                aria-pressed={species === s}
                onClick={() => setSpecies(s)}
              >
                {s}
              </button>
            ))}
          </div>

          <label className="hd-browser__filter-label" htmlFor="hd-browser-search">
            District number
          </label>
          <input
            id="hd-browser-search"
            type="search"
            className="hd-browser__sort"
            placeholder={species ? "e.g. 380" : "Pick a species first"}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            disabled={!species}
            inputMode="numeric"
            autoComplete="off"
          />
        </div>
      </div>

      {isLoading ? (
        <SkeletonGrid count={3} />
      ) : !species || trimmed.length === 0 ? null : matches.length === 0 ? (
        <EmptyStateCard
          module="hunt"
          title="No district matches that number"
          body="Check the number against your regulations, or open the map and tap the district instead."
        />
      ) : (
        <div className="hd-browser__grid">
          {matches.map((d) => (
            <ListCard
              key={d.district}
              module="hunt"
              eyebrow={`Region ${d.region}`}
              title={`HD ${d.district} — ${d.name}`}
              actions={
                <PillButton
                  variant="primary"
                  size="sm"
                  iconEnd={ArrowRight}
                  onClick={() => navigate(`/hunt/district/${d.district}`)}
                  ariaLabel={`Open district ${d.district}`}
                >
                  Open
                </PillButton>
              }
            />
          ))}
        </div>
      )}
    </section>
  );
};
