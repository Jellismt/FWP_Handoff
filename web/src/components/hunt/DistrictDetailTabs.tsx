/**
 * @file DistrictDetailTabs.tsx
 * @module engage-mt/hunt
 * @description Tabbed District detail page. The surface a hunter lands on after
 *              picking a district from the lookup tool, or the map tap-card's
 *              "Open detail" action.
 *
 *              Two tabs, both fed live by the FWP Regs Manager: Regulations
 *              (`DistrictRegulationsPanel` — per-license-type rows + district
 *              notes; the default tab) and Seasons (`DistrictSeasonWindows` —
 *              per-species weapon windows). District identity (name, region,
 *              area) lives in the header — region + acreage render as plain
 *              dark subheading rows under the H1. No synthesized outlook or
 *              demonstration numbers.
 *
 *              Active tab is mirrored to the URL (`?tab=seasons`) so a deep link
 *              lands on the right section. Tab strip implements the W3C tablist
 *              pattern: arrow-key roving focus, `aria-selected`, Enter / Space
 *              activates.
 *
 *              Privacy: every preference stays in the URL. No telemetry.
 *              Per docs/rules/privacy.md.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-06
 * @updated 2026-07-16
 * @version 3.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { useMemo, useRef } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { prefetchProps } from "@/utils/routePrefetch";
import { ArrowLeft, Crosshair } from "lucide-react";
import { useFetchJson } from "@/hooks/useFetchJson";
import { useAsyncState } from "@/hooks/useAsyncState";
import {
  fetchDistrictFactsLive,
  type LiveDistrictFacts,
} from "@/services/hunt/huntingDistrictsLive";
import { LiveDistrictFactsView } from "./districtTabs/LiveDistrictFactsView";
import { capturedDistrictFacts } from "@/services/mobile/regsCapture";
import { DISTRICT_FACTS_URL, type DistrictFactsRow } from "@/services/data/districtFacts";
import { PillButton } from "@/components/shared/forms/PillButton";
import { SkeletonGrid } from "@/components/shared/feedback/Skeleton";
import { EmptyStateCard } from "@/components/shared/feedback/EmptyStateCard";
import { useHighlightedFeatureStore } from "@/store/map/highlightedFeatureStore";
import { useMapNavStore } from "@/store/map/mapNavStore";
import { useLayerVisibilityStore } from "@/store/map/layerVisibilityStore";
import { resolveRegionContact } from "@/services/hunt/regionContacts";
import { formatCompact } from "@/utils/formatNumber";
import { DistrictSeasonWindows } from "./DistrictSeasonWindows";
import { DistrictRegulationsPanel } from "./DistrictRegulationsPanel";
import "./DistrictDetailTabs.css";

const TABS = [
  { id: "regulations", label: "Regulations" },
  { id: "seasons", label: "Seasons" },
] as const;

type TabId = (typeof TABS)[number]["id"];

const isTabId = (s: string | null): s is TabId => s !== null && TABS.some((t) => t.id === s);

export const DistrictDetailTabs = (): JSX.Element => {
  const { district = "" } = useParams<{ district: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const tabParam = searchParams.get("tab");
  const activeTab: TabId = isTabId(tabParam) ? tabParam : "regulations";

  const factsJson = useFetchJson<DistrictFactsRow[]>(DISTRICT_FACTS_URL);
  const facts = useMemo(
    () => (factsJson.data ?? []).find((r) => r.district === district) ?? null,
    [factsJson.data, district],
  );

  // The curated dataset only covers the 139 general-license Deer/Elk/
  // Lion districts. When a single-species district (Moose, Sheep, Goat,
  // Antelope, Upland) is requested, fall back to a live FWP-GIS REST lookup so
  // the page resolves with real facts instead of dead-ending, and to the facts
  // captured with a downloaded area when the live lookup cannot run. The
  // fetcher no-ops until the bundled dataset confirms there's no curated row.
  const bundledMissing = factsJson.data !== null && !facts;
  const liveFacts = useAsyncState<LiveDistrictFacts | null>({
    fetcher: () =>
      bundledMissing
        ? fetchDistrictFactsLive(district)
            .catch(() => null)
            .then((live) => live ?? capturedDistrictFacts(district))
        : Promise.resolve(null),
    isEmpty: (d) => d === null,
    deps: [district, bundledMissing],
  });

  // Map stores.
  const setHighlight = useHighlightedFeatureStore((s) => s.set);
  const requestGoto = useMapNavStore((s) => s.requestGoto);
  const setLayerVisible = useLayerVisibilityStore((s) => s.setVisible);

  const onShowOnMap = (): void => {
    if (!facts) return;
    const contact = resolveRegionContact(facts.region);
    setLayerVisible("hunting-districts", true);
    if (contact) {
      requestGoto({
        lat: contact.centroid.lat,
        lon: contact.centroid.lon,
        zoom: 8,
        label: `HD ${facts.district} — ${facts.name}`,
      });
      setHighlight({
        lat: contact.centroid.lat,
        lon: contact.centroid.lon,
        label: `HD ${facts.district} — ${facts.name}`,
        kind: "polygon",
        ttlMs: 90_000,
      });
    }
    navigate("/");
  };

  // Tab keyboard handling.
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const onTabKeyDown =
    (idx: number) =>
    (e: React.KeyboardEvent<HTMLButtonElement>): void => {
      let next = idx;
      if (e.key === "ArrowRight") next = (idx + 1) % TABS.length;
      else if (e.key === "ArrowLeft") next = (idx - 1 + TABS.length) % TABS.length;
      else if (e.key === "Home") next = 0;
      else if (e.key === "End") next = TABS.length - 1;
      else return;
      e.preventDefault();
      const nextId = TABS[next].id;
      setSearchParams((prev) => {
        const np = new URLSearchParams(prev);
        np.set("tab", nextId);
        return np;
      });
      window.setTimeout(() => tabRefs.current[next]?.focus(), 0);
    };

  const setTab = (id: TabId): void => {
    setSearchParams((prev) => {
      const np = new URLSearchParams(prev);
      np.set("tab", id);
      return np;
    });
  };

  // ── Loading / empty guards ───────────────────────────────────────
  // Skeleton while the curated dataset loads, or while the live REST fallback
  // is still resolving for a non-curated (single-species) district.
  if (factsJson.loading || (bundledMissing && liveFacts.state.status === "loading")) {
    return (
      <section className="hd-tabs fwp-mobile-safe-bottom" data-module="hunt">
        <SkeletonGrid count={3} />
      </section>
    );
  }
  if (!facts) {
    // Single-species district resolved live from FWP-GIS → render its facts.
    if (liveFacts.state.status === "success" && liveFacts.state.data) {
      return <LiveDistrictFactsView facts={liveFacts.state.data} />;
    }
    // Genuinely unknown district (no curated row, no live hit) → empty state.
    return (
      <section className="hd-tabs fwp-mobile-safe-bottom" data-module="hunt">
        <EmptyStateCard
          module="hunt"
          title={`No facts on file for HD ${district}`}
          body="This district number isn't in FWP's published Deer/Elk/Lion, Antelope, Sheep, Moose, Goat, or Upland district sets. Double-check the number, or browse all districts."
          suggestions={[
            { label: "Back to all districts", href: "/hunt/districts" },
            { label: "Back to Hunt", href: "/hunt" },
          ]}
        />
      </section>
    );
  }

  return (
    <section className="hd-tabs fwp-mobile-safe-bottom" data-module="hunt">
      <header className="hd-tabs__header">
        <Link to="/hunt/districts" className="hd-tabs__back" {...prefetchProps("/hunt/districts")}>
          <ArrowLeft size={14} strokeWidth={2.25} aria-hidden /> All districts
        </Link>
        <h1 className="hd-tabs__title">
          HD {facts.district} — {facts.name}
        </h1>
        <p className="hd-tabs__fact">FWP Region {facts.region}</p>
        <p className="hd-tabs__fact">{formatCompact(facts.acres ?? 0, "acres")}</p>
        <div className="hd-tabs__actions">
          <PillButton variant="primary" size="md" iconStart={Crosshair} onClick={onShowOnMap}>
            Show on map
          </PillButton>
        </div>
      </header>

      <ul className="hd-tabs__tablist" role="tablist" aria-label="District sections">
        {TABS.map((t, idx) => (
          <li key={t.id} role="presentation">
            <button
              ref={(el) => {
                tabRefs.current[idx] = el;
              }}
              type="button"
              role="tab"
              id={`hd-tab-${t.id}`}
              aria-selected={activeTab === t.id}
              aria-controls={`hd-panel-${t.id}`}
              tabIndex={activeTab === t.id ? 0 : -1}
              onClick={() => setTab(t.id)}
              onKeyDown={onTabKeyDown(idx)}
              className="hd-tabs__tab"
            >
              {t.label}
            </button>
          </li>
        ))}
      </ul>

      <div
        role="tabpanel"
        id={`hd-panel-${activeTab}`}
        aria-labelledby={`hd-tab-${activeTab}`}
        className="hd-tabs__panel"
        tabIndex={0}
      >
        {activeTab === "seasons" && (
          <div className="hd-tabs__panel-body">
            <DistrictSeasonWindows district={facts.district} />
          </div>
        )}
        {activeTab === "regulations" && (
          <div className="hd-tabs__panel-body">
            <DistrictRegulationsPanel district={facts.district} />
          </div>
        )}
      </div>
    </section>
  );
};
