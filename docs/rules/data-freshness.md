# Data Freshness — Engage MT Rules

Every layer (Tier 1) and every dataset (Tier 2) carries a freshness category. The UI surfaces it so users know whether they're seeing live data, a daily snapshot, or a versioned dataset.

## Vocabulary

| Category | Meaning | Re-fetch trigger | UI chip example |
|---|---|---|---|
| `realtime` | Live source; data changes continuously | Layer load + on view extent change | "Live · USGS gage 06054500" |
| `hourly` | Refreshed at most every hour | First load per session + hourly | "Updated 23 min ago" |
| `daily` | Refreshed every day | First load per session | "Updated today" / "Updated yesterday" |
| `weekly` | Refreshed weekly | First load per session | "Updated this week" |
| `static` | Doesn't change; ArcGIS feature service that's effectively a snapshot | Never (cache aggressively) | "Static reference" |
| `versioned` | Tier-2 bundled dataset with an `effectiveDate`. Not a `LayerFreshness` value — datasets carry it, layers do not | Manifest version bump | "Effective 2026-03-01" |

## Where it shows up

- **Layer panel** — every row shows a small freshness chip below the layer title.
- **TapQueryPanel result chips** — each result shows the owning layer's freshness.
- **Detail panels (district detail, regulation cards)** — header chip.
- **Footer / about page** — manifest version + last regeneration timestamp for Tier 2.

## How to wire it on a layer

```ts
interface LayerDef {
  // ... existing fields ...
  freshness: "realtime" | "hourly" | "daily" | "weekly" | "static";
  lastUpdate?: string;  // ISO datetime; for realtime/hourly/daily/weekly
  source: string;       // human-readable attribution
  upstreamUrl?: string;
}
```

`lastUpdate` is populated at runtime for live layers via a small service that reads the layer's REST `lastEditDate` (ArcGIS exposes this in service metadata). For `static` and `versioned`, `lastUpdate` is omitted.

## How to wire it on a Tier-2 dataset

Datasets always have category `versioned`. The dataset payload (and its typed loader in `services/data/`) carries `effectiveDate` and `source`; the consumer passes those to `<FreshnessChip freshness="versioned" …>` as props. The build-time `data-manifest.json` holds the authoritative copy (gated by `check:data-freshness`); at runtime `services/data/manifest.ts` loads it for the Attribution page, which lists every bundled dataset with its effective and expiry dates, license, and provenance tier (`demo-fixture` / `extracted` / `authoritative`, assigned by `scripts/build-data/lib/provenanceTier.mjs`: a dataset is `extracted` only when its source names an authoritative upstream).

## Regulations tiers

Every regulations dataset comes back with a `RegsFreshness` (`services/regsApi/types.ts`)
whose `tier` names the copy: `live` (the API), `cached` (browser Cache Storage),
`field-copy` (the copy the device saved with an offline area or on its last
successful fetch), or `bundled` (the copy built into the app). It also carries
the published `version`, the season `effectiveDate`, and `stale` (past
`validUntil`, or a stored copy older than 90 days). The regulations panel passes
these straight to the chip (`cached` / `fieldCopy` / `bundled` / `stale`) and adds
a warning block when `stale` is true; `CorrectionsBanner` compares `version`
against the corrections feed so a reader on an older copy sees which corrections
it is missing. Never label a stored or bundled copy as live.

## Real-time alerts

`realtime` is distinct from "real-time alerts." A layer's `freshness` describes its data; an alert is a push event.

## Stale-data handling

If `lastUpdate` is more than the category's expected window (e.g., a `daily` layer reports `lastUpdate = 5 days ago`), the freshness chip turns **amber** with a "Stale" notice. The map still renders; users are warned.

For Tier-2 versioned data, if `today > expiresDate`, the chip turns amber and the panel shows a "Data may be out of date — pending regulation refresh" notice.

## Don't lie to users

The cardinal rule of freshness display: **never show a stale `lastUpdate` as if it were current**. If we can't get the real `lastUpdate`, show the freshness category alone ("Daily refresh") — don't fabricate a time.
