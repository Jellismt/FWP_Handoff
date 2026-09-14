/**
 * @file AccessibilityStatementPage.tsx
 * @module engage-mt/shared
 * @description Public-facing accessibility statement. The user-facing
 *              companion to the VPAT/ACR (docs/accessibility/) and the
 *              `docs/rules/accessibility.md` charter — plain-English prose a
 *              Montana resident can read in two minutes: our commitment, the
 *              standard we build to, the one known limitation (the map canvas),
 *              and how to report a barrier. Anchored at `/accessibility`, linked
 *              from the Info dialog's Resources list.
 *
 *              Accessibility: reuses the single-column policy-page layout
 *              (`PrivacyPage.css` — the same generic prose styling), one `<h1>`,
 *              h2-per-section heading nesting, stable anchor ids.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-01
 * @updated 2026-07-16
 * @version 1.1.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { useEffect } from "react";
import { Accessibility, Keyboard, Map as MapIcon, Mail } from "lucide-react";
import { TipBlock } from "@/components/map/featureCards/core/cardPrimitives";
// Reuse the generic single-column policy-page prose styling.
import { ToolHero } from "@/components/shared/ToolHero";
import "./PrivacyPage.css";

const TITLE = "Accessibility · Engage MT";

export const AccessibilityStatementPage = (): JSX.Element => {
  useEffect(() => {
    const prior = document.title;
    document.title = TITLE;
    return () => {
      document.title = prior;
    };
  }, []);

  return (
    <section
      className="privacy-page fwp-mobile-safe-bottom"
      data-module="shared"
      aria-labelledby="a11y-page-heading"
    >
      <ToolHero
        module="shared"
        title="Accessibility"
        titleId="a11y-page-heading"
        lede={
          <>
            Engage MT is built by Montana Fish, Wildlife &amp; Parks as a public service — for every
            Montanan and visitor, including people who use screen readers, keyboards, switch
            devices, screen magnification, or voice control. We hold this app to the same standard
            the State holds all of its digital services.
          </>
        }
      />

      <div className="privacy-page__section">
        <h2 className="privacy-page__section-title" id="a11y-standard">
          <Accessibility className="privacy-page__section-icon" aria-hidden />
          The standard we build to
        </h2>
        <p>
          Engage MT targets <strong>Section 508</strong> and <strong>WCAG 2.1 Level AA</strong> —
          the U.S. federal accessibility requirements for public digital services. That means
          readable contrast in light and dark mode, full keyboard operation, screen-reader labels on
          every control, large touch targets, respect for your device&rsquo;s reduced-motion and
          text-size settings, and no barriers that rely on color or hearing alone.
        </p>
      </div>

      <div className="privacy-page__section">
        <h2 className="privacy-page__section-title" id="a11y-keyboard">
          <Keyboard className="privacy-page__section-icon" aria-hidden />
          Keyboard and screen reader
        </h2>
        <p>
          Every menu, panel, and form works with the keyboard alone, with a visible focus outline so
          you always know where you are. Automated accessibility checks (axe) and
          keyboard-navigation tests ship with the app so the checks are repeatable each release.
        </p>
      </div>

      <div className="privacy-page__section">
        <h2 className="privacy-page__section-title" id="a11y-map">
          <MapIcon className="privacy-page__section-icon" aria-hidden />
          One honest limitation: the map
        </h2>
        <p>
          The interactive map is drawn on a graphics canvas that isn&rsquo;t fully operable by
          keyboard or screen reader on its own — a limitation of the mapping technology, not a
          shortcut on our part. So everything you can do by tapping the map, you can also do without
          it: browse and toggle every layer from the Layers panel, enter exact coordinates from the
          tools, and read every feature&rsquo;s details in a fully accessible panel.
        </p>
        <TipBlock intent="info" heading="We keep working on this">
          As the mapping tools improve their keyboard and screen-reader support, so will we. If the
          map blocks you from something, tell us and we&rsquo;ll make sure there&rsquo;s another
          way.
        </TipBlock>
      </div>

      <div className="privacy-page__section">
        <h2 className="privacy-page__section-title" id="a11y-contact">
          <Mail className="privacy-page__section-icon" aria-hidden />
          Found a barrier? Tell us
        </h2>
        <p>
          If any part of Engage MT is hard to use with your assistive technology, we want to fix it.
          Contact Montana Fish, Wildlife &amp; Parks and describe what you were trying to do, the
          page or feature, and the device or assistive tool you were using.
        </p>
        <p className="privacy-page__address">Montana Fish, Wildlife &amp; Parks</p>
        <p className="privacy-page__footnote">
          A detailed conformance report (VPAT / ACR) is maintained with the project documentation.
        </p>
      </div>
    </section>
  );
};
