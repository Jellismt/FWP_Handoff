/**
 * @file TipMontPortal.tsx
 * @module engage-mt/shared
 * @description The TipMont dialog. Mounted once in App.tsx; subscribes to
 *              tipMontStore. Renders the warden-contacts directory (regional
 *              offices + the 1-800-TIP-MONT hotline) so a violation can be
 *              reported by phone. Opened from the header pill. Calcite
 *              handles focus-trap + Esc; focus-return to the opener is ours
 *              (Calcite's restore lands on the map surface — see focusReturn.ts).
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-30
 * @updated 2026-07-16
 * @version 2.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { lazy, Suspense, useEffect, useRef } from "react";
import { X } from "lucide-react";
import { CalciteDialog } from "@esri/calcite-components-react";
import { useTipMontStore } from "@/store/account/tipMontStore";
import { returnFocusToTrigger } from "@/utils/focusReturn";
import "./TipMontPortal.css";

//: lazy-load the panel body so it splits out of the entry chunk.
const WardenContactsPanel = lazy(() =>
  import("./WardenContactsPanel").then((m) => ({ default: m.WardenContactsPanel })),
);

export const TipMontPortal = (): JSX.Element => {
  const open = useTipMontStore((s) => s.open);
  const close = useTipMontStore((s) => s.close);

  // On the open→false transition, return focus to the pill that opened us.
  // Calcite's own restore lands on the ArcGIS map surface (it grabs focus as the
  // overlay tears down), so we re-assert the remembered trigger a frame later.
  const wasOpen = useRef(false);
  useEffect(() => {
    if (wasOpen.current && !open) returnFocusToTrigger();
    wasOpen.current = open;
  }, [open]);

  return (
    <CalciteDialog
      open={open}
      modal
      heading="TipMont"
      description="Find a warden — report a wildlife or recreation violation by phone."
      kind="brand"
      scale="m"
      widthScale="m"
      closeDisabled
      onCalciteDialogClose={close}
      className="tipmont-dialog"
    >
      {/* closeDisabled hides Calcite's built-in shadow-DOM close action (which
          can't be restyled) but keeps its modal focus-trap + Esc + focus-return
          (escapeDisabled stays off). We slot our own yellow-circle close in its
          place — the shared .fwp-icon-close. */}
      <button
        slot="header-actions-end"
        type="button"
        className="fwp-icon-close"
        aria-label="Close TipMont"
        onClick={close}
      >
        <X size={18} aria-hidden />
      </button>
      <div className="tipmont-dialog__body" data-module="manage">
        {open && (
          <Suspense fallback={null}>
            <WardenContactsPanel />
          </Suspense>
        )}
      </div>
    </CalciteDialog>
  );
};
