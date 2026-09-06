/**
 * @file PrivacyPage.tsx
 * @module engage-mt/shared
 * @description Public-facing privacy policy. Distillation of
 *              `docs/rules/privacy.md` (the in-repo rule that already
 *              governs what code may and may not do) into FWP-voice
 *              prose a typical Montana resident can read in three
 *              minutes. Anchored under `/privacy` and linked from the
 *              info modal + any "Location stays on device"
 *              tooltip in the app.
 *
 *              Layout: a single column, skim-friendly heading
 *              hierarchy (h1 → h2 per section, h3 for sub-items),
 *              short paragraphs, plain English. No marketing copy.
 *
 *              Accessibility: a single `<h1>`, proper heading nesting,
 *              all section headings carry stable anchor ids so the
 *              Footer can deep-link.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-02
 * @updated 2026-07-03
 * @version 1.1.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { useEffect } from "react";
import { Lock, MapPin, Shield } from "lucide-react";
import { TipBlock } from "@/components/map/featureCards/core/cardPrimitives";
import { ToolHero } from "@/components/shared/ToolHero";
import "./PrivacyPage.css";

const TITLE = "Privacy · Engage MT";

export const PrivacyPage = (): JSX.Element => {
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
      aria-labelledby="privacy-page-heading"
    >
      <ToolHero
        module="shared"
        title="Your data stays on your device"
        titleId="privacy-page-heading"
        lede={
          <>
            Engage MT is built by Montana Fish, Wildlife &amp; Parks as a public service. It does
            not collect your location, track your behavior, or send analytics anywhere. This page
            explains what that means in plain terms — and what changes when you opt into a feature
            that requires your account.
          </>
        }
      />

      <TipBlock heading="The short version" intent="info">
        Your GPS stays on your phone. We don&rsquo;t run analytics, trackers, or third-party
        scripts. We don&rsquo;t use cookies that survive a session. Map tiles, regulation data, and
        species lists come from public agencies. The app never submits anything on your behalf —
        reporting a violation happens by phone, using the warden contacts in TipMont.
      </TipBlock>

      <section className="privacy-page__section" aria-labelledby="privacy-on-device-heading">
        <h2 id="privacy-on-device-heading" className="privacy-page__section-title">
          <span className="privacy-page__section-icon" aria-hidden>
            <MapPin size={18} strokeWidth={2} />
          </span>
          What stays on your device
        </h2>
        <ul className="privacy-page__list">
          <li>Your current GPS coordinates and any location-watch session.</li>
          <li>
            Waypoints you drop on the map (kill sites, glassing points, camps, hazards, etc.), the
            photos you attach to them, and any GPS track you record with Start &rarr; Stop. All of
            it lives in your browser&rsquo;s local storage (web) or the app&rsquo;s private
            filesystem (mobile). Sharing one is an explicit Share-button tap and the destination app
            (Messages, Mail, AirDrop, etc.) is your choice.
          </li>
          <li>Photo EXIF data. We strip it before any photo leaves the device.</li>
          <li>
            Your map view — what layers you toggled, what waterbody you were looking at, where you
            last centered the map.
          </li>
          <li>Theme preference (light / dark / system) and the list of layers you enabled.</li>
        </ul>
      </section>

      <section className="privacy-page__section" aria-labelledby="privacy-no-tracking-heading">
        <h2 id="privacy-no-tracking-heading" className="privacy-page__section-title">
          <span className="privacy-page__section-icon" aria-hidden>
            <Shield size={18} strokeWidth={2} />
          </span>
          What we do not do
        </h2>
        <ul className="privacy-page__list">
          <li>No Google Analytics, no Plausible, no Sentry, no Mixpanel.</li>
          <li>
            No third-party fonts. We use a system font stack so nothing loads from a font CDN.
          </li>
          <li>No social-media embed pixels, no advertising trackers.</li>
          <li>
            No tracking cookies. Settings live in <code>localStorage</code>
            (web) or <code>@capacitor/preferences</code> (mobile), which only this app reads.
          </li>
          <li>
            No behavioral profile of you. We do not record which species you look up, which
            districts you visit, or how often you open the app.
          </li>
        </ul>
      </section>

      <section className="privacy-page__section" aria-labelledby="privacy-account-heading">
        <h2 id="privacy-account-heading" className="privacy-page__section-title">
          <span className="privacy-page__section-icon" aria-hidden>
            <Lock size={18} strokeWidth={2} />
          </span>
          When you sign in to MyFWP
        </h2>
        <p>
          Signing in is optional and only required for the wallet — your licenses, tags, and
          permits.
        </p>
        <ul className="privacy-page__list">
          <li>
            Your identity is your MyFWP identity — Engage MT does not create a separate account.
          </li>
          <li>
            Your license list is cached encrypted-at-rest on the device. Signing out clears the
            cache immediately.
          </li>
          <li>
            Logging in does <strong>not</strong> turn on location tracking, cross-trip aggregation,
            or any cross-user data. The wallet is purely a personal license display.
          </li>
        </ul>
      </section>

      <section className="privacy-page__section" aria-labelledby="privacy-offline-heading">
        <h2 id="privacy-offline-heading" className="privacy-page__section-title">
          <span className="privacy-page__section-icon" aria-hidden>
            <MapPin size={18} strokeWidth={2} />
          </span>
          Offline maps
        </h2>
        <p>
          When you download an offline area for the mobile app, the tiles are stored on the device
          in your app&rsquo;s sandbox. The bounding box you selected, the basemap you picked, and
          the tiles themselves never leave your phone. The tile server sees a tile request, not a
          track. Engage MT caps total offline tile storage at 2 GB.
        </p>
      </section>
    </section>
  );
};
