/**
 * @file LayerPanel.tsx
 * @module engage-mt/map
 * @description Calcite panel + native-HTML layer rows that let the user toggle each
 *              LAYER_REGISTRY entry. Native rows replace CalciteList/ListItem because
 *              the Calcite 3.3 List crashes its aria-live updater on items with a
 *              dynamic actions-end slot (renderItemAriaLive throws on undefined). The
 *              native pill-switch design is more on-brand anyway. Grouped by module
 *              for scanability; surfaces load-error notice from the load-status store.
 * — each row exposes an SR-only textual equivalent of its
 *              swatch + description via aria-describedby (508 legend parity).
 * @author Jamie Ellis / Engage MT
 * @created 2026-05-29
 * @updated 2026-07-03
 * @version 2.4.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { memo, useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, CloudOff, Layers, Lock, X } from "lucide-react";
import { CalcitePanel, CalciteNotice } from "@esri/calcite-components-react";
import { LAYER_REGISTRY } from "@/config/layers";
import { useLayerVisibilityStore } from "@/store/map/layerVisibilityStore";
import { useLayerLoadStatusStore } from "@/store/map/layerLoadStatusStore";
import type { EngageMtModule, LayerDef } from "@/types/layers";
import { LayerSwatch } from "./symbology/swatch";
// FreshnessChip removed from rows (compact panel ask). Kept
// elsewhere in the app where it still earns its keep (popup headers etc.).
import "./LayerPanel.css";

const MODULE_LABEL: Record<EngageMtModule, string> = {
  reference: "Reference",
  hunt: "Hunt",
  fish: "Fish",
  explore: "Explore",
  access: "Access",
  manage: "My FWP",
  shared: "Conditions",
};

/**
 * Display order for layer groups in the panel.
 * "Conditions" (radar, wind, gages, wildfires) leads: it holds
 * the live default-on layers. "Reference" follows, then the module groups.
 */
const MODULE_ORDER: readonly EngageMtModule[] = [
  "shared",
  "reference",
  "hunt",
  "fish",
  "explore",
  "access",
  "manage",
];

interface LayerRowProps {
  def: LayerDef;
  visible: boolean;
  failed: boolean;
  /**
   * Toggle the layer's visibility. Identity stays stable across renders
   * (it comes from Zustand) so the React.memo wrapper actually skips
   * re-renders when neither visible nor failed changed.
   */
  toggle: (id: string) => void;
}

// Memo'd because a single layer toggle re-renders the
// panel container; without memo, every other row reconciled too.
// `onToggle` is bound via useCallback in the parent so the identity
// stays stable across renders.
// Strip the subgroup prefix from a layer's display title when
// the layer renders inside its subgroup row. The user shouldn't see
// "Hunting Districts — Antelope" when the row already sits under a
// "Hunting Districts" group header — the redundancy makes the panel
// feel cluttered. Removes the subgroup prefix + the following separator
// (em-dash, en-dash, hyphen, colon, parens) and the trailing close-paren
// when present. Falls back to the original title if the prefix doesn't
// actually start the title or trimming would leave nothing useful.
const trimSubgroupPrefix = (title: string, subgroup: string | undefined): string => {
  if (!subgroup) return title;
  if (!title.startsWith(subgroup)) return title;
  const stripped = title
    .slice(subgroup.length)
    .replace(/^[ —–\-:(]+/, "")
    .replace(/\)$/, "")
    .trim();
  return stripped || title;
};

// — Textual equivalent of the visual swatch (the swatch itself is
// `aria-hidden` in swatch.tsx, so a screen-reader user needs the symbol's
// meaning in words). Mirrors the geometry/polygon-role branches the swatch
// paints so the spoken legend matches the drawn one.
const swatchTextEquivalent = (def: LayerDef): string => {
  if (def.geometry === "polygon") {
    switch (def.symbology?.polygonRole) {
      case "boundary":
        return "Outlined area";
      case "overlay":
        return "Hatched overlay area";
      default:
        return "Filled area";
    }
  }
  if (def.geometry === "line") return "Line";
  if (def.geometry === "raster") return "Map imagery";
  if (def.geometry === "vector-tile") return "Map overlay";
  return def.symbology?.cluster?.enabled ? "Clustered point markers" : "Point marker";
};

const LayerRow = memo(function LayerRow({
  def,
  visible,
  failed,
  toggle,
}: LayerRowProps): JSX.Element {
  const onToggle = (): void => toggle(def.id);
  const displayTitle = trimSubgroupPrefix(def.title, def.subgroup);
  if (def.deferredLoad) {
    return (
      <li className="layer-panel__row layer-panel__row--deferred" data-module={def.module}>
        <div className="layer-panel__row-content">
          <span className="layer-panel__row-title">{displayTitle}</span>
          <span className="fwp-sr-only">{def.description} — sign-in required.</span>
        </div>
        <span
          className="layer-panel__deferred-badge"
          title="FWP credentials required. Tier-2 fixture is browsable from the module page."
        >
          <Lock size={11} strokeWidth={2.5} aria-hidden />
          <span>Sign-in</span>
        </span>
      </li>
    );
  }
  // Temporarily-offline upstream (e.g. FWP Block Management out of season).
  // Non-interactive row — the layer was never added to the map, so there's
  // nothing to toggle. The badge explains why and when it returns.
  if (def.unavailable) {
    const { badge, note } = def.unavailable;
    return (
      <li className="layer-panel__row layer-panel__row--offline" data-module={def.module}>
        <div className="layer-panel__row-content">
          <span className="layer-panel__row-title">{displayTitle}</span>
          <span className="layer-panel__row-subtitle">{note}</span>
        </div>
        <span className="layer-panel__offline-badge" title={note}>
          <CloudOff size={11} strokeWidth={2.5} aria-hidden />
          <span>{badge ?? "Offline"}</span>
        </span>
      </li>
    );
  }
  // The toggle button now carries the failure
  // state in its own label so SR users hear "failed to load" alongside
  // the show/hide affordance instead of having to discover the pill below.
  const ariaLabel = failed
    ? `${visible ? "Hide" : "Show"} ${def.title} (failed to load)`
    : visible
      ? `Hide ${def.title}`
      : `Show ${def.title}`;
  // — SR-only legend equivalent: the swatch symbol in words plus
  // the layer's description, associated with the toggle via aria-describedby
  // so a screen-reader user hears what the layer shows + how it's drawn.
  const descId = `layer-desc-${def.id}`;
  const srLegendText = `${swatchTextEquivalent(def)}. ${def.description}`;
  const rowButton = (
    <button
      type="button"
      className="layer-panel__row-button"
      onClick={onToggle}
      aria-pressed={visible}
      aria-label={ariaLabel}
      aria-describedby={descId}
    >
      {/* Per-row swatch — mirrors the renderer at 14px so the
          panel reads as a real cartographic legend. */}
      <LayerSwatch def={def} />
      <span className="layer-panel__row-content">
        <span className="layer-panel__row-titlerow">
          <span className="layer-panel__row-title">{displayTitle}</span>
          {failed && (
            <span className="layer-panel__row-failed-pill" aria-label="Layer failed to load">
              Couldn’t load
            </span>
          )}
        </span>
      </span>
      {/* Simple on/off switch — sits on the right so the title leads the row. */}
      <span
        className={`layer-panel__toggle ${visible ? "layer-panel__toggle--on" : ""}`}
        aria-hidden
      />
    </button>
  );
  return (
    <li
      className={`layer-panel__row ${
        visible ? "layer-panel__row--on" : ""
      } ${failed ? "layer-panel__row--failed" : ""}`}
      data-module={def.module}
    >
      {rowButton}
      <span id={descId} className="fwp-sr-only">
        {srLegendText}
      </span>
    </li>
  );
});

export const LayerPanel = (): JSX.Element => {
  // Default collapsed on mobile so the map is unobstructed; expanded by
  // default on tablet+ where there's room for the panel.
  const isMobile = typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches;
  const [collapsed, setCollapsed] = useState(isMobile);
  // Track which module groups + subgroups are folded so users can focus one
  // bucket at a time. Default every group AND subgroup to folded so the
  // panel opens compact — the user clicks to expand what they want to see.
  const [foldedGroups, setFoldedGroups] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const def of LAYER_REGISTRY) {
      if (def.hiddenFromPanel) continue;
      init[def.module] = true;
      if (def.subgroup) init[`${def.module}/${def.subgroup}`] = true;
    }
    return init;
  });
  const visibility = useLayerVisibilityStore((s) => s.visible);
  const rawToggle = useLayerVisibilityStore((s) => s.toggle);

  // Composite cascade. When the user toggles a composite row
  // (e.g. "Hydrology"), fire `toggle()` on each child so the underlying
  // FeatureLayers go on/off together. The composite's own `visibility`
  // key is unused by the map but kept in sync for downstream consumers.
  const toggle = useMemo(() => {
    const compositeChildren = new Map<string, readonly string[]>();
    for (const def of LAYER_REGISTRY) {
      if (def.composite) compositeChildren.set(def.id, def.composite);
    }
    return (id: string): void => {
      const children = compositeChildren.get(id);
      if (!children) {
        rawToggle(id);
        return;
      }
      // Cascade: if the parent reads as "all on", turn them all off;
      // otherwise turn any off child on. Snapshot visibility once so
      // mid-loop store updates don't change the cascade target.
      const snapshot = useLayerVisibilityStore.getState().visible;
      const allOn = children.every((c) => snapshot[c]);
      for (const c of children) {
        if (allOn) {
          if (snapshot[c]) rawToggle(c);
        } else if (!snapshot[c]) rawToggle(c);
      }
    };
  }, [rawToggle]);

  // Composite "visible" + "failed" derived state. The row's
  // toggle reads ON when every child is ON; the failed pill fires when
  // ANY child failed (a partial-load also counts).
  const compositeVisible = useMemo(() => {
    const map: Record<string, boolean> = {};
    for (const def of LAYER_REGISTRY) {
      if (!def.composite) continue;
      map[def.id] = def.composite.every((c) => visibility[c]);
    }
    return map;
  }, [visibility]);
  const failed = useLayerLoadStatusStore((s) => s.failed);

  // Re-collapse when crossing the breakpoint downward (rotated to portrait, etc.)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 767px)");
    const onChange = (e: MediaQueryListEvent): void => {
      if (e.matches) setCollapsed(true);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // Within each module, sort rows so the panel reads as a
  // structured legend instead of a flat list. Order mirrors the map's
  // Cartographic z-order from
  //   1. habitat polygons (filled destinations — read first)
  //   2. boundary polygons (outline-only reference)
  //   3. overlay polygons (hatched permission overlays)
  //   4. default polygons (no explicit role)
  //   5. lines
  //   6. points (the densest, top of stack)
  // Within each tier we preserve the registry order for stable scanning.
  const rowSortKey = (d: LayerDef): number => {
    // Explicitly ranked rows pin to the top of their group.
    if (d.panelRank !== undefined) return d.panelRank - 100;
    if (d.geometry === "polygon") {
      switch (d.symbology?.polygonRole) {
        case "habitat":
          return 1;
        case "boundary":
          return 2;
        case "overlay":
          return 3;
        default:
          return 4;
      }
    }
    if (d.geometry === "line") return 5;
    return 6;
  };
  const grouped = useMemo(() => {
    const result = new Map<EngageMtModule, typeof LAYER_REGISTRY>();
    for (const def of LAYER_REGISTRY) {
      // Hide layers owned by a composite (e.g. the underlying
      // DNRC + USGS gage services hidden behind the Stream-gages row).
      if (def.hiddenFromPanel) continue;
      const bucket = (result.get(def.module) ?? []) as typeof LAYER_REGISTRY;
      result.set(def.module, [...bucket, def] as typeof LAYER_REGISTRY);
    }
    // Stable sort by cartographic-role tier Array.prototype.sort
    // is stable in modern engines (ES2019+), preserving registry order
    // within each tier.
    for (const [module, defs] of result.entries()) {
      result.set(
        module,
        [...defs].sort((a, b) => rowSortKey(a) - rowSortKey(b)) as typeof LAYER_REGISTRY,
      );
    }
    return result;
  }, []);

  // Visible-layer count per module (for the collapsed pill badge + group hints).
  // Hidden children of composites don't count individually
  // (the composite owns the row). Composite rows count once when all
  // children are visible.
  const onCountByModule = useMemo(() => {
    const m: Partial<Record<EngageMtModule, number>> = {};
    for (const def of LAYER_REGISTRY) {
      if (def.hiddenFromPanel) continue;
      const visible = def.composite
        ? def.composite.every((c) => visibility[c])
        : visibility[def.id];
      if (visible) m[def.module] = (m[def.module] ?? 0) + 1;
    }
    return m;
  }, [visibility]);

  const totalOn = Object.values(onCountByModule).reduce((s, n) => s + (n ?? 0), 0);
  const failedCount = Object.values(failed).filter(Boolean).length;

  if (collapsed) {
    return (
      <button
        type="button"
        className="layer-panel__collapsed-pill"
        onClick={() => setCollapsed(false)}
        aria-label={`Open layer panel — ${totalOn} layers visible`}
      >
        <Layers size={18} aria-hidden="true" />
        <span className="layer-panel__collapsed-label">Layers</span>
        {totalOn > 0 && <span className="layer-panel__collapsed-badge">{totalOn}</span>}
      </button>
    );
  }

  return (
    <div className="layer-panel__shell">
      <CalcitePanel className="layer-panel" heading="Layers" description="Turn layers off & on">
        {/* Custom close — a yellow-circle × matching every other close affordance
            (the shared .fwp-icon-close). Calcite's built-in `closable` action
            lives in shadow DOM with no exposed part, so it can't be restyled;
            we slot our own into the header instead. The panel is non-modal, so
            no focus-trap/Esc behavior is lost. */}
        <button
          slot="header-actions-end"
          type="button"
          className="fwp-icon-close layer-panel__close"
          aria-label="Close layer panel"
          onClick={() => setCollapsed(true)}
        >
          <X size={18} aria-hidden />
        </button>
        {/* Always-present polite live region so a layer that fails to load
            *after* the panel is already open is announced (WCAG 4.1.3) — not
            just surfaced visually + in each row's aria-label. */}
        <div aria-live="polite">
          {failedCount > 0 && (
            <CalciteNotice
              open
              kind="warning"
              icon="exclamation-mark-triangle"
              scale="m"
              className="layer-panel__notice"
            >
              <div slot="title">
                {failedCount} {failedCount === 1 ? "layer" : "layers"} couldn&rsquo;t load
              </div>
              <div slot="message">
                Check connectivity — Engage MT will keep retrying. Reload the page if it details.
              </div>
            </CalciteNotice>
          )}
        </div>
        {MODULE_ORDER.flatMap((module) => {
          const defs = grouped.get(module);
          if (!defs || defs.length === 0) return [];
          return [[module, defs] as const];
        }).map(([module, defs]) => {
          const headingId = `layer-panel-group-${module}`;
          const folded = Boolean(foldedGroups[module]);
          const onCount = onCountByModule[module] ?? 0;
          return (
            <div
              key={module}
              className="layer-panel__group"
              role="group"
              aria-labelledby={headingId}
              data-module={module}
            >
              <button
                type="button"
                id={headingId}
                className="layer-panel__group-heading layer-panel__group-toggle"
                aria-expanded={!folded}
                onClick={() => setFoldedGroups((prev) => ({ ...prev, [module]: !prev[module] }))}
              >
                {folded ? (
                  <ChevronRight size={14} aria-hidden="true" />
                ) : (
                  <ChevronDown size={14} aria-hidden="true" />
                )}
                <span>{MODULE_LABEL[module]}</span>
                <span className="layer-panel__group-count">
                  {onCount > 0 ? `${onCount} on` : `${defs.length}`}
                </span>
              </button>
              {!folded && (
                <ul className="layer-panel__list" aria-label={`${MODULE_LABEL[module]} layers`}>
                  {/* Partition the module's layers into top-level
                    rows + subgroup buckets. Each subgroup renders a
                    collapsible header (chevron + N on / N total) and
                    indents its children. Fold key namespaces the module
                    so two modules can carry the same subgroup name
                    without colliding. */}
                  {(() => {
                    const seenSubgroup = new Set<string>();
                    return defs.flatMap((def) => {
                      if (!def.subgroup) {
                        // Composite rows derive their visible
                        // + failed state from their children.
                        const isComposite = !!def.composite;
                        const compVisible = isComposite
                          ? Boolean(compositeVisible[def.id])
                          : Boolean(visibility[def.id]);
                        const compFailed = isComposite
                          ? def.composite!.some((c) => failed[c])
                          : Boolean(failed[def.id]);
                        return [
                          <LayerRow
                            key={def.id}
                            def={def}
                            visible={compVisible}
                            failed={compFailed}
                            toggle={toggle}
                          />,
                        ];
                      }
                      if (seenSubgroup.has(def.subgroup)) return [];
                      seenSubgroup.add(def.subgroup);
                      const children = defs
                        .filter((d) => d.subgroup === def.subgroup)
                        .sort(
                          (a, b) =>
                            (a.groupOrder ?? Number.MAX_SAFE_INTEGER) -
                            (b.groupOrder ?? Number.MAX_SAFE_INTEGER),
                        );
                      const subFoldKey = `${module}/${def.subgroup}`;
                      const subFolded = Boolean(foldedGroups[subFoldKey]);
                      const subOn = children.filter((c) => visibility[c.id]).length;
                      const subId = `layer-panel-subgroup-${subFoldKey}`;
                      return [
                        <li key={`sg-${def.subgroup}`} className="layer-panel__subgroup">
                          <button
                            type="button"
                            id={subId}
                            className="layer-panel__subgroup-toggle"
                            aria-expanded={!subFolded}
                            onClick={() =>
                              setFoldedGroups((prev) => ({
                                ...prev,
                                [subFoldKey]: !prev[subFoldKey],
                              }))
                            }
                          >
                            {subFolded ? (
                              <ChevronRight size={13} aria-hidden="true" />
                            ) : (
                              <ChevronDown size={13} aria-hidden="true" />
                            )}
                            <span className="layer-panel__subgroup-name">{def.subgroup}</span>
                            <span className="layer-panel__subgroup-count">
                              {subOn > 0
                                ? `${subOn} of ${children.length} on`
                                : `${children.length}`}
                            </span>
                          </button>
                          {!subFolded && (
                            <ul className="layer-panel__subgroup-list" aria-labelledby={subId}>
                              {children.map((child) => (
                                <LayerRow
                                  key={child.id}
                                  def={child}
                                  visible={Boolean(visibility[child.id])}
                                  failed={Boolean(failed[child.id])}
                                  toggle={toggle}
                                />
                              ))}
                            </ul>
                          )}
                        </li>,
                      ];
                    });
                  })()}
                </ul>
              )}
            </div>
          );
        })}
      </CalcitePanel>
    </div>
  );
};
