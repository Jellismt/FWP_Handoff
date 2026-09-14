# Voluntary Product Accessibility Template (VPAT®) 2.4 — Engage MT

**Accessibility Conformance Report (ACR)** · Revised Section 508 Edition

| Field                         | Value                                                                                                                                                                                                                                                                                                                                                         |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Name of Product / Version** | Engage MT — Web app + Capacitor mobile app (iOS/Android), same web build                                                                                                                                                                                                                                                                                      |
| **Product Description**       | Montana Fish, Wildlife & Parks' public gateway to lands, regulations, licenses, and wildlife data. React 19 + ArcGIS Maps SDK 5 + Calcite 5, wrapped for mobile via Capacitor 8.                                                                                                                                                                              |
| **Report Date**               | 2026-07-01                                                                                                                                                                                                                                                                                                                                                    |
| **Contact**                   | Jamie Ellis / Engage MT · Montana Fish, Wildlife & Parks                                                                                                                                                                                                                                                                                                      |
| **Evaluation Methods Used**   | Static code review; ESLint `eslint-plugin-jsx-a11y` (error-level); axe-core — unit smoke (`src/test/a11y-smoke.test.tsx`) + browser sweep (`tests/e2e/10-axe-module-roots.spec.ts`); dev-time `@axe-core/react`; scripted keyboard, VoiceOver (desktop + iOS), and TalkBack (Android) walkthroughs run as release QA. AA-tuned color tokens in `brand-tokens.css`. Screen-reader walkthrough scripts (VoiceOver on macOS and iOS, TalkBack, NVDA) are in [manual-checks.md](manual-checks.md); a criterion is reported as tested with a screen reader only when a run is recorded there. |

**Applicable Standards/Guidelines**

| Standard                                    | Included |
| ------------------------------------------- | -------- |
| WCAG 2.1 Level A                            | Yes      |
| WCAG 2.1 Level AA                           | Yes      |
| Revised Section 508 (2017) — Ch. 3, 4, 5, 6 | Yes      |

**Conformance terms:** _Supports_ · _Partially Supports_ · _Does Not Support_ ·
_Not Applicable_. This report reflects a completed static + automated review and
scripted manual passes; the full on-device AT verification cadence is run before
each release.

---

## Table 1: Success Criteria, Level A

| Criteria                                     | Conformance        | Remarks and Explanations                                                                                                                                                                                                                                                                |
| -------------------------------------------- | ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1.1.1 Non-text Content                       | Supports           | Icons are `aria-hidden`; icon-only buttons carry `aria-label`; every SVG chart primitive renders `role="img"` + a non-empty `aria-label` (`src/components/shared/charts/*`). Enforced by the unit axe smoke.                                                                            |
| 1.2.1 Audio-only / Video-only (Prerecorded)  | Not Applicable     | No prerecorded audio/video content.                                                                                                                                                                                                                                                     |
| 1.2.2 Captions (Prerecorded)                 | Not Applicable     | No prerecorded multimedia.                                                                                                                                                                                                                                                              |
| 1.2.3 Audio Description or Media Alternative | Not Applicable     | No prerecorded multimedia.                                                                                                                                                                                                                                                              |
| 1.3.1 Info and Relationships                 | Supports           | Semantic HTML landmarks (`header`/`nav`/`main`); definition lists in metric grids; `role="group"` for filter/toggle sets (converted from `<ul>` to avoid list-item orphaning, 2026-07); labeled form fields; tablist/listbox/radiogroup composites carry correct child roles.           |
| 1.3.2 Meaningful Sequence                    | Supports           | DOM order matches visual order; focus order documented in the keyboard walkthrough script.                                                                                                                                                                                              |
| 1.3.3 Sensory Characteristics                | Supports           | Instructions pair position/color with text + icons; no shape/position-only cues.                                                                                                                                                                                                        |
| 1.4.1 Use of Color                           | Supports           | Status/state paired with icon + text (freshness chips, intent callouts, `aria-pressed`). Data-viz color-only signals spot-checked.                                                                                                                                                      |
| 1.4.2 Audio Control                          | Not Applicable     | No auto-playing audio.                                                                                                                                                                                                                                                                  |
| 2.1.1 Keyboard                               | Partially Supports | All chrome, panels, dialogs, forms, search, and the layer panel are fully keyboard-operable. The ArcGIS map **canvas** is a pointer surface (SDK limitation); keyboard/AT users operate the map via the keyboard-navigable Layer Panel, the tool rail, and the Coordinate-Entry dialog. |
| 2.1.2 No Keyboard Trap                       | Supports           | Modal focus traps (`useFocusTrap`) cycle Tab/Shift+Tab and release on Esc/close; background marked `inert`.                                                                                                                                                                             |
| 2.1.4 Character Key Shortcuts                | Not Applicable     | No single-character key shortcuts.                                                                                                                                                                                                                                                      |
| 2.2.1 Timing Adjustable                      | Supports           | No time limits on interactions. Toasts auto-dismiss but their content persists in inline notices/banners.                                                                                                                                                                               |
| 2.2.2 Pause, Stop, Hide                      | Supports           | Live "count-up" / pulse animations gate on `prefers-reduced-motion`; no auto-updating content that can't be paused.                                                                                                                                                                     |
| 2.3.1 Three Flashes                          | Supports           | No flashing content.                                                                                                                                                                                                                                                                    |
| 2.4.1 Bypass Blocks                          | Supports           | "Skip to main content" link + landmark regions (`App.tsx`).                                                                                                                                                                                                                             |
| 2.4.2 Page Titled                            | Supports           | Route titles set per module; each route exposes a page-level heading.                                                                                                                                                                                                                   |
| 2.4.3 Focus Order                            | Supports           | Route change moves focus to `<main>`; dialogs trap focus and restore to trigger; background inert prevents behind-modal wander.                                                                                                                                               |
| 2.4.4 Link Purpose (In Context)              | Supports           | Links carry descriptive text or `aria-label`; icon-only actions labeled.                                                                                                                                                                                                                |
| 2.5.1 Pointer Gestures                       | Supports           | No multipoint/path-based gestures required; map pan/zoom have button equivalents.                                                                                                                                                                                                       |
| 2.5.2 Pointer Cancellation                   | Supports           | Activation on `click`/up-event; no down-event-only actions.                                                                                                                                                                                                                             |
| 2.5.3 Label in Name                          | Supports           | Visible labels match accessible names on controls.                                                                                                                                                                                                                                      |
| 2.5.4 Motion Actuation                       | Supports           | No motion-actuated functionality; location is user-initiated.                                                                                                                                                                                                                           |
| 3.1.1 Language of Page                       | Supports           | `<html lang="en">`.                                                                                                                                                                                                                                                                     |
| 3.2.1 On Focus                               | Supports           | Focus does not trigger unexpected context change.                                                                                                                                                                                                                                       |
| 3.2.2 On Input                               | Supports           | Input changes don't auto-navigate; explicit submit.                                                                                                                                                                                                                                     |
| 3.3.1 Error Identification                   | Supports           | Validated inputs set `aria-invalid` and point at their message with `aria-describedby` (the coordinate-entry dialog is the app's one validated form).                                                                                                                                                                                             |
| 3.3.2 Labels or Instructions                 | Supports           | Every input has an associated `<label>` + help text where needed.                                                                                                                                                                                                                       |
| 4.1.1 Parsing                                | Supports           | React-rendered, valid nesting; unit axe smoke checks duplicate ids / role validity on primitives.                                                                                                                                                                                       |
| 4.1.2 Name, Role, Value                      | Supports           | Native semantics + Calcite; toggles expose `aria-pressed`/`aria-checked`.                                                                                                                                               |

---

## Table 2: Success Criteria, Level AA

| Criteria                                      | Conformance        | Remarks and Explanations                                                                                                                                                                               |
| --------------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1.2.4 Captions (Live)                         | Not Applicable     | No live multimedia.                                                                                                                                                                                    |
| 1.2.5 Audio Description (Prerecorded)         | Not Applicable     | No prerecorded multimedia.                                                                                                                                                                             |
| 1.3.4 Orientation                             | Supports           | Responsive; no orientation lock. Works portrait + landscape.                                                                                                                                           |
| 1.3.5 Identify Input Purpose                  | Supports           | Inputs use appropriate `type`/`name`/`autocomplete` where a purpose exists.                                                                                                                            |
| 1.4.3 Contrast (Minimum)                      | Supports           | AA-tuned tokens in `brand-tokens.css` (e.g. `--fwp-text-secondary` 5:1; tint-text tokens) for light + dark. Two failures found + fixed 2026-07-01. Browser contrast rechecked in the Playwright sweep. |
| 1.4.4 Resize Text                             | Supports           | rem-based type ramp; viewport allows zoom — **no** `user-scalable=no` / `maximum-scale`.                                                                                                               |
| 1.4.5 Images of Text                          | Supports           | Text is real text; no images of text (display serif is a self-hosted webfont).                                                                                                                         |
| 1.4.10 Reflow                                 | Supports           | Responsive layout reflows to 320px CSS width; page-root overflow guard + table-scroll wrappers prevent horizontal scroll.                                                                              |
| 1.4.11 Non-text Contrast                      | Supports           | UI components + focus ring (gold, 2px) meet 3:1; graphical objects tokenized for AA.                                                                                                                   |
| 1.4.12 Text Spacing                           | Supports           | Token-based spacing; no fixed-height text containers that clip on spacing overrides.                                                                                                                   |
| 1.4.13 Content on Hover or Focus              | Supports           | Tooltips/popovers dismissible, hoverable, persistent (Calcite + custom Tooltip with `aria-describedby`).                                                                                               |
| 2.4.5 Multiple Ways                           | Supports           | Module navigation + map + cross-module links provide multiple ways to reach content.                                                                                                   |
| 2.4.6 Headings and Labels                     | Supports           | Descriptive headings + labels; heading hierarchy verified per route (browser axe).                                                                                                                     |
| 2.4.7 Focus Visible                           | Supports           | Global `:focus-visible` 2px gold ring, outset/inset variants documented.                                                                                                                               |
| 3.1.2 Language of Parts                       | Not Applicable     | Content is English throughout.                                                                                                                                                                         |
| 3.2.3 Consistent Navigation                   | Supports           | Tab bar/sidebar + header are consistent across routes.                                                                                                                                                 |
| 3.2.4 Consistent Identification               | Supports           | Icons/labels/components identified consistently (shared primitives).                                                                                                                                   |
| 3.3.3 Error Suggestion                        | Supports           | Validation messages suggest correction; optional form-level error summary for long forms.                                                                                                              |
| 3.3.4 Error Prevention (Legal/Financial/Data) | Partially Supports | The app submits no legal, financial, or personal data: the licence wallet is an inert fixture pending the FWP endpoint. Re-verify when the live endpoint lands (STUB-001).    |
| 4.1.3 Status Messages                         | Supports           | Polite live regions for search results, tap-query body, and (2026-07) layer-load failures; toasts/alerts use appropriate `aria-live`.                                                                  |

---

## Chapter 3: Functional Performance Criteria (§ 302)

| Criteria                                | Conformance        | Remarks                                                                                                                                                               |
| --------------------------------------- | ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 302.1 Without Vision                    | Partially Supports | Full screen-reader support across chrome/panels/forms/search; the map canvas is non-visual-limited (mitigated via Layer Panel + Coordinate-Entry + tap-query dialog). |
| 302.2 With Limited Vision               | Supports           | Zoom to 200%+, AA contrast, reduced-motion, large touch targets, field-mode text elevation.                                                                           |
| 302.3 Without Perception of Color       | Supports           | Color never the sole signal (icons + text).                                                                                                                           |
| 302.4 Without Hearing                   | Supports           | No audio-dependent functionality.                                                                                                                                     |
| 302.5 With Limited Hearing              | Supports           | No audio-dependent functionality.                                                                                                                                     |
| 302.6 Without Speech                    | Supports           | No speech input required.                                                                                                                                             |
| 302.7 With Limited Manipulation         | Supports           | ≥44×44px targets (56px field mode); no path/multipoint gestures required.                                                                                             |
| 302.8 With Limited Reach and Strength   | Supports           | Bottom tab bar reachable; large targets; no force-based interactions.                                                                                                 |
| 302.9 With Limited Language / Cognition | Supports           | Plain-English "FWP voice"; consistent patterns; freshness + status chips; explainer notes.                                                                            |

---

## Chapter 4: Hardware — Not Applicable

Engage MT is software (web + mobile app); it is not ICT hardware.

## Chapter 5: Software

| Criteria                     | Conformance    | Remarks                                                                                                |
| ---------------------------- | -------------- | ------------------------------------------------------------------------------------------------------ |
| 502 Interoperability with AT | Supports       | Standard web semantics; VoiceOver (iOS/macOS) + TalkBack (Android) + NVDA targets; documented scripts. |
| 503 Applications             | Supports       | User preferences (theme, reduced motion, OS text size) respected; focus not disrupted.                 |
| 504 Authoring Tools          | Not Applicable | Not an authoring tool.                                                                                 |

## Chapter 6: Support Documentation and Services

| Criteria                  | Conformance | Remarks                                                                                            |
| ------------------------- | ----------- | -------------------------------------------------------------------------------------------------- |
| 602 Support Documentation | Supports    | This ACR + `docs/rules/accessibility.md` + QA walkthrough scripts document accessibility features. |
| 603 Support Services      | Supports    | An in-app Accessibility Statement (footer) provides a feedback/contact path.                       |

---

## Known limitations (documented, not deferred defects)

1. **ArcGIS map canvas** — pointer-centric per the SDK; keyboard/AT users operate
   the map through the Layer Panel, tool rail, and Coordinate-Entry dialog. Rated
   _Partially Supports_ under 2.1.1 / 302.1 with the mitigation described.
2. **Calcite shadow-DOM internals** — Calcite 5.x ships its own audited a11y; we
   remap tokens and do not audit inside its shadow roots.
3. **Stubbed FWP endpoints** — license-wallet + TipMont submissions are stubbed
   pending FWP access; the accessible submit/confirm patterns exist and are
   re-verified when live endpoints land.

## Evidence & regeneration

- Automated: `npm run verify` (jsx-a11y + unit axe smoke, hard gate) and
  `npm run verify:e2e` (browser axe sweep across module roots).
- Manual: scripted keyboard, VoiceOver (desktop + iOS), and TalkBack (Android)
  walkthroughs, run as part of release QA.
