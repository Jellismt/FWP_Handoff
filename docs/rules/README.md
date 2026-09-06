# Rules

Per-domain engineering conventions — one file per area. These are the standing
rules a contributor is expected to internalize before touching that surface;
most are also enforced at PR time by `npm run verify` gates (lint, header,
coverage, parity, and convention checks). Start with the area you're editing.

| File | What it covers |
|---|---|
| [accessibility.md](accessibility.md) | 508 / WCAG 2.1 AA — per-component checklist, focus rings, modal focus-return, testing layers |
| [mobile-accessibility.md](mobile-accessibility.md) | VoiceOver/TalkBack, tab bar, deep-link/resume focus, hardware back, dynamic type |
| [arcgis.md](arcgis.md) | ArcGIS Maps SDK 5.x — layer registry, tap-to-query, z-order, symbology, Montana scoping |
| [calcite.md](calcite.md) | Calcite Design System — single registration point, when to reach for Calcite |
| [feature-cards.md](feature-cards.md) | Feature-card / popup registry — primitive-first authoring, renderer conformance |
| [fwp-brand.md](fwp-brand.md) | FWP brand system — the two-color inverting theme, tokens, map symbology accents |
| [design-polish.md](design-polish.md) | UI standing rules — imports, state primitives, buttons, close buttons, token discipline |
| [responsive-layouts.md](responsive-layouts.md) | Breakpoints, safe-area handling, responsive patterns |
| [ia.md](ia.md) | Information architecture — module map, tab structure, where a feature belongs |
| [data-layer.md](data-layer.md) | Data-layer patterns — datasets, loaders, the manifest |
| [data-freshness.md](data-freshness.md) | Dataset freshness contract (`effectiveDate`/`source`) + the freshness gate |
| [data-stubs.md](data-stubs.md) | Stubbed-FWP-endpoint convention (STUB-NNN contracts) |
| [notifications.md](notifications.md) | Notice & modal patterns (advisory banner, dialogs) |
| [privacy.md](privacy.md) | Privacy mission rule — on-device location, no third-party transmission |
| [mobile.md](mobile.md) | Capacitor — plugin policy, native chrome/splash, build pipeline, platform guards |
| [testing.md](testing.md) | Test conventions — colocated tests, coverage floors, axe layers |
| [file-headers.md](file-headers.md) | The `@file`/`@module`/`@description` header convention (guidance, not gated) |

See also [../../CONTRIBUTING.md](../../CONTRIBUTING.md) for the top-level
conventions summary and the `npm run verify` gate.
