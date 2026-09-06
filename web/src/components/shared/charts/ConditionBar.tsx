/**
 * @file ConditionBar.tsx
 * @module engage-mt/shared/charts
 * @description Horizontal segmented bar with a marker pin. Used for flow
 *              classification (low / typical / high / flood), reservoir pool
 *              fullness, snow-pack ratio. Inline SVG, no dependencies.
 *
 *              `variant` prop adds multi-stop
 *              continuous gradients ('flow' / 'temp' / 'depth' / 'swe')
 *              mapped onto Engage MT brand domain tokens. The discrete
 *              segmented mode is preserved for callers that still pass
 *              an explicit `segments` array.
 * @author Jamie Ellis / Engage MT
 * @created 2026-05-29
 * @updated 2026-07-15
 * @version 1.1.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { TOOLTIPS } from "@/copy/tooltips";
import "./charts.css";

export interface ConditionSegment {
  label: string;
  /** Fraction of the bar this segment occupies, 0..1. Sums should equal 1. */
  weight: number;
  /** CSS color (or brand-token var()). */
  color: string;
}

/**
 * Predefined gradient variants — multi-stop continuous bars
 * that read more like a thermometer than a stacked legend. Each variant
 * ships its own band-label legend so a caller doesn't have to author
 * one. Use `segments` directly when you want fully custom labels/colors.
 */
export type ConditionBarVariant = "flow" | "temp" | "depth" | "swe";

interface VariantSpec {
  /** CSS gradient string (uses brand-token vars). */
  gradient: string;
  /** Plain-language labels rendered under the bar. */
  legend: readonly string[];
}

const VARIANTS: Record<ConditionBarVariant, VariantSpec> = {
  flow: {
    gradient:
      "linear-gradient(90deg, var(--fwp-drought, var(--fwp-domain-drought)) 0%, var(--fwp-domain-drought-a20) 12%, var(--fwp-ramp-blue-1) 28%, var(--fwp-domain-flow) 50%, var(--fwp-ramp-blue-4) 72%, var(--fwp-domain-fire) 90%, var(--fwp-red) 100%)",
    legend: ["Drought", "Low", "Typical", "High", "Flood"],
  },
  temp: {
    gradient:
      "linear-gradient(90deg, var(--fwp-domain-snow) 0%, var(--fwp-ramp-blue-2) 20%, var(--fwp-success, var(--fwp-domain-fish)) 40%, var(--fwp-domain-temp) 65%, var(--fwp-domain-fire) 85%, var(--fwp-red) 100%)",
    legend: ["Cold", "Cool", "Optimal", "Warm", "Stress"],
  },
  depth: {
    gradient:
      "linear-gradient(90deg, var(--fwp-ramp-blue-1) 0%, var(--fwp-ramp-blue-2) 33%, var(--fwp-ramp-blue-3) 66%, var(--fwp-ramp-blue-4) 100%)",
    legend: ["Shallow", "Moderate", "Deep"],
  },
  swe: {
    gradient:
      "linear-gradient(90deg, var(--fwp-domain-drought) 0%, var(--fwp-ramp-blue-1) 35%, var(--fwp-domain-snow) 65%, var(--fwp-domain-elev) 100%)",
    legend: ["Low", "Normal", "Deep", "Heavy"],
  },
};

interface Props {
  /**
   * Optional gradient variant. When set, the bar renders a continuous
   * multi-stop gradient with built-in band labels and `segments` is
   * ignored. When omitted, callers must pass `segments`.
   */
  variant?: ConditionBarVariant;
  segments?: readonly ConditionSegment[];
  /** Current value as a fraction 0..1 of the full bar. */
  marker?: number;
  /** Optional caption rendered above the bar. */
  caption?: string;
  /** Optional read-out (e.g. "342 cfs"). Rendered to the right of the bar. */
  readout?: string;
  height?: number;
  ariaLabel?: string;
}

export const ConditionBar = ({
  variant,
  segments,
  marker,
  caption,
  readout,
  height = 18,
  ariaLabel,
}: Props): JSX.Element => {
  const markerPct = marker !== undefined ? Math.min(1, Math.max(0, marker)) * 100 : null;

  // Variant mode — continuous multi-stop gradient + built-in legend.
  if (variant) {
    const spec = VARIANTS[variant];
    return (
      <div
        className={`fwp-condition-bar fwp-condition-bar--${variant}`}
        aria-label={ariaLabel ?? caption ?? TOOLTIPS.chartConditionBar}
      >
        {caption && <div className="fwp-condition-bar__caption">{caption}</div>}
        <div className="fwp-condition-bar__row">
          <div
            className="fwp-condition-bar__track fwp-condition-bar__track--gradient"
            style={{ height, background: spec.gradient }}
          >
            {markerPct !== null && (
              <div
                className="fwp-condition-bar__marker"
                style={{ left: `${markerPct}%` }}
                aria-hidden="true"
              />
            )}
          </div>
          {readout && <span className="fwp-condition-bar__readout">{readout}</span>}
        </div>
        <ul className="fwp-condition-bar__legend fwp-condition-bar__legend--bands">
          {spec.legend.map((label) => (
            <li key={label}>{label}</li>
          ))}
        </ul>
      </div>
    );
  }

  // Discrete segmented mode (original behavior).
  const segs = segments ?? [];
  const total = segs.reduce((sum, s) => sum + s.weight, 0) || 1;

  return (
    <div
      className="fwp-condition-bar"
      aria-label={ariaLabel ?? caption ?? TOOLTIPS.chartConditionBar}
    >
      {caption && <div className="fwp-condition-bar__caption">{caption}</div>}
      <div className="fwp-condition-bar__row">
        <div className="fwp-condition-bar__track" style={{ height }}>
          {segs.map((seg, i) => (
            <div
              key={`${seg.label}-${i}`}
              className="fwp-condition-bar__segment"
              style={{
                width: `${(seg.weight / total) * 100}%`,
                background: seg.color,
              }}
              title={seg.label}
              aria-label={seg.label}
            />
          ))}
          {markerPct !== null && (
            <div
              className="fwp-condition-bar__marker"
              style={{ left: `${markerPct}%` }}
              aria-hidden="true"
            />
          )}
        </div>
        {readout && <span className="fwp-condition-bar__readout">{readout}</span>}
      </div>
      <ul className="fwp-condition-bar__legend">
        {segs.map((s) => (
          <li key={s.label}>
            <span className="fwp-condition-bar__swatch" style={{ background: s.color }} />
            {s.label}
          </li>
        ))}
      </ul>
    </div>
  );
};
