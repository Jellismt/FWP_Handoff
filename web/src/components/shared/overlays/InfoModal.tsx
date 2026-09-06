/**
 * @file InfoModal.tsx
 * @module engage-mt/shared
 * @description Centered, closeable "About Engage MT" modal. Replaces the page
 *              footer: holds the Engage MT identity + version /
 *              build chips, a Resources link group (privacy, attribution,
 *              accessibility), a Contact link group (report a data issue),
 *              and the legal line. Opened from the "i" circle button in
 *              AppHeader.
 *
 *              Portals to <body> so it escapes the header's backdrop-filter
 *              containing block and centers in the true viewport. Esc closes;
 *              background scroll is locked while open. Per docs/rules/notifications.md (modal usage) and
 *              docs/rules/accessibility.md (focus + Esc).
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-29
 * @updated 2026-07-16
 * @version 1.2.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { X, Info } from "lucide-react";
import { rememberFocusTrigger, returnFocusToTrigger } from "@/utils/focusReturn";
import "./InfoModal.css";

interface Props {
  open: boolean;
  onClose: () => void;
}

// Fixed release identity for the FWP handover.
const VERSION = "1.0";
const RELEASE_DATE = "July 24, 2026";

export const InfoModal = ({ open, onClose }: Props): JSX.Element | null => {
  // Snapshot the "i" trigger on open and hand focus back to it on close. Without
  // this, dismissing via Esc or the backdrop drops keyboard focus to <body>
  // (the focused close button unmounts), stranding keyboard users. WCAG 2.4.3.
  const wasOpen = useRef(false);
  useEffect(() => {
    if (open && !wasOpen.current) rememberFocusTrigger();
    if (!open && wasOpen.current) returnFocusToTrigger();
    wasOpen.current = open;
  }, [open]);

  // Lock background scroll while the modal is open.
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  // Esc closes the About modal.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  // Portal to <body>: the trigger lives in AppHeader, which carries a
  // backdrop-filter (night-glass). A filtered ancestor becomes the containing
  // block for position:fixed descendants, so without the portal this modal
  // would center inside the ~64px header box. Escaping to <body> restores true
  // viewport-centered positioning.
  return createPortal(
    <div className="info-modal" role="dialog" aria-modal="true" aria-labelledby="info-modal-title">
      <div className="info-modal__backdrop" onClick={onClose} aria-hidden="true" />
      <div className="info-modal__panel">
        <header className="info-modal__header">
          <div className="info-modal__title-block">
            <Info size={22} aria-hidden />
            <div>
              <h2 id="info-modal-title" className="info-modal__title">
                Engage MT
              </h2>
              <p className="info-modal__subtitle">
                Montana&rsquo;s official gateway to the outdoors.
              </p>
            </div>
          </div>
          <button type="button" className="fwp-icon-close" aria-label="Close" onClick={onClose}>
            <X size={20} aria-hidden />
          </button>
        </header>

        <div className="info-modal__body">
          <p className="info-modal__lede">
            Montana&rsquo;s outdoors in one free app: the statewide map, fishing access sites,
            hunting districts with live FWP regulations, parks, trails, public-land ownership, and
            live river conditions — built for Montana Fish, Wildlife &amp; Parks.
          </p>
          <p className="info-modal__chips">
            <span className="info-modal__chip">Version {VERSION}</span>
            <span className="info-modal__chip info-modal__chip--muted">{RELEASE_DATE}</span>
          </p>

          <div className="info-modal__cols">
            <nav className="info-modal__col" aria-label="Resources">
              <h3 className="info-modal__col-title">Resources</h3>
              <ul className="info-modal__list">
                <li>
                  <Link to="/privacy" className="info-modal__link" onClick={onClose}>
                    Privacy
                  </Link>
                </li>
                <li>
                  <Link to="/accessibility" className="info-modal__link" onClick={onClose}>
                    Accessibility
                  </Link>
                </li>
                <li>
                  <Link to="/about/attribution" className="info-modal__link" onClick={onClose}>
                    Attribution
                  </Link>
                </li>
              </ul>
            </nav>

            <nav className="info-modal__col" aria-label="Contact">
              <h3 className="info-modal__col-title">Contact</h3>
              <ul className="info-modal__list">
                <li>
                  <a
                    href="mailto:webmaster@mt.gov?subject=Engage%20MT%20feedback"
                    className="info-modal__link"
                  >
                    Report a data issue
                  </a>
                </li>
              </ul>
            </nav>
          </div>

          <p className="info-modal__legal">
            Open source under the MIT License. Built in Montana with public-agency data.
          </p>
        </div>
      </div>
    </div>,
    document.body,
  );
};
