# Privacy — Engage MT Rules

> Local-first. On-device-only. No telemetry. This is a mission rule, not a checklist.

The proposal HTML calls out FWP's commitment to local-first privacy as a deliberate differentiator from commercial outdoor apps that sync user location and behavior to vendor servers. Engage MT does not do that. Ever.

## Hard rules

1. **User location stays on device.** GPS coordinates, tracks, waypoints, photo EXIF, and tap coordinates never leave the browser / Capacitor sandbox unless the user _explicitly_ shares them (e.g., sharing a waypoint through the OS share sheet — the destination app is the user's choice). The app itself never submits location anywhere.
2. **No analytics, no telemetry, no behavioral tracking.** No Google Analytics, no Plausible, no Sentry, no custom event firehose. Period. Diagnostic logs live in `@capacitor/preferences` / `localStorage` on the device and clear with the browser's site data.
3. **No third-party trackers.** No fonts loaded from Google Fonts or any third-party CDN — the UI runs on the system font stack, and the display serif (Fraunces,) is **self-hosted** from our own origin in `web/public/fonts/` so no font request ever leaves the app's domain (see [docs/rules/fwp-brand.md](fwp-brand.md)). No CDN-loaded analytics. No social-media embed pixels.
4. **No cookies that survive a session.** Theme preference, layer state, etc. live in `localStorage` (web) / `@capacitor/preferences` (mobile). No tracking cookies.
5. **Auth tokens are scoped, short-lived, and clearly stubbed during development.** MyFWP / XMT tokens are stored in memory + secure storage; not in `localStorage`. Stub tokens are unmistakable.
6. **External services receive minimum necessary data.** USGS, NOAA, DNRC, and the other public agency services are called with anonymous public requests that never include user location. We don't include `User-Agent` strings that identify the user; we don't append session IDs.

## What this means at code-review time

Every new feature must be reviewed against this rule. If the feature:

- Reads `navigator.geolocation.getCurrentPosition` → confirm coordinates stay in the React tree; never sent to a network endpoint without explicit user action.
- Posts to an external endpoint → confirm the payload contains _no_ coordinates, _no_ device ID, _no_ persistent user identifier that the recipient could use to track behavior over time.
- Sets a `localStorage` / `cookie` key → confirm it's UI state, not behavioral tracking.
- Adds a new third-party SDK / CDN → reject unless there's an explicit ADR justifying it.

A PR template checkbox: **"☐ I verified no new user-location data leaves the device."**

## What about MyFWP wallet?

When a user logs into MyFWP:

- Their license list is fetched server-side from FWP.
- The list is cached **encrypted-at-rest** in `@capacitor/preferences` (mobile) or `sessionStorage` (web — no persistence across sessions on web for now; may revisit).
- The user's identity is FWP's identity — we don't construct an Engage-MT-specific user model.
- Logging out clears the cache.

The wallet does NOT enable location tracking, behavioral analytics, or any cross-user data. It is purely a personal license display.

## What about TipMont?

TipMont is the **only user-initiated submission** in the app — a report to FWP the user explicitly composes and sends. The rule:

- **Location is sent only as a named region/place description**, not as raw coordinates.
- **Photos are sent on user confirmation only.** EXIF location is stripped client-side before upload (the live-endpoint swap needs an EXIF-strip utility).
- **Anonymous mode is honored.** TipMont allows anonymous reports; we do not silently attach an authenticated session if the user explicitly chose anonymous.

## What about sharing pins with another user?

Pin sharing is **peer-to-peer with no server** — it never routes user content
through FWP or any third party:

- The shared pin is encoded into the **link/file the user explicitly hands to
  someone** via the native share sheet (text, AirDrop, Nearby Share, email). We
  never upload it. There is no share relay, no share backend, no share account.
- **Photo bytes are never shared.** `pinShareCodec.buildShareBundle` strips
  photos and discloses only a count ("N photos not included"); the pixels stay on
  the sender's device.
- **Coordinates are the point of a pin**, so they DO travel inside the
  user-initiated share (a pin without its location is meaningless) — but only into
  the destination the user picks, never to analytics or a tracked endpoint.
- **Receiving** decodes on-device; opening a shared link/file makes no network
  call. An external third-party mapping-app share link is never fetched — we show
  guidance instead (STUB-034).

## What about offline maps?

Offline tile downloads are user-initiated:

- The user selects an area on the map.
- The app downloads the tile package to `@capacitor/filesystem`.
- No record of which area the user selected leaves the device.
- The tile-package server (FWP's published tiles) cannot infer user behavior — it sees a tile package request, not a track.

## What about diagnostics?

OBS-002 (local diagnostics) writes structured logs to `localStorage` / `@capacitor/preferences`. The logs:

- Stay on the user's device.
- Can be exported by the user from Settings → Diagnostics → Export (a JSON download / share-sheet on mobile).
- The user can purge them.
- No automatic upload to FWP. If FWP needs a bug report, the user attaches the export.

## How we tell the user

- **First run** shows a "Your data stays on this device" privacy notice.
- **Settings → Privacy** lists what data lives where, and how to export / purge.
- **Footer** links to the privacy policy doc (POLICY-001, MVP gate).
- **Each location-using feature** has a small "Location stays on device" notice the first time it asks for permission.

## What about anti-abuse / anti-scraping friction?

A few proportionate checks discourage casual `curl`/bot access and wholesale
copying (nginx User-Agent denylist → 403, a `/trap/` honeypot → 444,
robots.txt AI-scraper blocks, and a copyright banner in the bundle). These are
**privacy-clean and must stay that way**:

- **Server-side matching only.** They inspect the request's own `User-Agent` /
  path **at the nginx edge** — they do **not** fingerprint the device,
  probe the browser, run a JS challenge, or set an identifier.
- **Nothing leaves the device and nothing is stored.** No detection result is
  logged to a profile, transmitted to a third party, or persisted across sessions.
  No CAPTCHA / reCAPTCHA / bot-scoring service is contacted (that would also breach
  the CSP and the "no third-party trackers" rule).
- **No client-side origin gate or behavioral scoring.** Deliberately excluded —
  passive friction only.

If a future anti-abuse idea needs client-side fingerprinting, behavioral
telemetry, or an external bot service, it is **out of bounds** under the hard rules
above. Full rationale + the nginx↔serve.json asymmetry: [docs/security/anti-abuse.md](../../docs/security/anti-abuse.md).

## Why this matters

The proposal frames Engage MT as a public-service app that does not extract value from users. Honoring that requires baking these rules in at the architectural level, not as compliance checkboxes. Every shortcut here erodes the trust that makes the "state-built" framing meaningful.
