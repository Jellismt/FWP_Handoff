/**
 * @file cardPrimitives.tsx
 * @module engage-mt/map/featureCards
 * @description Primitive building blocks every feature card composes from:
 *              metric pills and grids, hero values, tip blocks, badge rows,
 *              key/value lists, and domain-colored pills. Every Tier-2 card
 *              leads with one hero (HeroBlock or MetricCallout) and layers an
 *              orthogonal domain color axis on top of intent.
 * @author Jamie Ellis / Engage MT
 * @created 2026-05-29
 * @updated 2026-07-06
 * @version 1.5.1
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import type { CSSProperties, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import "./cardPrimitives.css";

type Intent = "default" | "success" | "warning" | "danger" | "live";

/**
 * Domain axis — orthogonal to intent. Where intent says "is this OK?",
 * domain says "what KIND of thing is this metric?". Both can be set on
 * a single MetricPill: intent owns the left stripe, domain owns the
 * icon halo + value glyph color. Tokens live in brand-tokens.css.
 */
export type Domain =
  | "flow"
  | "temp"
  | "fire"
  | "fish"
  | "park"
  | "snow"
  | "wind"
  | "elev"
  | "drought"
  | "mercury"
  | "wildlife";

const domainStyle = (domain: Domain | undefined): CSSProperties | undefined => {
  if (!domain) return undefined;
  return {
    "--domain-accent": `var(--fwp-domain-${domain})`,
    "--domain-tint": `var(--fwp-domain-${domain}-a20)`,
  } as CSSProperties;
};

export const MetricPill = ({
  label,
  value,
  intent = "default",
  domain,
  icon: Icon,
}: {
  label: string;
  value: ReactNode;
  intent?: Intent;
  /** Optional domain — paints icon halo + value accent glyph color. */
  domain?: Domain;
  /** Optional Lucide icon rendered in a tinted halo before the text. */
  icon?: LucideIcon;
}): JSX.Element => (
  <div
    className={`metric-pill metric-pill--${intent}${Icon ? " metric-pill--with-icon" : ""}`}
    style={domainStyle(domain)}
    data-domain={domain ?? undefined}
  >
    {Icon && (
      <span className="metric-pill__icon" aria-hidden>
        <Icon size={14} strokeWidth={2.25} />
      </span>
    )}
    {Icon ? (
      <span className="metric-pill__text">
        <dt className="metric-pill__label">{label}</dt>
        <dd className="metric-pill__value">{value}</dd>
      </span>
    ) : (
      <>
        <dt className="metric-pill__label">{label}</dt>
        <dd className="metric-pill__value">{value}</dd>
      </>
    )}
  </div>
);

export const MetricGrid = ({
  children,
  stack = false,
}: {
  children: ReactNode;
  /** Single-column layout — for cards whose pill values run long (e.g.
   *  free-text hours) and wrap badly in the auto-fit grid. */
  stack?: boolean;
}): JSX.Element => (
  <dl className={stack ? "metric-grid metric-grid--stack" : "metric-grid"}>{children}</dl>
);

export const KeyValueRow = ({
  label,
  value,
  stack,
}: {
  label: string;
  value: ReactNode;
  /** Stack the value on its own line, left-aligned under the label. */
  stack?: boolean;
}): JSX.Element => (
  <div className={stack ? "kv-row kv-row--stack" : "kv-row"}>
    <span className="kv-row__label">{label}</span>
    <span className="kv-row__value">{value}</span>
  </div>
);

export const Paragraph = ({ children }: { children: ReactNode }): JSX.Element => (
  <p className="feature-paragraph">{children}</p>
);

export const ChipRow = ({ items }: { items: ReactNode[] }): JSX.Element => (
  <div className="chip-row" role="list">
    {items.map((item, idx) => (
      <span key={idx} role="listitem" className="chip-row__chip">
        {item}
      </span>
    ))}
  </div>
);

/**
 * Hero numeric display — large value + caption + optional delta indicator.
 * Used by takeover popups for the headline metric (current cfs, pool ft, etc.).
 */
export const HeroValue = ({
  caption,
  value,
  unit,
  delta,
}: {
  caption?: string;
  value: ReactNode;
  unit?: string;
  delta?: { label: string; direction: "up" | "down" | "flat" };
}): JSX.Element => (
  <div className="fwp-hero-value">
    {caption && <p className="fwp-hero-value__caption">{caption}</p>}
    <div className="fwp-hero-value__row">
      <span className="fwp-hero-value__number">{value}</span>
      {unit && <span className="fwp-hero-value__unit">{unit}</span>}
    </div>
    {delta && (
      <p className={`fwp-hero-value__delta fwp-hero-value__delta--${delta.direction}`}>
        {delta.direction === "up" ? "▲" : delta.direction === "down" ? "▼" : "—"} {delta.label}
      </p>
    )}
  </div>
);

/**
 * Larger, boxed metric callout. Use when a single number deserves
 * more visual weight than a MetricPill but isn't the hero.
 */
export const MetricCallout = ({
  title,
  value,
  sub,
  intent = "default",
}: {
  title: string;
  value: ReactNode;
  sub?: ReactNode;
  intent?: "default" | "success" | "warning" | "danger";
}): JSX.Element => (
  <section className={`fwp-metric-callout fwp-metric-callout--${intent}`}>
    <p className="fwp-metric-callout__title">{title}</p>
    <p className="fwp-metric-callout__value">{value}</p>
    {sub && <p className="fwp-metric-callout__sub">{sub}</p>}
  </section>
);

/**
 * Soft amber tip card. Used widely to surface short field tips +
 * regulation context.
 */
export const TipBlock = ({
  heading,
  children,
  intent = "tip",
}: {
  heading?: string;
  children: ReactNode;
  intent?: "tip" | "warning" | "danger" | "info";
}): JSX.Element => (
  <aside className={`fwp-tip-block fwp-tip-block--${intent}`}>
    {heading && <h4 className="fwp-tip-block__heading">{heading}</h4>}
    <div className="fwp-tip-block__body">{children}</div>
  </aside>
);

/**
 * Horizontal labelled chip row. Per-species, per-amenity, per-method lists.
 *
 * Items may be plain strings (default styling) or rich objects with an
 * optional Lucide icon + intent color. The string form is preserved for
 * backward compat with the dozens of existing callers that pass
 * `readonly string[]`.
 */
type BadgeIntent = "default" | "success" | "warning" | "danger" | "muted" | "accent";

export type BadgeItem = string | { icon?: LucideIcon; label: string; intent?: BadgeIntent };

export const BadgeRow = ({
  label,
  badges,
}: {
  label?: string;
  badges: readonly BadgeItem[];
}): JSX.Element => (
  <div className="fwp-badge-row">
    {label && <span className="fwp-badge-row__label">{label}</span>}
    <ul className="fwp-badge-row__list">
      {badges.map((badge, i) => {
        const isObject = typeof badge !== "string";
        const text = isObject ? badge.label : badge;
        const Icon = isObject ? badge.icon : undefined;
        const intent: BadgeIntent = isObject ? (badge.intent ?? "default") : "default";
        return (
          <li
            key={`${text}-${i}`}
            className={`fwp-badge-row__badge fwp-badge-row__badge--${intent}`}
          >
            {Icon && <Icon size={12} strokeWidth={2.25} aria-hidden />}
            {text}
          </li>
        );
      })}
    </ul>
  </div>
);

/**
 * Vertical key / value list with subtle dividers. Use for the "details"
 * section of any branded card that has 5–10 attributes to surface.
 */
export const ListCard = ({
  title,
  rows,
}: {
  title?: string;
  rows: readonly { label: string; value: ReactNode }[];
}): JSX.Element => (
  <section className="fwp-kv-card">
    {title && <h4 className="fwp-kv-card__title">{title}</h4>}
    <dl className="fwp-kv-card__list">
      {rows.map((r) => (
        <div key={r.label} className="fwp-kv-card__row">
          <dt>{r.label}</dt>
          <dd>{r.value}</dd>
        </div>
      ))}
    </dl>
  </section>
);

/* ─────────────────────────────────────────────────────────────────
 * HeroBlock
 * Wraps HeroValue in a glass-style surface with a top-edge accent
 * gradient stripe + soft glow. Every Tier-2 card should lead with
 * exactly one HeroBlock (or a MetricCallout when the headline is a
 * label, not a number).
 *
 * The `domain` prop overrides the inherited module accent for the
 * stripe + numeral glow, useful for cross-cutting hydro/weather/fire
 * cards where the metric is owned by a domain not by the active tab.
 * ───────────────────────────────────────────────────────────────── */
/* ─────────────────────────────────────────────────────────────────
 * HeroPair
 * Two HeroBlocks rendered side-by-side as a responsive grid (e.g. flow +
 * temperature). Collapses to a stack below ~520px container
 * width so cards remain readable on mobile right-rail / bottom-sheet
 * surfaces. Compose with the existing HeroBlock; no new metric API.
 * ───────────────────────────────────────────────────────────────── */
export const HeroPair = ({ children }: { children: ReactNode }): JSX.Element => (
  <div className="fwp-hero-pair">{children}</div>
);

export const HeroBlock = ({
  caption,
  value,
  unit,
  delta,
  domain,
  live = false,
  preset = "panel",
}: {
  caption?: string;
  value: ReactNode;
  unit?: string;
  delta?: { label: string; direction: "up" | "down" | "flat" };
  domain?: Domain;
  /** When true, renders a pulsing 8px dot in the top-right corner. */
  live?: boolean;
  /** Visual density — 'takeover' bumps numeral to text-4xl. */
  preset?: "panel" | "takeover";
}): JSX.Element => {
  const cls = [
    "fwp-hero-block",
    preset === "takeover" ? "fwp-hero-block--takeover" : null,
    live ? "fwp-hero-block--live" : null,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <section className={cls} style={domainStyle(domain)} aria-live={live ? "polite" : undefined}>
      <HeroValue caption={caption} value={value} unit={unit} delta={delta} />
      {live && <span className="fwp-sr-only">Live data</span>}
    </section>
  );
};

/* ─────────────────────────────────────────────────────────────────
 * DomainPill
 * Convenience alias for MetricPill with an icon + domain. Renderers
 * that don't want to pass Icon + domain separately can use the
 * domain-key map to pick the canonical Lucide icon per domain.
 * ───────────────────────────────────────────────────────────────── */
import {
  Droplets,
  Thermometer,
  Flame,
  Fish as FishIcon,
  TreePine,
  Snowflake,
  Wind,
  Mountain,
  Sun,
  Skull,
  Bird,
} from "lucide-react";

const DOMAIN_ICON: Record<Domain, LucideIcon> = {
  flow: Droplets,
  temp: Thermometer,
  fire: Flame,
  fish: FishIcon,
  park: TreePine,
  snow: Snowflake,
  wind: Wind,
  elev: Mountain,
  drought: Sun,
  mercury: Skull,
  wildlife: Bird,
};

export const DomainPill = ({
  label,
  value,
  domain,
  intent = "default",
  icon,
}: {
  label: string;
  value: ReactNode;
  domain: Domain;
  intent?: Intent;
  /** Override the default icon for this domain. */
  icon?: LucideIcon;
}): JSX.Element => (
  <MetricPill
    label={label}
    value={value}
    intent={intent}
    domain={domain}
    icon={icon ?? DOMAIN_ICON[domain]}
  />
);

/* ─────────────────────────────────────────────────────────────────
 * SubtleText
 * Inline secondary text — opacity 0.7, regular weight. Use for in-line
 * qualifiers like " · group label" trailing a heading. Replaces the
 * ad-hoc `style={{ opacity: 0.7, fontWeight: 400 }}` pattern.
 * ───────────────────────────────────────────────────────────────── */
export const SubtleText = ({ children }: { children: ReactNode }): JSX.Element => (
  <span className="fwp-subtle-text">{children}</span>
);

/* ─────────────────────────────────────────────────────────────────
 * SectionHeading
 * In-card sub-section heading. Renders an <h4> with brand typography
 * (medium weight, small caps-ish letter-spacing, margin-top breath).
 * Use to break a long card body into labeled sections — replaces the
 * ad-hoc `<p style={{ marginTop: 12, fontWeight: 600 }}>` pattern.
 * ───────────────────────────────────────────────────────────────── */
export const SectionHeading = ({ children }: { children: ReactNode }): JSX.Element => (
  <h4 className="fwp-section-heading">{children}</h4>
);

/* ─────────────────────────────────────────────────────────────────
 * ExplainerNote
 * 1–3 sentences of muted plain-English context that sit directly
 * under a SectionHeading, chart heading, or metric label. NOT a
 * TipBlock — no box, no icon, no intent color — visually lighter so
 * it explains a technical term (Fulton's K, CFS, bonus-point squaring)
 * without competing with the metric it captions. Caps at ~60ch so it
 * stays readable inside takeover panels.
 * ───────────────────────────────────────────────────────────────── */
export const ExplainerNote = ({ children }: { children: ReactNode }): JSX.Element => (
  <p className="fwp-explainer-note">{children}</p>
);
