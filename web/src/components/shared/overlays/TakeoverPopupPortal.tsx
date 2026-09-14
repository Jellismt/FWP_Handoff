/**
 * @file TakeoverPopupPortal.tsx
 * @module engage-mt/shared
 * @description Full-viewport feature popup. Mounted once in App.tsx; subscribes
 *              to takeoverPopupStore. Renders a CalciteDialog containing the
 *              same FeatureCard chrome used in the right-rail TapQueryPanel,
 *              but at "takeover" presentation density. Calcite handles focus
 *              trap + Esc dismiss + ARIA per accessibility rules.
 *
 * of the popup-framework plan.
 * @author Jamie Ellis / Engage MT
 * @created 2026-05-29
 * @updated 2026-07-16
 * @version 2.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { CalciteDialog } from "@esri/calcite-components-react";
import { useTakeoverPopupStore } from "@/store/map/takeoverPopupStore";
import { FeatureCard } from "@/components/map/featureCards";
import { returnFocusToTrigger } from "@/utils/focusReturn";
import type { EngageMtModule } from "@/types/layers";
import "./TakeoverPopupPortal.css";

const VALID_MODULES: EngageMtModule[] = ["hunt", "fish", "explore", "access", "manage", "shared"];

const asModule = (raw: string | null): EngageMtModule => {
  if (raw && (VALID_MODULES as string[]).includes(raw)) return raw as EngageMtModule;
  return "shared";
};

export const TakeoverPopupPortal = (): JSX.Element | null => {
  const open = useTakeoverPopupStore((s) => s.open);
  const layerId = useTakeoverPopupStore((s) => s.layerId);
  const layerTitle = useTakeoverPopupStore((s) => s.layerTitle);
  const module = useTakeoverPopupStore((s) => s.module);
  const attrs = useTakeoverPopupStore((s) => s.attrs);
  const tapPoint = useTakeoverPopupStore((s) => s.tapPoint);
  const close = useTakeoverPopupStore((s) => s.close);

  // On the open→false transition, return keyboard focus to the opener (e.g. a
  // search-result button). Calcite's own restore lands on the ArcGIS map surface
  // (it grabs focus as the overlay tears down), so we re-assert a frame later.
  // Must run before the early return below to respect the rules of hooks.
  const wasOpen = useRef(false);
  useEffect(() => {
    if (wasOpen.current && !open) returnFocusToTrigger();
    wasOpen.current = open;
  }, [open]);

  // Keep the content guards but stop gating mount on `open`.
  // CalciteDialog now sees a real `true → false` transition on its
  // `open` prop and runs its built-in exit animation; content stays
  // mounted through the fade. The store's close() leaves layerId/attrs
  // populated, and they're overwritten on the next openFeature() call.
  if (!layerId || !attrs || !layerTitle) return null;

  const owningModule = asModule(module);

  return (
    <CalciteDialog
      open={open}
      modal
      heading={layerTitle}
      kind="brand"
      scale="l"
      widthScale="l"
      closeDisabled
      onCalciteDialogClose={close}
      className="takeover-popup"
    >
      {/* Custom yellow-circle close (shared .fwp-icon-close). closeDisabled hides
          Calcite's unstyleable built-in close action but keeps its modal
          focus-trap + Esc + focus-return. */}
      <button
        slot="header-actions-end"
        type="button"
        className="fwp-icon-close"
        aria-label={`Close ${layerTitle}`}
        onClick={close}
      >
        <X size={18} aria-hidden />
      </button>
      <div className="takeover-popup__body">
        <FeatureCard
          layerId={layerId}
          layerTitle={layerTitle}
          module={owningModule}
          attrs={attrs}
          presentationOverride="takeover"
          tapPoint={tapPoint ?? undefined}
        />
      </div>
    </CalciteDialog>
  );
};
