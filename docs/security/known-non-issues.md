# Security — known non-issues & standing decisions

Durable reference so we don't re-chase settled ground. The app's security posture is
strong (parity-locked production headers, `check:csp-allowlist` + `check:security-headers`
gates, in-memory/keychain tokens, zero telemetry, stripped prod sourcemaps, gitignored
secrets). The individual hardening fixes that got it there shipped and are guarded by
gates. This file keeps only the parts a future reviewer needs: findings that look like
bugs but aren't, one deliberate header choice,
and the security items that can only close outside the repo.

## Findings verified FALSE (don't re-chase)

- **XXE in GPX/KML import** — `gpxImport.ts` / `kmlImport.ts` use the browser-native
  `DOMParser.parseFromString(xml, "application/xml")`, which resolves no external
  entities or DTDs. No XXE surface. (Imports are additionally size-bounded by
  `MAX_IMPORT_CHARS` in `sharedFileImport.ts` before parse.)
- **"Exposed Android keystore"** — `keystore.properties` and
  `mobile/android/app/*.keystore` are correctly gitignored (only `.example` is
  tracked). Plaintext local signing props is the standard Capacitor/Gradle pattern,
  not a store blocker.

## Deliberate header choice: COEP is descoped (not shipped)

`Cross-Origin-Embedder-Policy` is intentionally **not sent** (COOP `same-origin` is).
Nessus/CIS L1 do not check COEP, and shipping `credentialless` would flip the page to
`crossOriginIsolated` — a behavior change requiring a full re-verification of every
cross-origin ArcGIS no-cors subresource (theme stylesheet, SDK assets, basemap tiles
that send no `Cross-Origin-Resource-Policy`) for zero scan benefit. The parity gate's
misspelled `Cross-Origin-Embedding-Policy` key (which matched nothing) was corrected
to the real `Cross-Origin-Embedder-Policy` on 2026-07-14 so a future real COEP would
be parity-enforced.

## Security items that can only close outside the repo

These need FWP-side action and can't be fixed in-repo — track them as part of the
app-store release:

- Host `assetlinks.json` (Android) + `apple-app-site-association` (iOS) on
  **fwp.mt.gov** for App Links autoVerify — needs the final release-cert SHA-256.
- App Store Connect / Play "App Privacy" forms → **Data Not Collected** (must match
  the iOS privacy manifest, which `check:ios-privacy-manifest` guards).
- The enforcing CSP assumes the deployed allowlist is complete — after any deploy
  that changes upstream hosts, load every route and confirm nothing is blocked in
  the browser console, then trim any host that no longer appears.
