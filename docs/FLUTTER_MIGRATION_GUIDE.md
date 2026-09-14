# Flutter native migration guide

**What this is.** Engage MT v1.0.0 ships as one TypeScript codebase that runs as
a web application and, through a thin Capacitor wrapper, as an iOS and Android
app. This document describes what it would take to carry that same product
forward as a **single Flutter application** compiled to native iOS and Android,
and what changes about the product when you do.

It is the companion to
[SWIFTKOTLIN_NATIVE_MIGRATION_GUIDE.md](SWIFTKOTLIN_NATIVE_MIGRATION_GUIDE.md),
which covers the same migration written as two separate native applications.
The two documents describe the same destination reached by different routes, and
they deliberately share structure so the sections can be read side by side. Where
the analysis is identical — the seams, the shared map service, the web
application question — this guide says so rather than restating it differently.

It is written for the team that picks this up: a mobile architect sizing the
work, a product owner deciding what an MVP contains, and the FWP GIS and IT
staff who own the data and the systems this app consumes.

**What this is not.** It is not a recommendation for or against Flutter, and it
is not an implementation plan. It is an honest inventory of what exists, what
Flutter's ArcGIS support genuinely covers today, what it does not yet cover, and
which decisions — several of them FWP's rather than any developer's — make the
difference between an expensive migration and an efficient one.

Read [codebase-overview.md](codebase-overview.md) first if you have not; this
guide assumes it.

Last updated: 2026-09-14 · Applies to: v1.0.0

---

## 1. Where the code is today

### 1.1 Five workspaces, three of which are not mobile

| Workspace | What it is | Flutter migration relevance |
|---|---|---|
| `web/` | The product: React 19 + TypeScript + ArcGIS Maps SDK for JavaScript. ~370 files, ~51,300 lines. | **This is what gets rewritten** — once, in Dart, rather than twice. |
| `mobile/` | Capacitor 8 wrapper (24 config/bridge/build files, ~1,050 lines) around `web/dist`. No separate UI. | **Retired.** Its plugin set maps almost one-for-one onto Flutter packages — see §3. |
| `server/` | FWP Regs Manager — Fastify API + PostgreSQL + ETL. ~90 files, ~10,200 lines, 28 SQL migrations. | **Unchanged.** The Flutter client calls the same public read API. |
| `staff/` | Internal regulations authoring console (web SPA). ~47 files, ~6,400 lines. | **Unchanged and stays web.** It is a desktop admin tool; nothing about it wants to be an app. |
| `shared/` | Cross-workspace contracts, including the GIS layer registry. ~715 lines. | **The most valuable artifact in the repo for this migration.** See §2. |

Roughly 77% of the production source is the thing being rewritten; the
regulations backend, the staff console, and the contracts are not.

### 1.2 What is already native

The Capacitor layer is not a shim over a browser — it is a set of real native
capabilities already exercised in production builds, behind capability
predicates so the same bundle also runs on the web:

geolocation · filesystem · camera · share sheet · haptics · network state ·
preferences (native key-value store) · status bar and safe-area chrome ·
splash screen · keep-awake · app lifecycle and deep links.

Every one of these has a mature, widely-used Flutter package equivalent. This is
the part of the migration with the least risk and the most direct translation:
the Capacitor plugin list in `mobile/package.json` reads as a shopping list for
`pubspec.yaml`.

What ports as *specification* rather than code: the behaviors those bridges
implement — foreground-only track recording and its segment-on-resume rule, the
offline tile store on the device filesystem, the field copy of regulations that
survives web-view cache eviction. Those are documented product decisions a
Flutter team should port deliberately, not rediscover.

### 1.3 The test and gate inventory

- ~1,440 unit and component test cases across ~215 files (~24,400 lines).
- 11 Playwright end-to-end specs / 16 tests, each on desktop and phone
  viewports, including an axe accessibility sweep.
- 12 static `check:*` audits in the merge gate: GIS registry drift, Montana
  scoping, Capacitor import guards, iOS privacy manifest, native config
  coherence, plugin parity, CSP and security headers, data freshness, the
  regulations offline floor, container config, doc links, orphan detection.

**None of this ports** — it is TypeScript, Vitest, Playwright, and Node. But the
rebuild is meaningfully cheaper here than on the two-native-apps route, and this
is one of Flutter's strongest practical arguments: `flutter_test` gives unit and
widget tests, and `integration_test` gives on-device end-to-end coverage, in
**one suite that covers both platforms**. The safety net gets rebuilt once, not
twice, and a single `flutter test` run is a plausible successor to
`npm run verify`.

Budget it as a deliverable regardless. The current gate is what lets a junior
developer change this codebase confidently, and nothing inherits that property
automatically.

What *does* port is the intent behind each check. For example,
`check:native-config` fails the build if background location is ever declared
without the foreground service, notification permission, and iOS purpose string
behind it. In Flutter those declarations live in the same `Info.plist` and
`AndroidManifest.xml` the check reads today, so this particular gate is close to
portable as-is.

---

## 2. The seams — what a Flutter team ports against

The single most useful property of this codebase for a rewrite is that the
things a second client needs are already factored out of the UI. Port against
these, not against the React components. **This section is identical in both
migration guides** — the contracts do not care what the client is written in.

| Seam | Where | What it gives a Flutter client |
|---|---|---|
| **Regulations read API** | `server/`, `/api/v2/fwp/*` — see [regs-manager/api.md](regs-manager/api.md) | The whole hunting-regulations domain as a versioned HTTP contract. A Dart client consumes it identically to the web client. Nothing to re-derive. |
| **GIS layer registry** | `shared/src/arcgisLayers.ts`, enforced by `check:gis-registry` | The one place a service URL, layer id, and join field are declared per geography. The regulations database stores **no geometry**; codes join to live ESRI layers. Already the "one registry, many clients" pattern. |
| **Map layer registry** | `web/src/config/layers/*.ts` (47 layers, ~1,700 lines) | Every layer's URL, symbology, scale range, popup fields, and module ownership, as data rather than as code scattered through components. It reads as a specification for the Flutter map. See §4 and §5. |
| **Feature-card registry** | `web/src/components/map/featureCards/` (28 cards + conformance tests) | For each tappable feature type, exactly which fields are shown, in what order, with what units and links. Product design captured as code — and on this route it becomes **28 Flutter widgets, not 56 platform views**. |
| **Stub registry** | `web/src/services/stubs/registry.ts` + [stubs/README.md](stubs/README.md) | Every seam waiting on an FWP system, with the expected endpoint, auth model, and swap procedure. [STUB-001](stubs/STUB-001.md) is MyFWP sign-in and the license wallet. |
| **Reference data manifest** | `web/public/data/data-manifest.json` | The bundled offline dataset set, with hashes and freshness rules. The Flutter app ships the same payloads as bundled assets. |
| **Engineering conventions** | [rules/](rules/README.md) | Per-domain rules for ArcGIS use, accessibility, privacy, data freshness, and mobile. Several are platform-independent product policy, notably [privacy.md](rules/privacy.md) and [data-freshness.md](rules/data-freshness.md). |

A migration that treats these as the source of truth writes one client against
six contracts. A migration that treats the React tree as the source of truth
reads 51,300 lines of TypeScript.

---

## 3. Migration map, layer by layer

One column instead of two — that is the whole argument for this route, and it is
visible in the table.

| Concern | Today | Flutter | Difficulty |
|---|---|---|---|
| UI shell, navigation, three tabs | React Router 7, Calcite components | Flutter widgets + `go_router` or `Navigator 2.0` | Low-medium — drawn once, but Calcite has no Flutter equivalent, so the design system is rebuilt |
| Map rendering and layers | ArcGIS Maps SDK for JavaScript 5.x | ArcGIS Maps SDK for Flutter (`arcgis_maps`) | **High — the bulk of the work.** See §4 |
| Tap-to-query feature cards | 28 registry-driven card renderers | 28 Flutter widgets behind one registry | Medium — the *content* is already specified, and this is where the single-codebase saving is largest |
| Regulations (live / stored / bundled) | Three-tier client with freshness descriptors | `http`/`dio` + a local store (`sqflite`, `hive`, or files) + bundled JSON asset | Medium — the fallback logic is subtle and is the app's offline floor |
| App state | Zustand stores (map, field, account, app) | Riverpod or Bloc | Medium — model shapes port, mechanics do not |
| Offline basemap tiles | USGS The National Map raster tiles, z6–16, stored as ordinary files | ArcGIS offline map areas, or the same file-based tile cache via `path_provider` | Medium — and an opportunity to improve, see §5.4 |
| Waypoints, tracks, measure, draw | Web geometry + Turf + device geolocation | SDK geometry APIs + `geolocator` | Medium |
| Track recording | Foreground-only by product decision | Background capable via `flutter_background_geolocation` or similar | Low technically; **the cost is policy and store review, not code** |
| Sign-in and license wallet | Inert stub awaiting FWP OAuth ([STUB-001](stubs/STUB-001.md)) | `flutter_appauth` + `flutter_secure_storage` | Blocked on FWP, not on platform |
| Camera, share, haptics, network state, preferences | Capacitor plugins | `camera`/`image_picker`, `share_plus`, `flutter/services` haptics, `connectivity_plus`, `shared_preferences` | Low — near one-for-one with the current plugin list |
| Deep OS integration (widgets, App Intents, Wallet, CarPlay) | Not available | **Per-platform native code behind platform channels** | Medium-high — this is the one area where the single-codebase advantage does not apply |
| Accessibility | Semantic HTML + ARIA, axe-verified | Flutter `Semantics`, which drives VoiceOver and TalkBack | Medium — good support, but it is re-earned, not inherited, and is Flutter's own layer rather than the platform's native widgets |
| Privacy | No telemetry, no analytics, location never leaves the device | Must be re-established by policy | Low effort, **high consequence if it lapses** |
| Distribution | Web deploy; store builds via Capacitor | `flutter build ipa` / `appbundle` | Two review queues replace one deploy — same as any native route |

---

## 4. The map is the migration

Everything else in that table is ordinary application work. The map is what
determines the schedule, and on this route it is also where the open question
lives.

**What the map is today.** One persistent ArcGIS map underlies all three tabs.
47 registered layers, sourced from **27 distinct hosts** across FWP, DNRC, the
Montana State Library, BLM, USFS, NPS, USGS, NOAA, the Bureau of Reclamation,
NIFC, three counties, and two land trusts. Each layer carries its own symbology,
scale visibility, field aliases, and popup shape, declared in
`web/src/config/layers/`. Tapping a feature routes through the card registry to
one of 28 purpose-built renderers, with enrichment blocks that run their own
spatial queries (land ownership, PLSS, nearby public access).

### 4.1 The SDK is real and first-party

Esri's *ArcGIS Maps SDKs for Native Apps* family has five members — Swift,
Kotlin, .NET, Qt, and **Flutter**. The Flutter SDK ships as the `arcgis_maps`
package on pub.dev under Esri's verified publisher account, currently **300.1**
(August 2026), targeting iOS and Android.

This matters because it is the thing most often assumed to be missing. Flutter
is not reaching ArcGIS through a community wrapper or a bridge FWP would
maintain — it is a supported Esri product on the same release train as the
others.

### 4.2 What it already covers

Comfortably more than Engage MT currently uses:

- 2D and 3D viewing, web maps, and foundational portal APIs
- Most Esri and OGC layer types
- Pop-ups, clustering, labeling
- Feature editing and utility networks
- Geocoding, routing, and turn-by-turn navigation
- Device location, real-time and dynamic entities, geotriggers
- **Offline maps in both flavors** — preplanned map areas defined ahead of time
  by the map's owner, and on-demand areas a user draws in the field

### 4.3 What it does not cover yet — the honest part

Esri states plainly that the Flutter SDK "does not yet include all the
capabilities of the ArcGIS Maps SDKs for Native Apps" and maintains a
[parity page](https://developers.arcgis.com/flutter/parity/) tracking the gap.
Listed as still to come at the time of writing:

- Feature forms API and its toolkit component
- KML layer API
- ArcGIS Indoors location capabilities
- Floor awareness API and the Floor Filter toolkit component
- The remaining Portal API surface

**None of these is load-bearing for Engage MT as it stands today.** The app does
not use KML, has no indoor or floor-aware requirement, and does not present
feature forms. That is the good news and it should be stated plainly rather than
hedged.

The risk is not the current list — it is that **no dates are published** for any
of it. Anything in the MVP backlog that lands on an outstanding capability
becomes a schedule dependency on another organization's roadmap, with no date to
plan against. Two mitigations, both cheap:

1. **Check the parity page against the actual MVP backlog during assessment**,
   not during the build. It is a ten-minute exercise that either retires this
   risk or reveals it while the stack is still a choice.
2. **Keep a platform-channel escape hatch in the architecture.** Anything the
   Flutter SDK cannot do can be reached by calling the Swift or Kotlin SDK
   directly behind a channel. That is real work, but it is bounded work, and
   knowing it exists is what keeps a parity gap from being a dead end.

### 4.4 Licensing

The same model as the rest of the family, and less of an obstacle than it is
usually assumed to be. Deployment needs a **license string**, which is a
different thing from an API key: the key authorizes access to services and
content; the license string unlocks SDK capabilities and removes the "Licensed
For Developer Use Only" watermark. There are four levels — Lite, Basic,
Standard, Advanced — and **Lite is free**, covering viewing content, geocoding,
routing, and taking maps offline including preplanned and on-demand areas.
Basic is needed to edit or sync private feature services. Standard is needed
only if an offline package carries file-based data such as rasters or PDFs,
which is worth checking against whatever offline design replaces today's raster
basemap packs.

Confirm the level and the account type (Location Platform, ArcGIS Online, or
Enterprise) against FWP's existing Esri agreement before the architecture is
fixed.

### 4.5 The consequence for the 47 layers

On this route the layer registry is re-expressed **once**, in Dart, rather than
twice. That halves the most tedious part of the migration and removes an entire
class of defect: two platforms cannot drift apart in their symbology if there is
only one platform.

It does not remove the underlying problem, which is that the app is still
carrying 1,700 lines of cartography it does not own. That is §5.

---

## 5. The highest-leverage decision: one shared, published map service

**This analysis is identical in both migration guides.** It is the one decision
that pays off regardless of which client language wins, which is exactly why it
belongs in the assessment phase rather than the build.

### 5.1 What the as-is build could not do for itself

Engage MT styles its map in the client. Every symbol, every scale threshold,
every popup field list for all 47 layers is declared in TypeScript inside the
application, because the layers it consumes are other organizations' public
services, published for their own purposes, symbolized for their own maps.

That was the only option available to a client-side build. Publishing a map
service is a GIS administration act — it requires ownership of an ArcGIS Server
or ArcGIS Online organization, credits or licensing, and someone with the
authority to publish and maintain items. FWP has all three (`fwp-gis.mt.gov` and
the FWP ArcGIS Hub already serve 32 and 12 of the app's layers respectively).
The application did not, and could not grant itself that.

**Had a single FWP-owned, pre-styled web map existed, the as-is app would have
been meaningfully smaller and more maintainable.** Concretely: ~1,700 lines of
layer configuration would have been an item id; a symbology correction would
have been a GIS staff publish rather than a code change, a review, and a
redeploy; and the "which BLM service is authoritative this year" question would
have had one owner instead of living in a comment in a config file.

That is not a criticism of the data providers or of the approach taken — it is
the normal consequence of an application assembling its own cartography from 27
independent sources. It is worth stating plainly because a rewrite is the moment
when the cost of *not* having it gets paid again.

### 5.2 Why it still matters on a single-codebase route

Flutter removes the "written twice" problem but not the "owned by the wrong
layer" problem. Without a published map, FWP maintains cartography in **two**
places — the web application and the Flutter application — and every new layer,
retired upstream service, symbology tweak, or popup field change is two code
changes, two test updates, one web deploy, and two store reviews.

With a single published web map, both clients open one item and get the same
layers, the same symbols, the same scale ranges, and the same popup definitions.
Adding a layer stops being an application release at all.

The saving is smaller than on the two-native-apps route — two consumers instead
of three — but the *nature* of the win is the same and it compounds over years,
not over one project.

### 5.3 What it would actually be

Not a copy of everyone's data. An **aggregation and presentation layer** that
FWP owns:

- A web map item (or a small number, grouped by tab) that **references** the
  existing upstream services rather than duplicating their data, so BLM, USFS,
  NPS, USGS, and county layers keep their current custodians and update cadence.
- FWP-authored symbology, scale visibility, field aliases, and popup
  configuration applied at the map item, not in each client.
- Optionally, **hosted feature layers for the handful of datasets where
  reference is not enough** — where the upstream service is slow, unstable,
  lacks CORS, or is not scoped to Montana. Those become FWP-owned copies with a
  documented refresh job.
- The existing `shared/src/arcgisLayers.ts` registry narrowed to what it is
  uniquely good at: the code-to-geography join the regulations database depends
  on. The rendering half moves to the map item.

The codebase is already shaped for this. The layer registry is one file every
consumer imports, no component inlines a service URL, and `check:gis-registry`
gates drift. Swapping the registry's backing from 47 literals to one item id is
a contained change even in the current app.

### 5.4 What it buys, beyond consistency

- **Offline gets substantially better.** Today offline means raster basemap
  tiles from USGS at zoom 6–16 and bundled reference JSON; there are no offline
  *feature* layers, so a user with no signal loses tap-to-query on districts,
  ownership, and access sites. The Flutter SDK supports offline map areas with
  vector features in both flavors, at the free Lite license level. What it is
  not free of is a prerequisite: an offline map area is generated from *a web
  map you own and configure*. **Without a published FWP map, a Flutter rewrite
  ships the same offline the app has now.** This is probably the single most
  user-visible improvement available in the whole migration, and it is gated on
  a GIS decision rather than on app code.
- **Popups become portable.** Popup definitions configured on the map item give
  both clients a consistent baseline, reducing (though not eliminating — see
  the caveat below) the feature-card work.
- **Upstream volatility gets one owner.** When a county retires a trails
  service, one person updates one map instead of two teams shipping releases.
- **Access and security become configurable.** Layers that should not be public
  can sit behind FWP's own item sharing rather than being absent.

### 5.5 The honest caveats

- **It does not eliminate the feature cards.** The 28 card renderers are product
  design — units, plain-language rules, cross-links to regulations, the
  land-ownership enrichment — not cartography. A popup definition standardizes
  the underlying fields; it does not draw the card. Expect the map item to
  remove perhaps a third of that work, not all of it.
- **It concentrates a failure mode.** Today a broken upstream service degrades
  one layer. A shared map item that fails to load degrades the map. Manageable
  — cache the map definition, keep a bundled fallback — but it must be designed
  for rather than assumed away.
- **It is real, ongoing work for FWP GIS staff.** Someone owns that item, its
  symbology, and its refresh jobs, indefinitely. If that owner is not named, the
  map decays and the clients have no local override left to compensate with.
- **The SDK license is free at the level this needs; the hosting is not.** The
  cost is ArcGIS Online credits for hosted feature layer storage and offline map
  area generation, or Enterprise capacity if FWP hosts it on `fwp-gis.mt.gov`.
  Referenced layers that stay with their upstream custodians cost nothing.
- **Third-party terms still apply.** Referencing a land trust's or a county's
  service in an FWP-branded map is a different posture than a client fetching it
  directly. A conversation to have per source, not an assumption.

### 5.6 Recommendation

**Do it, and do it before the map work starts — not after.** Treat the published
map as a prerequisite deliverable of the assessment phase, owned jointly by FWP
GIS and the mobile team, with a named long-term custodian. It pays for itself
even if the rewrite is later rescoped or deferred, because the existing web
application can consume it immediately.

---

## 6. Other migration paths worth pricing

Flutter is the path this guide assumes. The assessment phase is the cheap moment
to confirm it against the alternatives rather than the expensive one. The full
comparison table lives in
[SWIFTKOTLIN_NATIVE_MIGRATION_GUIDE.md §6](SWIFTKOTLIN_NATIVE_MIGRATION_GUIDE.md);
what follows is the same question asked from this side.

**The trade, stated once.** Every candidate trades *how much is written once*
against *how mature and complete the platform is*. Flutter sits at one end —
least duplication, a first-party SDK that is capable but still filling in.
Swift + Kotlin sits at the other — most duplication, most maturity, deepest
platform reach. Kotlin Multiplatform splits the difference on the non-map half.
React Native is the one option the map argues against, because Esri ships no
first-party React Native SDK.

| Path | Versus Flutter |
|---|---|
| **Two native apps — Swift + Kotlin** | The safe, fully-supported default. Buys SDK maturity, complete parity today, and the deepest OS integration with no channel work. Costs roughly double the UI, feature-card, and test surface, plus two toolchains and two test suites. Choose it if the parity check turns up something Engage MT needs, or if widgets/Wallet/CarPlay-class integration is central to the MVP rather than a later phase. |
| **Kotlin Multiplatform, native UI** | Shares the non-map logic (regulations client, offline resolver, tile math, state models) while UI stays SwiftUI and Compose. Less sharing than Flutter, more platform-native UI. Note the Kotlin SDK is Android-only — KMP shares logic, not the map. |
| **Invest in the current stack** | The honest low-cost comparator any business case should be measured against. One codebase keeps serving web and both stores; background location and most store-integration gaps are reachable with targeted plugins. Does not deliver offline feature layers, widgets, Wallet, or App Intents, and remains a web view to reviewers. |
| **Native shell, incremental adoption** | Ship the Flutter map and field tools first, keep content-heavy screens as web views, replace over time. De-risks the schedule at the cost of two paradigms in one app and a seam that tends to become permanent. |
| **React Native / Expo** | Closest to the current team's idiom, but **no first-party ArcGIS SDK** — the map, the largest and most technical part of this product, would ride on a community wrapper or a bridge FWP maintains. The familiarity advantage does not extend to the part that matters most. |
| **iOS first, Android later** | Not applicable on this route, and that is a point in Flutter's favor: there is no "later platform" to defer, because both ship from the same build. |

**The decision that actually matters** is not on this page. It is the parity
check in §4.3 — run it against the real MVP backlog, record the answer, and the
stack choice largely makes itself.

---

## 7. The web application

A Flutter rewrite describes the mobile surface. The public web application —
which is today the *same* application — is a separate question, and it should be
answered deliberately rather than by omission. **This section is identical in
both migration guides**, with one addition noted at the end.

**What the web surface currently is.** The whole product. `mobile/` is a wrapper
around `web/dist`; the browser app is not a companion to the mobile app, it is
the source of it. It is also the only surface with no install friction, the one
that works on a desk at a regional office, the one reachable from a link in an
FWP email or a search result, and the one available to users who will not or
cannot install an app. It runs standalone with no server, falling back to a
bundled regulations snapshot.

**What happens to it under a Flutter build.** The Capacitor wrapper retires
cleanly; `web/` does not. Three futures, each with consequences:

| Option | Consequence |
|---|---|
| **Keep and maintain it** | Two clients, two release cadences, and a standing parity policy is required from day one. Costs the most, preserves the most reach. |
| **Freeze it as a reduced public surface** | Keep regulations lookup, district search, and public-land maps on the web; let the field tools (waypoints, tracks, offline packs) be app-only. Cheapest honest answer; needs an explicit feature-parity statement so users are not surprised. |
| **Retire it** | Everything becomes app-only. Loses the no-install audience and the desktop use case entirely. Should not happen by default. |

**The part that is time-sensitive.** Divergence begins the day the rewrite
starts. If the web app keeps shipping features during the MVP build, the Flutter
app is chasing a moving target; if it is frozen without saying so, users notice
before anyone announces it. Naming the option above during planning costs an
hour; discovering it in month three costs a re-plan.

**The Flutter-specific temptation, and why to resist it.** Flutter also compiles
to web, so "just build the web app from the same Flutter codebase" will come up.
It is worth knowing that the **ArcGIS Maps SDK for Flutter targets iOS and
Android only** — it does not support Flutter web. A Flutter web build of Engage
MT would have no map, which is the product. Treat Flutter web as out of scope
and keep the existing React web application as the web surface.

**What is not in question:** the staff console (`staff/`) stays a web
application, and the regulations API stays the shared backend for every client.
Those are the contracts that keep whatever surfaces exist consistent — together
with the shared map service from §5, they are the whole integration story.

---

## 8. Honest comparison — today versus a Flutter build

### 8.1 What the handoff build does today

- One codebase producing a web app, an iOS app, and an Android app.
- Three tabs over one persistent map: Hunt, Explore & Access, My FWP.
- 47 map layers from 27 sources; tap any feature for one of 28 purpose-built
  cards; spatial-context enrichment (land ownership, PLSS, nearby access).
- Hunting district browsing with live regulations from the FWP Regs Manager,
  falling back to a stored field copy, then to a bundled snapshot — every result
  labeled with its freshness tier so a stored copy is never shown as live.
- Offline basemap area downloads (USGS topo and imagery, z6–16), waypoints,
  GPS track recording (foreground), measure and draw, camera, share.
- No telemetry, no analytics, no third-party trackers; user location never
  leaves the device.
- MIT licensed, ~1,440 tests, and a single merge gate.
- Sign-in and the license wallet present as a documented, inert seam.

### 8.2 What a Flutter build is expected to add

| Capability | Why Flutter helps |
|---|---|
| Offline feature layers | Genuinely better — **if** §5 happens. Supported at the free Lite license level; gated on a published map, not on the client language. |
| Map performance and memory | Real gains over a web view on large feature counts and long sessions — the SDK renders natively, not in a browser engine. |
| Background track recording | Removes the foreground-only limit. Still carries an Android foreground service with a permanent notification, iOS always-on authorization, and store-review justification on both platforms. |
| Push notifications and geofenced alerts | Straightforward with `firebase_messaging` once the backend exists. **Note:** push is a backend and credential gap, not a client-technology gap — it needs FWP-provisioned Apple and Firebase credentials plus a sender, and that work is the same regardless of client. OS geofencing remains capped at 20 monitored regions on iOS and 100 on Android for every kind of app, so covering arbitrary district or closure polygons stays a design problem. |
| Store and OS posture | A compiled native binary, not a web view. Review, privacy labels, and OS updates behave as reviewers and users expect. |
| One codebase, one test suite | The distinguishing advantage over the two-native-apps route: 28 feature cards, one layer registry, one regulations client, one set of widget and integration tests — covering both platforms. |
| UI consistency by construction | The two platforms cannot drift apart, because there is only one implementation. |

### 8.3 What gets harder, and should be planned for

- **Dart and Flutter are new to this team.** The current codebase is React and
  TypeScript; the conceptual distance is not large, but it is real, and the
  learning happens on the critical path.
- **Calcite does not exist in Flutter.** The Esri design system the web app uses
  has no Flutter equivalent, so the visual language is rebuilt from the brand
  rules in [rules/fwp-brand.md](rules/fwp-brand.md) rather than inherited.
- **The parity gap is a live dependency.** See §4.3. Small today, undated
  tomorrow.
- **Deep OS integration still needs native code.** Widgets, App Intents, Wallet
  passes, CarPlay and Android Auto are written per platform behind channels —
  the one place the single-codebase advantage does not apply.
- **The test suite and the 12 audit gates do not port.** Cheaper to rebuild here
  than on the two-app route, but still a deliverable.
- **Release cadence changes.** A web deploy becomes two store submissions with
  review latency, and a regulations-season fix has to clear both.
- **A third toolchain enters FWP's long-term maintenance surface** — Flutter and
  Dart alongside the existing web stack and whatever the server runs on.
- **The privacy posture must be re-established deliberately.** It is currently
  structural — there is no analytics SDK to disable because none is installed.
  In a new codebase that is a policy decision someone has to keep making, and
  Flutter's common packages make it easy to add telemetry by accident.

### 8.4 What stays exactly as hard as it is now

These are FWP-side dependencies. No client technology changes them:

- MyFWP OAuth availability and the license wallet contract ([STUB-001](stubs/STUB-001.md)).
- Regulations content accuracy and the publishing workflow (the Regs Manager and
  the staff console).
- Push credentials and a notification sender.
- Hosting and database operations for the regulations API
  ([deploy/](deploy/README.md), [regs-manager/railway-handover.md](regs-manager/railway-handover.md)).
- Whoever owns upstream GIS service stability.

---

## 9. A sequencing that de-risks the work

Rough three-phase shape, in the order that surfaces expensive surprises first.

**Phase 1 — assess and decide**

- Read the seams in §2 and confirm the API and registry contracts hold.
- **Run the parity check (§4.3)** against the real MVP backlog. This is the
  single highest-value hour in the whole engagement on this route.
- **Decide the shared map service (§5) and name its owner.** Everything in the
  map track depends on this answer.
- **Decide the web application's future (§7)** and publish the parity policy.
  Note that Flutter web is not an answer — the SDK is mobile-only.
- Confirm the Esri license level and account type — a Lite license string is
  free and covers what this app does; verify nothing in the target design pushes
  it to Basic or Standard.
- Resolve the MyFWP sign-in dependency or scope the MVP around the stub.
- Agree what "MVP" contains against §8.1 — what of today's behavior must exist
  on day one, and what is explicitly deferred.
- Stand up the Flutter test and CI skeleton before feature work, so §8.3 does
  not land in month three.
- Build a throwaway spike: the map, three layers, one feature card, on both
  platforms. On this route the spike is cheap and answers most of the open
  questions at once.

**Phase 2 — build the core**

- Map, layers, and tap-to-query against the shared map item.
- Hunt tab: district browsing and the three-tier regulations client.
- Offline: basemap areas, and feature layers if §5 landed.
- Field tools and the device capability set.
- Port the feature cards in priority order; the registry tells you which are
  most used.

**Phase 3 — validate and ship**

- Parity checklist against §8.1, item by item, on both platforms — and test on
  real devices, not just simulators, since the map is GPU- and memory-heavy.
- Accessibility validation with VoiceOver and TalkBack, not just automated
  checks. Flutter's `Semantics` layer needs deliberate verification.
- Privacy labels and data-safety declarations consistent with actual behavior.
- Store submission, and a knowledge-transfer pass to whoever maintains it next.

---

## 10. Decisions FWP owns

Collected here so they land in the right risk register rather than in a
developer's inbox:

1. **Client stack** — Flutter, two native apps, or invest in the current stack.
   The parity check in §4.3 largely settles it. (§6)
2. **Shared map service** — build it, who owns it, and whether it is referenced
   or hosted per layer. (§5)
3. **Web application future** — keep, reduce, or retire, and the parity policy
   during the build. Flutter web is not an option. (§7)
4. **Esri licensing and hosting** — confirm the license level (Lite is free and
   likely sufficient), the account type, and who pays the ArcGIS Online credits
   or Enterprise capacity for hosted layers and offline map area generation.
5. **MyFWP OAuth** — endpoint availability and the license wallet contract.
6. **Push and notifications** — Apple and Firebase credentials, a sender, and
   the policy for what the app is allowed to tell users.
7. **Background location** — whether the product wants it, given the permission
   prompts and store-review obligations it brings.
8. **Privacy posture** — whether "no telemetry, location never leaves the
   device" is a standing requirement, stated up front.
9. **Long-term maintenance** — who holds Dart and Flutter skills at FWP or its
   vendors five years out. This is a real consideration and belongs in the
   decision, not after it.
10. **Hosting** — where the regulations API and database live long-term.
11. **Third-party layer terms** — per-source, for anything rehosted or
    re-published under FWP branding.

---

## 11. Where to look

| Question | File |
|---|---|
| The same migration as two native apps | [SWIFTKOTLIN_NATIVE_MIGRATION_GUIDE.md](SWIFTKOTLIN_NATIVE_MIGRATION_GUIDE.md) |
| What are the pieces and how big is each? | [codebase-overview.md](codebase-overview.md) |
| How is it built? | [architecture.md](architecture.md) |
| How do I run, test, and change it? | [development.md](development.md) |
| Every document, indexed | [DOCS.md](../DOCS.md) |
| Map layer definitions | `web/src/config/layers/` and `web/src/config/layers.ts` |
| The regulations-to-geography join | `shared/src/arcgisLayers.ts` |
| Feature card renderers | `web/src/components/map/featureCards/` |
| Offline tile sources and zoom bounds | `web/src/config/offlineBasemaps.ts` |
| Current native plugin set (the `pubspec.yaml` shopping list) | `mobile/package.json` |
| Regulations API | [regs-manager/api.md](regs-manager/api.md) |
| Seams awaiting FWP systems | [stubs/README.md](stubs/README.md) |
| Mobile build and store release | [mobile/README.md](mobile/README.md) |
| Engineering conventions by domain | [rules/](rules/README.md) |
| Deployment and data operations | [deploy/README.md](deploy/README.md) |

### External references

Every claim in this document about Esri's SDKs is checkable at these pages.
They move — re-check them at assessment time rather than trusting this
snapshot, which was taken 2026-09-14.

| Claim in this document | Source |
|---|---|
| The Native Apps SDK family is Swift, Kotlin, .NET, Qt, and Flutter | [ArcGIS Maps SDKs for Native Apps](https://developers.arcgis.com/documentation/glossary/arcgis-maps-sdks-for-native-apps/) |
| The Flutter SDK, its capabilities, and iOS/Android-only targeting | [ArcGIS Maps SDK for Flutter](https://developers.arcgis.com/flutter/) |
| Published by Esri as `arcgis_maps`, version 300.1 | [pub.dev/packages/arcgis_maps](https://pub.dev/packages/arcgis_maps) |
| Not yet at full parity; what is still coming | [Flutter Maps SDK parity](https://developers.arcgis.com/flutter/parity/) |
| Offline map areas — preplanned and on-demand — are supported | [Offline maps, scenes, and data](https://developers.arcgis.com/flutter/offline-maps-scenes-and-data/) |
| A license string is required for deployment and is distinct from an API key | [Get a license](https://developers.arcgis.com/swift/license-and-deployment/get-a-license/) |
| Lite is free and covers offline; Basic and Standard thresholds | [License levels and capabilities](https://developers.arcgis.com/flutter/license-and-deployment/license-levels-and-capabilities/) |
| No first-party React Native SDK | Absence from the Native Apps family list above |

Platform geofencing limits (20 monitored regions on iOS, 100 on Android) come
from Apple's Core Location and Android's geofencing documentation respectively;
they are platform ceilings and apply to every kind of app.

---

*Engage MT is MIT licensed. Reuse of any part of this codebase — in a Flutter
rewrite or anywhere else — carries no restriction beyond attribution.*
