/**
 * @file AppHeader.tsx
 * @module engage-mt/shared
 * @description Top app header: FWP wordmark, app title, the
 *              avatar (opens a small popover with the inert "Log in to
 *              My FWP" seam), and the theme toggle. Renders above the
 *              responsive shell on every route. Carries the "TipMont"
 *              action pill.
 * @author Jamie Ellis / Engage MT
 * @created 2026-05-29
 * @updated 2026-07-15
 * @version 2.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Megaphone, User } from "lucide-react";
import { ThemeToggle } from "@/components/shared/forms/ThemeToggle";
import { InfoButton } from "@/components/shared/overlays/InfoButton";
import { PillButton } from "@/components/shared/forms/PillButton";
import { openTipMont } from "@/store/account/tipMontStore";
import { useToast } from "@/hooks/useToast";
import { SIGN_IN_COMING_SOON } from "@/copy/signInComingSoon";
import "./AppHeader.css";

/**
 * The avatar button. Clicking it opens a small popover holding the single
 * "Log in to My FWP" seam button — inert until the real FWP authentication
 * integration lands (STUB-001).
 */
const HeaderSignInAffordance = (): JSX.Element => {
  const [open, setOpen] = useState(false);
  const { show } = useToast();
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent): void => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className="app-header__signin-wrap">
      <button
        type="button"
        className="fwp-pill-button fwp-pill-button--on-brand app-header__signin app-header__signin--icon"
        aria-label="My FWP account"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <User size={18} strokeWidth={2} aria-hidden />
      </button>
      {open && (
        <div className="app-header__signin-popover" role="dialog" aria-label="My FWP">
          <PillButton
            variant="primary"
            onClick={() => {
              setOpen(false);
              show(SIGN_IN_COMING_SOON);
            }}
          >
            Log in to My FWP
          </PillButton>
        </div>
      )}
    </div>
  );
};

export const AppHeader = (): JSX.Element => (
  <header className="app-header">
    <Link to="/" className="app-header__brand" aria-label="Engage MT — home">
      <span className="app-header__mark" aria-hidden="true">
        ENGAGE
      </span>
      <span className="app-header__wordmark" aria-hidden="true">
        MONTANA
      </span>
    </Link>
    <button
      type="button"
      className="app-header__pill app-header__tipmont"
      onClick={() => openTipMont()}
      aria-label="Report a violation to TipMont"
    >
      <Megaphone size={16} strokeWidth={2.25} aria-hidden />
      <span className="app-header__pill-label">TipMont</span>
    </button>
    <div className="app-header__actions">
      <HeaderSignInAffordance />
      <ThemeToggle />
      <InfoButton />
    </div>
  </header>
);
