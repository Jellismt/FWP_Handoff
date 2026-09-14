/**
 * @file InfoButton.tsx
 * @module engage-mt/shared
 * @description Circular "i" icon button in the app header, sitting alongside the
 *              account + theme-toggle circles. Opens InfoModal — the centered
 *              "About Engage MT" surface that replaced the page footer
 *: version + build, Resources links, Contact links,
 *              and the legal line now live in a modal reachable from every
 *              route instead of a footer hidden on the map route.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-29
 * @updated 2026-07-03
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { useState } from "react";
import { Info } from "lucide-react";
import { InfoModal } from "@/components/shared/overlays/InfoModal";

export const InfoButton = (): JSX.Element => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="fwp-pill-button fwp-pill-button--on-brand app-header__info"
        onClick={() => setOpen(true)}
        aria-label="About Engage MT"
        title="About Engage MT"
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <Info size={16} strokeWidth={2} aria-hidden />
      </button>
      <InfoModal open={open} onClose={() => setOpen(false)} />
    </>
  );
};
