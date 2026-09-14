# Mobile Accessibility — Engage MT Rules

Mobile-specific addendum to [docs/rules/accessibility.md](accessibility.md).
The mobile app is the web build wrapped in Capacitor (see
[docs/rules/mobile.md](mobile.md)), so **everything in the web a11y rule
applies unchanged** — VoiceOver (iOS) and TalkBack (Android) read the WKWebView /
System WebView as a web document, driven by the same roles / `aria-*` / live
regions. This file covers only what's *different* on device.

Standards: Section 508 + WCAG 2.1 AA. Scripted VoiceOver (iOS) and TalkBack
(Android) walkthroughs are run as part of release QA.

## The mobile-only surfaces to get right

1. **Bottom tab bar** — semantic `<nav aria-label="Modules">` + `NavLink`
   (`BottomTabBar.tsx`). It's a navigation landmark, not an ARIA `tablist` — do
   not add `role="tab"`; the intent is "jump to module," and Tab/flick order is
   the correct interaction, not arrow-key spatial nav.
2. **Route-change focus** — (`App.tsx:449`) moves focus to `<main tabIndex={-1}>`
   on every `location.pathname` change. This is what makes deep links and tab
   switches land the screen reader on the target page. **Any new navigation must
   go through React Router** so this fires — don't hand-roll `window.location`
   changes that bypass it.
3. **Deep links / resume** (`services/mobile/appLifecycle.ts`):
   - A deep link that changes the route → fires → SR lands on `<main>`. Good.
   - Resume-from-background does **not** navigate (it re-checks connectivity)
     → focus stays put. Correct — don't add a focus jump on resume.
4. **Native back** — `resolveBackAction` pops router history and exits only at a
   `ROOT_PATHS` tab root. Each pop changes the route → SR announces the
   destination heading. Keep back navigation router-driven.
5. **Status bar / splash** (`services/mobile/nativeChrome.ts`) — the FWP-blue bar
   with light glyphs is inert chrome; it must not overlap the header hit area and
   is not read as content. It's deliberately uniform (not per-module tinted).

## Touch, motion, type — already tokenized (don't regress)

- **Touch targets:** `var(--fwp-touch-target)` (44px, 56px in field mode). Never
  hardcode `44px`; the token is what scales for gloved field use.
- **Safe-area:** `viewport-fit=cover` + `env(safe-area-inset-*)`. Preserve on any
  new fixed/edge-anchored element (tab bar, sheets, banners).
- **Reduced motion:** OS "Reduce Motion" maps to `prefers-reduced-motion` in the
  WebView — all animation already gates on it. Verify new animations do too.
- **Dynamic Type / OS text scaling:** the type ramp is rem-based and the viewport
  sets **no** `maximum-scale` / `user-scalable=no` — so OS text-size and pinch-zoom
  both work. Never add those viewport restrictions (WCAG 1.4.4 fail). Validate new
  dense layouts at 200% OS text size (they must reflow, not clip).

## VoiceOver vs TalkBack differences worth knowing

- **VoiceOver (iOS):** rotor (headings/links/landmarks), single-finger flick,
  two-finger scrub = back. Rotor and scrub need a **physical device** to verify —
  the simulator can't reproduce them.
- **TalkBack (Android):** local context menu (swipe up-then-right) for
  headings/controls jump; hardware/gesture Back is a distinct control we own via
  `appLifecycle.ts`. Gesture depth is best verified on a **physical device**.
- Both read the same web semantics, so if a surface is right in the desktop
  VoiceOver script it's almost certainly right on device — the mobile scripts
  exist to catch the *native-shell* seams (tab bar, back, deep link, resume),
  not to re-test web markup.

## What genuinely needs a physical device (document as a known limitation)

Simulator/emulator screen readers cannot faithfully reproduce: rotor flicks
(iOS), the two-finger scrub, TalkBack multi-finger/angle gestures, Braille
displays, and haptics. Author the scripts, run what the sim/emulator supports,
and record the device-only rows as deferred in the validation worksheet — do not
claim conformance on an unrun row.
