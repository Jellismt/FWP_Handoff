/**
 * @file WindStationCard.tsx
 * @module engage-mt/map/featureCards
 * @description Tier-2 renderer for Living Atlas wind stations.
 *
 * Replaced the generic metric-pill
 *              card with a custom layout: a compass-rose SVG
 *              that points the way the wind is *going* (the +180°
 *              convention from the layer config),
 *              fishing-condition narrative chosen from sustained-wind
 *              gust delta, and a temperature + dewpoint readout.
 *              Same FeatureRenderer surface — drops in to TapQueryPanel
 *              and the takeover modal identically.
 * @author Jamie Ellis / Engage MT
 * @created 2026-05-29
 * @updated 2026-07-03
 * @version 2.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import {
  MetricGrid,
  MetricPill,
  TipBlock,
} from "@/components/map/featureCards/core/cardPrimitives";
import { num, pick, str } from "@/components/map/featureCards/core/types";
import { registerFeature } from "@/components/map/featureCards/core/registry";
import type { FeatureRendererProps } from "@/components/map/featureCards/core/types";
import "./WindStationCard.css";

// ─── Beaufort scale (drives the compass accent color) ───────────────────────
// Standard 0-12 Beaufort bands; the accent color is the only consumer now
// a 5-band scale tuned for Montana stream + still-water situations.

interface BeaufortBand {
  /** Inclusive lower bound, mph. */
  minMph: number;
  /** Inclusive upper bound, mph. */
  maxMph: number;
  /** Beaufort scale value 0–12. */
  beaufort: number;
  /** Human-readable Beaufort label. */
  label: string;
  /** Module-aligned color (resolves at render time). */
  accentVar: string;
}

const BEAUFORT: readonly BeaufortBand[] = [
  {
    minMph: 0,
    maxMph: 0,
    beaufort: 0,
    label: "Calm",
    accentVar: "var(--fwp-neutral-300)",
  },
  {
    minMph: 1,
    maxMph: 3,
    beaufort: 1,
    label: "Light air",
    accentVar: "var(--fwp-blue-light)",
  },
  {
    minMph: 4,
    maxMph: 7,
    beaufort: 2,
    label: "Light breeze",
    accentVar: "var(--fwp-blue-light)",
  },
  {
    minMph: 8,
    maxMph: 12,
    beaufort: 3,
    label: "Gentle breeze",
    accentVar: "var(--fwp-green-light)",
  },
  {
    minMph: 13,
    maxMph: 18,
    beaufort: 4,
    label: "Moderate breeze",
    accentVar: "var(--fwp-green-mid)",
  },
  {
    minMph: 19,
    maxMph: 24,
    beaufort: 5,
    label: "Fresh breeze",
    accentVar: "var(--fwp-yellow)",
  },
  {
    minMph: 25,
    maxMph: 31,
    beaufort: 6,
    label: "Strong breeze",
    accentVar: "var(--fwp-orange)",
  },
  {
    minMph: 32,
    maxMph: 38,
    beaufort: 7,
    label: "Near gale",
    accentVar: "var(--fwp-orange)",
  },
  { minMph: 39, maxMph: 46, beaufort: 8, label: "Gale", accentVar: "var(--fwp-red)" },
  {
    minMph: 47,
    maxMph: 54,
    beaufort: 9,
    label: "Strong gale",
    accentVar: "var(--fwp-red)",
  },
  { minMph: 55, maxMph: 63, beaufort: 10, label: "Storm", accentVar: "var(--fwp-red)" },
  {
    minMph: 64,
    maxMph: 72,
    beaufort: 11,
    label: "Violent storm",
    accentVar: "var(--fwp-red)",
  },
  {
    minMph: 73,
    maxMph: Infinity,
    beaufort: 12,
    label: "Hurricane",
    accentVar: "var(--fwp-red)",
  },
];

const beaufortFor = (mph: number): BeaufortBand => {
  const rounded = Math.max(0, Math.round(mph));
  return BEAUFORT.find((b) => rounded >= b.minMph && rounded <= b.maxMph) ?? BEAUFORT[0];
};

// 16-point compass — handles both the abbreviation (NNW etc.) and the
// 22.5°-bucketed full label that the SR-only summary uses.
const COMPASS_POINTS = [
  { abbrev: "N", full: "north" },
  { abbrev: "NNE", full: "north-northeast" },
  { abbrev: "NE", full: "northeast" },
  { abbrev: "ENE", full: "east-northeast" },
  { abbrev: "E", full: "east" },
  { abbrev: "ESE", full: "east-southeast" },
  { abbrev: "SE", full: "southeast" },
  { abbrev: "SSE", full: "south-southeast" },
  { abbrev: "S", full: "south" },
  { abbrev: "SSW", full: "south-southwest" },
  { abbrev: "SW", full: "southwest" },
  { abbrev: "WSW", full: "west-southwest" },
  { abbrev: "W", full: "west" },
  { abbrev: "WNW", full: "west-northwest" },
  { abbrev: "NW", full: "northwest" },
  { abbrev: "NNW", full: "north-northwest" },
] as const;

const compassPointFor = (deg: number): (typeof COMPASS_POINTS)[number] => {
  const normalized = ((deg % 360) + 360) % 360;
  const index = Math.round(normalized / 22.5) % COMPASS_POINTS.length;
  return COMPASS_POINTS[index];
};

// ─── Compass rose SVG ───────────────────────────────────────────────────────

interface CompassProps {
  /** Direction the wind is COMING FROM, degrees clockwise from north. */
  dirFromDeg: number;
  /** Sustained wind in mph. */
  windMph: number;
  /** Beaufort band — drives accent color. */
  band: BeaufortBand;
}

const WindCompass = ({ dirFromDeg, windMph, band }: CompassProps): JSX.Element => {
  const SIZE = 220;
  const CENTER = SIZE / 2;
  const OUTER_R = 95;
  const TICK_R_OUT = 95;
  const TICK_R_IN = 86;
  const LABEL_R = 78;

  // Wind blows FROM dirFromDeg TO (dirFromDeg + 180) — arrow points TO.
  const arrowDirDeg = (dirFromDeg + 180) % 360;
  // SVG rotates clockwise from the +x axis by default; we want clockwise
  // from north (the +y up axis). Rotate the arrow group via the SVG
  // `rotate(deg, cx, cy)` transform, which is north-from-clockwise once
  // the arrow is drawn pointing up.

  const ticks = Array.from({ length: 16 }, (_, i) => i * 22.5);
  const cardinals: { label: string; deg: number; major: boolean }[] = [
    { label: "N", deg: 0, major: true },
    { label: "E", deg: 90, major: true },
    { label: "S", deg: 180, major: true },
    { label: "W", deg: 270, major: true },
  ];

  // Pre-compute label positions so SVG text rotation doesn't fight us.
  const labelPos = (deg: number, r: number): { x: number; y: number } => {
    const rad = (deg - 90) * (Math.PI / 180);
    return {
      x: CENTER + r * Math.cos(rad),
      y: CENTER + r * Math.sin(rad),
    };
  };

  return (
    <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="wind-compass" role="img" aria-hidden="true">
      {/* Outer ring */}
      <circle
        cx={CENTER}
        cy={CENTER}
        r={OUTER_R}
        fill="none"
        stroke="var(--fwp-border-subtle)"
        strokeWidth={1}
      />

      {/* Inner accent ring scaled by Beaufort tier */}
      <circle
        cx={CENTER}
        cy={CENTER}
        r={OUTER_R - 4}
        fill="none"
        stroke={band.accentVar}
        strokeWidth={2}
        strokeOpacity={0.35}
      />

      {/* 16 tick marks */}
      {ticks.map((deg) => {
        const isCardinal = deg % 90 === 0;
        const isOrdinal = !isCardinal && deg % 45 === 0;
        const rOut = TICK_R_OUT;
        const rIn = isCardinal ? TICK_R_IN - 4 : isOrdinal ? TICK_R_IN - 2 : TICK_R_IN;
        const a = labelPos(deg, rOut);
        const b = labelPos(deg, rIn);
        return (
          <line
            key={deg}
            x1={a.x}
            y1={a.y}
            x2={b.x}
            y2={b.y}
            stroke={isCardinal ? "var(--fwp-text-secondary)" : "var(--fwp-border-default)"}
            strokeWidth={isCardinal ? 1.5 : 1}
          />
        );
      })}

      {/* Cardinal labels */}
      {cardinals.map((c) => {
        const p = labelPos(c.deg, LABEL_R);
        return (
          <text
            key={c.label}
            x={p.x}
            y={p.y}
            textAnchor="middle"
            dominantBaseline="central"
            className="wind-compass__cardinal"
          >
            {c.label}
          </text>
        );
      })}

      {/* Wind arrow — rotates to point in the direction the wind is flowing
          (i.e. opposite of "where it came from"). Drawn pointing up at 0°
          so we rotate by arrowDirDeg to align it with compass north. */}
      <g transform={`rotate(${arrowDirDeg}, ${CENTER}, ${CENTER})`}>
        {/* Arrow shaft */}
        <line
          x1={CENTER}
          y1={CENTER}
          x2={CENTER}
          y2={CENTER - 64}
          stroke={band.accentVar}
          strokeWidth={4}
          strokeLinecap="round"
        />
        {/* Arrow head */}
        <path
          d={`M ${CENTER} ${CENTER - 78}
             L ${CENTER - 9} ${CENTER - 56}
             L ${CENTER} ${CENTER - 62}
             L ${CENTER + 9} ${CENTER - 56} Z`}
          fill={band.accentVar}
        />
        {/* Tail fletching */}
        <line
          x1={CENTER - 6}
          y1={CENTER + 10}
          x2={CENTER + 6}
          y2={CENTER + 10}
          stroke={band.accentVar}
          strokeWidth={3}
          strokeLinecap="round"
        />
      </g>

      {/* Center hub */}
      <circle
        cx={CENTER}
        cy={CENTER}
        r={32}
        fill="var(--fwp-bg-surface)"
        stroke={band.accentVar}
        strokeWidth={2}
      />
      <text
        x={CENTER}
        y={CENTER - 4}
        textAnchor="middle"
        dominantBaseline="central"
        className="wind-compass__value"
      >
        {windMph.toFixed(0)}
      </text>
      <text
        x={CENTER}
        y={CENTER + 13}
        textAnchor="middle"
        dominantBaseline="central"
        className="wind-compass__unit"
      >
        mph
      </text>
    </svg>
  );
};

// ─── Beaufort badge strip ───────────────────────────────────────────────────

// ─── Body ───────────────────────────────────────────────────────────────────

const Body = ({ attrs }: FeatureRendererProps): JSX.Element => {
  const get = pick(attrs);
  // Living Atlas service uses WIND_DIRECT (direction wind is coming FROM,
  // degrees CW from north). Layer description note: "the from→to
  // convention applies +180°" — so the arrow points away by 180°.
  const wind = num(get("WIND_SPEED", "wind_speed", "Wind"));
  const gust = num(get("WIND_GUST", "wind_gust", "Gust"));
  const dirDeg = num(get("WIND_DIRECT", "WIND_DIR_DEG", "wind_direct"));
  const dirText = str(get("WIND_DIR", "wind_dir", "Direction"));
  const temp = num(get("TEMP", "temperature", "TEMPERATURE"));
  const dewp = num(get("DEWPOINT", "dewpoint", "DEW_POINT"));
  const humidity = num(get("RELATIVE_HUMIDITY", "humidity", "REL_HUMIDITY"));

  // No usable wind reading → fall back to a minimal text card so the popup
  // doesn't render a 0-mph compass.
  if (wind === null || !Number.isFinite(wind)) {
    return (
      <TipBlock heading="No wind data" intent="info">
        This station hasn&rsquo;t reported a recent reading. The Living Atlas service samples every
        ~30 minutes; try again shortly.
      </TipBlock>
    );
  }

  const band = beaufortFor(wind);
  const compassDeg = dirDeg ?? 0;
  const compassPt = compassPointFor(compassDeg);
  const gustDelta = gust !== null ? Math.max(0, gust - wind) : null;

  // SR-only narration of the visual.
  const srSummary = [
    `Wind blowing from the ${compassPt.full} at ${wind.toFixed(0)} miles per hour`,
    gust !== null && gust > wind ? `gusting to ${gust.toFixed(0)}` : null,
    `Beaufort ${band.beaufort}, ${band.label.toLowerCase()}`,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <>
      <div className="wind-card">
        <WindCompass dirFromDeg={compassDeg} windMph={wind} band={band} />
        <div className="wind-card__readout">
          <p className="wind-card__direction">
            <span className="wind-card__direction-label">From</span>
            <span className="wind-card__direction-value">{dirText || compassPt.abbrev}</span>
            {dirDeg !== null && (
              <span className="wind-card__direction-deg">
                {Math.round(((dirDeg % 360) + 360) % 360)}°
              </span>
            )}
          </p>
          <p className="wind-card__heading">
            <span className="wind-card__heading-label">Wind heads</span>
            <span className="wind-card__heading-value">
              {compassPointFor(compassDeg + 180).abbrev}
            </span>
          </p>
          <span className="fwp-sr-only">{srSummary}.</span>
        </div>
      </div>

      <MetricGrid>
        {gust !== null && (
          <MetricPill
            label="Gust"
            value={`${gust.toFixed(0)} mph`}
            intent={gust >= 35 ? "warning" : "default"}
          />
        )}
        {gustDelta !== null && gustDelta >= 4 && (
          <MetricPill
            label="Gust spread"
            value={`+${gustDelta.toFixed(0)} mph`}
            intent={gustDelta >= 12 ? "warning" : "default"}
          />
        )}
        {temp !== null && <MetricPill label="Temp" value={`${temp.toFixed(0)} °F`} />}
        {dewp !== null && <MetricPill label="Dew point" value={`${dewp.toFixed(0)} °F`} />}
        {humidity !== null && <MetricPill label="Humidity" value={`${humidity.toFixed(0)}%`} />}
      </MetricGrid>
    </>
  );
};

// Register for BOTH the `wind-stations` id (cross-cutting enrichments
// resolve via it) AND the `engage-mt:wind-stations` Living Atlas layer.
for (const id of ["wind-stations", "engage-mt:wind-stations"]) {
  registerFeature(id, {
    // No meta-row — the card body carries the station identity.
    hideMeta: true,
    summary: (a) => String(a.NAME ?? a.STATION_NAME ?? a.station ?? "Wind station"),
    subtitle: () => "Living Atlas — live wind",
    Body,
  });
}
