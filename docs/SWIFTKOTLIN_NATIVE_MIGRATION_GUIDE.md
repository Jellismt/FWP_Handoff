# Swift / Kotlin native migration guide

**What this is.** Engage MT v1.0.0 ships as one TypeScript codebase that runs as
a web application and, through a thin Capacitor wrapper, as an iOS and Android
app. This document describes what it would take to carry that same product
forward as two native applications — iOS in Swift, Android in Kotlin — and what
changes about the product when you do.

It is written for the team that picks this up: a mobile architect sizing the
work, a product owner deciding what an MVP contains, and the FWP GIS and IT
staff who own the data and the systems this app consumes.

Swift and Kotlin are the assumed destination throughout, because they are the
most mature members of Esri's native SDK family and the ones with the deepest
platform reach. They are not the only option, and **§6 weighs the alternatives
— including Flutter, which now has a first-party ArcGIS SDK** — because the
assessment phase is the cheap moment to confirm the choice. That option has a
companion document of its own:
[FLUTTER_MIGRATION_GUIDE.md](FLUTTER_MIGRATION_GUIDE.md), which walks the same
migration as a single Flutter codebase.

**What this is not.** It is not a recommendation for or against a native
rebuild, and it is not an implementation plan. It is an honest inventory of what
exists, where the seams are, what ports cleanly, what has to be written twice,
and which decisions — several of them FWP's rather than any developer's — make
the difference between an expensive migration and an efficient one.

Read [codebase-overview.md](codebase-overview.md) first if you have
not; this guide assumes it.

Last updated: 2026-09-14 · Applies to: v1.0.0

---

## 1. Where the code is today

### 1.1 Five workspaces, three of which are not mobile

| Workspace | What it is | Native migration relevance |
|---|---|---|
| `web/` | The product: React 19 + TypeScript + ArcGIS Maps SDK for JavaScript. ~370 files, ~51,300 lines. | **This is what gets rewritten.** Everything the user sees lives here. |
| `mobile/` | Capacitor 8 wrapper (24 config/bridge/build files, ~1,050 lines) around `web/dist`. No separate UI. | **Retired** by a native build. It is deliberately thin, so removing it costs nothing. |
| `server/` | FWP Regs Manager — Fastify API + PostgreSQL + ETL. ~90 files, ~10,200 lines, 28 SQL migrations. | **Unchanged.** Native clients call the same public read API. |
| `staff/` | Internal regulations authoring console (web SPA). ~47 files, ~6,400 lines. | **Unchanged and stays web.** It is a desktop admin tool; nothing about it wants to be native. |
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

Native rewrites replace the bridge, not the concept. The behaviors those bridges
implement — foreground-only track recording and its segment-on-resume rule, the
offline tile store on the device filesystem, the field copy of regulations that
survives web-view cache eviction — are documented product decisions that a
native team should port as specifications, not rediscover.

### 1.3 The test and gate inventory

- ~1,440 unit and component test cases across ~215 files (~24,400 lines).
- 11 Playwright end-to-end specs / 16 tests, each on desktop and phone
  viewports, including an axe accessibility sweep.
- 12 static `check:*` audits in the merge gate: GIS registry drift, Montana
  scoping, Capacitor import guards, iOS privacy manifest, native config
  coherence, plugin parity, CSP and security headers, data freshness, the
  regulations offline floor, container config, doc links, orphan detection.

**None of this ports.** It is TypeScript, Vitest, Playwright, and Node. This is
the largest hidden cost in any native migration and is worth naming early: the
safety net that currently lets a junior developer change this codebase
confidently has to be rebuilt in XCTest / Swift Testing and JUnit / Espresso
before the native apps have the same property. Budget it as a deliverable, not
as a side effect of writing features.

What *does* port is the intent. Each check encodes a rule that was learned the
hard way (for example, `check:native-config` fails the build if background
location is ever declared without the foreground service, notification
permission, and iOS purpose string behind it). Those rules are worth reading as
requirements even though the scripts themselves are disposable.

---

## 2. The seams — what a native team ports against

The single most useful property of this codebase for a rewrite is that the
things a second and third client need are already factored out of the UI. Port
against these, not against the React components.

| Seam | Where | What it gives a native client |
|---|---|---|
| **Regulations read API** | `server/`, `/api/v2/fwp/*` — see [regs-manager/api.md](regs-manager/api.md) | The whole hunting-regulations domain as a versioned HTTP contract. Swift and Kotlin clients consume it identically to the web client. Nothing to re-derive. |
| **GIS layer registry** | `shared/src/arcgisLayers.ts`, enforced by `check:gis-registry` | The one place a service URL, layer id, and join field are declared per geography. The regulations database stores **no geometry**; codes join to live ESRI layers. This is already the "one registry, many clients" pattern — a native client is just a third consumer. |
| **Map layer registry** | `web/src/config/layers/*.ts` (47 layers, ~1,700 lines) | Every layer's URL, symbology, scale range, popup fields, and module ownership, as data rather than as code scattered through components. It reads as a specification for the native map. See §4 and §5. |
| **Feature-card registry** | `web/src/components/map/featureCards/` (28 cards + conformance tests) | For each tappable feature type, exactly which fields are shown, in what order, with what units and links. This is product design captured as code, and it is the part a native team would otherwise have to re-specify from screenshots. |
| **Stub registry** | `web/src/services/stubs/registry.ts` + [stubs/README.md](stubs/README.md) | Every seam waiting on an FWP system, with the expected endpoint, auth model, and swap procedure. [STUB-001](stubs/STUB-001.md) is MyFWP sign-in and the license wallet. |
| **Reference data manifest** | `web/public/data/data-manifest.json` | The bundled offline dataset set, with hashes and freshness rules. Native apps need the same payloads shipped in the bundle. |
| **Engineering conventions** | [rules/](rules/README.md) | Per-domain rules for ArcGIS use, accessibility, privacy, data freshness, and mobile. Several are platform-independent product policy, notably [privacy.md](rules/privacy.md) and [data-freshness.md](rules/data-freshness.md). |

A migration that treats these as the source of truth writes two native clients
against six contracts. A migration that treats the React tree as the source of
truth reads 51,300 lines of TypeScript twice.

---

## 3. Migration map, layer by layer

| Concern | Today | iOS (Swift) | Android (Kotlin) | Difficulty |
|---|---|---|---|---|
| UI shell, navigation, three tabs | React Router 7, Calcite components | SwiftUI + `NavigationStack` | Compose + Navigation | Low — small surface, but every screen is drawn twice |
| Map rendering and layers | ArcGIS Maps SDK for JavaScript 5.x | ArcGIS Maps SDK for Swift | ArcGIS Maps SDK for Kotlin | **High — the bulk of the work.** See §4 |
| Tap-to-query feature cards | 28 registry-driven card renderers | 28 SwiftUI views | 28 Compose views | Medium-high; the *content* is already specified, the *rendering* is not |
| Regulations (live / stored / bundled) | Three-tier client with freshness descriptors | `URLSession` + a local store + bundled JSON | Retrofit/Ktor + Room or files + bundled JSON | Medium — the fallback logic is subtle and is the app's offline floor |
| App state | Zustand stores (map, field, account, app) | Observable state / SwiftData | ViewModel + StateFlow / Room | Medium — model shapes port, mechanics do not |
| Offline basemap tiles | USGS The National Map raster tiles, z6–16, stored as ordinary files | Native tile cache, or Esri offline map areas | Same | Medium — and an opportunity to improve, see §5.4 |
| Waypoints, tracks, measure, draw | Web geometry + Turf + device geolocation | Native geometry + CoreLocation | Native geometry + FusedLocationProvider | Medium |
| Track recording | Foreground-only by product decision | Background capable, with real permission and store-review costs | Same, plus a foreground service and persistent notification | Low technically; **the cost is policy and review, not code** |
| Sign-in and license wallet | Inert stub awaiting FWP OAuth ([STUB-001](stubs/STUB-001.md)) | ASWebAuthenticationSession + Keychain | Custom Tabs + EncryptedSharedPreferences | Blocked on FWP, not on platform |
| Camera, share, haptics, network state | Capacitor plugins | First-party frameworks | First-party frameworks | Low |
| Accessibility | Semantic HTML + ARIA, axe-verified | VoiceOver, Dynamic Type | TalkBack, font scaling | Medium — better ceiling natively, but it is re-earned, not inherited |
| Privacy posture | No telemetry, no analytics, location never leaves the device | Must be re-established by policy | Must be re-established by policy | Low effort, **high consequence if it lapses** |
| Distribution | Web deploy; store builds via Capacitor | App Store | Play Store | Two review queues replace one deploy |

---

## 4. The map is the migration

Everything else on that table is ordinary application work. The map is the part
that determines the schedule.

**What the map is today.** One persistent ArcGIS map underlies all three tabs.
47 registered layers, sourced from **27 distinct hosts** across FWP, DNRC, the
Montana State Library, BLM, USFS, NPS, USGS, NOAA, the Bureau of Reclamation,
NIFC, three counties, and two land trusts. Each layer carries its own symbology,
scale visibility, field aliases, and popup shape, declared in
`web/src/config/layers/`. Tapping a feature routes through the card registry to
one of 28 purpose-built renderers, with enrichment blocks that run their own
spatial queries (land ownership, PLSS, nearby public access).

**What that means for a native build.** Esri's *ArcGIS Maps SDKs for Native
Apps* family has five members — **Swift, Kotlin, .NET, Qt, and Flutter** — so
the capability is well supported, and in several respects these SDKs exceed the
JavaScript SDK the app uses today (rendering performance on large feature
counts, true offline map areas with vector features, lower memory). The two this
guide assumes, Swift and Kotlin, are the platform-native members and the most
mature; §6 weighs the others. But each is a separate product with its own
licensing and deployment-key requirements, its own API, and its own learning
curve. Three things follow:

1. **Licensing is a smaller obstacle than it is usually assumed to be, but it
   is a confirm-early item.** Deployment needs a **license string**, which is a
   different thing from an API key: the key authorizes access to services and
   content, the license string unlocks SDK capabilities and removes the
   "Licensed For Developer Use Only" watermark. There are four levels — Lite,
   Basic, Standard, Advanced — and **Lite is free**, covering viewing content,
   geocoding, routing, and *taking maps offline* (including preplanned and
   on-demand offline map areas, and sync against public feature services).
   Basic is needed to edit or sync private feature services; Standard only if
   an offline package carries file-based data such as rasters or PDFs — which
   is worth checking against whatever offline design replaces today's raster
   basemap packs. Confirm the level and the account type (Location Platform,
   ArcGIS Online, or Enterprise) against FWP's existing Esri agreement before
   the architecture is fixed.
2. **The 47 layer definitions get re-expressed twice** — once in Swift, once in
   Kotlin — unless §5 happens.
3. **Symbology drift becomes a real risk.** Three independent renderings of the
   same 47 layers will diverge, and the divergence will be invisible until
   someone puts two phones side by side.

Point 3 is the reason for the next section.

---

## 5. The highest-leverage decision: one shared, published map service

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
independent sources. It is worth stating plainly because the native migration is
the moment when the cost of *not* having it triples.

### 5.2 Why it matters more for native than it did for web

With client-side layer configuration and three clients, FWP maintains the same
cartography three times: TypeScript, Swift, Kotlin. Every new layer, every
retired upstream service, every symbology tweak, every popup field change is
three code changes, three test updates, two store reviews, and one web deploy.

With a single published web map, all three clients open one item and get the
same layers, the same symbols, the same scale ranges, and the same popup
definitions. Adding a layer stops being an application release.

This is the one change that reduces the native scope rather than expanding it,
and its value survives whatever happens to the client technology afterward.

### 5.3 What it would actually be

Not a copy of everyone's data. An **aggregation and presentation layer** that
FWP owns:

- A web map item (or a small number of them, grouped by tab) that **references**
  the existing upstream services rather than duplicating their data, so BLM,
  USFS, NPS, USGS, and county layers keep their current custodians and
  update cadence.
- FWP-authored symbology, scale visibility, field aliases, and popup
  configuration applied at the map item, not in each client.
- Optionally, **hosted feature layers for the handful of datasets where
  reference is not enough** — where the upstream service is slow, unstable,
  lacks CORS, or is not scoped to Montana. Those become FWP-owned copies with a
  documented refresh job.
- The existing `shared/src/arcgisLayers.ts` registry narrowed to what it is
  uniquely good at: the code-to-geography join that the regulations database
  depends on. The rendering half of the registry moves to the map item.

The codebase is already shaped for this. The layer registry is one file that
every consumer imports, no component inlines a service URL, and
`check:gis-registry` gates drift between the web registry and the shared one.
Swapping the registry's backing from 47 literals to one item id is a contained
change even in the current app.

### 5.4 What it buys, beyond consistency

- **Offline gets substantially better.** Today offline means raster basemap
  tiles from USGS at zoom 6–16 and bundled reference JSON; there are no offline
  *feature* layers, so a user with no signal loses tap-to-query on districts,
  ownership, and access sites. Every SDK in the Native Apps family — Swift,
  Kotlin, and Flutter alike — supports offline map areas with vector features,
  in both flavors: **preplanned** areas an owner defines ahead of time, and
  **on-demand** areas a user draws in the field. The capability sits at the free
  Lite license level. What it is not free of is a prerequisite: an offline map
  area is generated from *a web map you own and configure*. **Without a
  published FWP map, native offline is the same offline the app has now.** This
  is probably the single most user-visible improvement available in the whole
  migration, and it is gated on a GIS decision rather than on app code or on
  which client language wins.
- **Popups become portable.** Popup definitions configured on the map item give
  all three clients a consistent baseline, reducing (though not eliminating —
  see the caveat below) the 28-cards-times-three problem.
- **Upstream volatility gets one owner.** When a county retires a trails
  service, one person updates one map instead of three teams shipping three
  releases.
- **Access and security become configurable.** Layers that should not be public
  can sit behind FWP's own item sharing rather than being absent.

### 5.5 The honest caveats

- **It does not eliminate the feature cards.** The 28 card renderers are product
  design — units, plain-language rules, cross-links to regulations, the
  land-ownership enrichment — not cartography. A popup definition standardizes
  the underlying fields; it does not draw the card. Expect the map item to
  remove perhaps a third of that work, not all of it.
- **It concentrates a failure mode.** Today, a broken upstream service degrades
  one layer. A shared map item that fails to load degrades the map. This is
  manageable (cache the map definition, keep a bundled fallback), but it must be
  designed for rather than assumed away.
- **It is real, ongoing work for FWP GIS staff.** Someone owns that item, its
  symbology, and its refresh jobs, indefinitely. If that owner is not named, the
  map decays and the clients have no local override left to compensate with.
- **The SDK license is free at the level this needs; the hosting is not.** The
  Lite license string covers viewing and offline map areas, so the cost is not
  in the SDK. It is in ArcGIS Online credits for hosted feature layer storage
  and offline map area generation, or in Enterprise capacity if FWP hosts it
  on `fwp-gis.mt.gov` instead. Referenced layers that stay with their upstream
  custodians cost nothing to carry.
- **Third-party terms still apply.** Referencing a land trust's or a county's
  service in an FWP-branded map is a different posture than a client fetching it
  directly. That is a conversation to have per source, not an assumption.

### 5.6 Recommendation

**Do it, and do it before the native map work starts — not after.** Treat the
published map as a prerequisite deliverable of the assessment phase, owned
jointly by FWP GIS and the mobile team, with a named long-term custodian. It is
the only item on this page that makes both native applications smaller, and it
pays for itself even if the native rebuild is later rescoped or deferred,
because the existing web application can consume it immediately.

---

## 6. Other migration paths worth pricing

Two fully native applications is the path this guide assumes, and it is a
defensible one — but the assessment phase is the cheap moment to confirm it
against the alternatives rather than the expensive one. A short pass, in
decreasing order of how much of the existing investment each preserves.

**The map is what narrows the field.** For an application whose entire substrate
is a 47-layer ArcGIS map with tap-to-query, the first question about any stack
is whether Esri ships a first-party SDK for it. The *ArcGIS Maps SDKs for Native
Apps* family currently has five members — **Swift, Kotlin, .NET, Qt, and
Flutter** — alongside the separate ArcGIS Maps SDK for JavaScript that this app
uses today. **React Native is the notable absence: Esri ships no first-party
React Native SDK**, so that ecosystem reaches ArcGIS only through a
community wrapper or a platform-channel bridge the team writes and maintains.

That makes Flutter a genuine option rather than a compromise — with one
important qualifier. The Flutter SDK is the newest member of the family
(300.1, August 2026), and Esri states plainly that it "does not yet include all
the capabilities of the ArcGIS Maps SDKs for Native Apps," publishing a
[parity page](https://developers.arcgis.com/flutter/parity/) tracking what is
still to come. What it already has covers most of this product: 2D and 3D,
web maps, most Esri and OGC layer types, pop-ups, editing, utility networks,
clustering, labeling, and **both offline workflows — preplanned map areas and
on-demand offline maps**. Listed as still coming at the time of writing: the
feature forms API, KML layers, ArcGIS Indoors, floor awareness, and the
remaining Portal API surface. None of those are load-bearing for Engage MT
today, but no dates are published, so anything depending on them is a schedule
risk rather than a known cost.

| Path | Preserves | Pros | Cons |
|---|---|---|---|
| **Two native apps — Swift + Kotlin** | Contracts, API, data, product specs | The two most mature, at-parity SDKs in the family; best offline and map performance; deepest OS integration (widgets, App Intents, Wallet, CarPlay/Android Auto) with no bridge to own | Most code written twice; test suite and gates rebuilt twice; two release queues; largest total build |
| **Flutter — one codebase, first-party SDK** ([full guide](FLUTTER_MIGRATION_GUIDE.md)) | Contracts, API, data, product specs | **One UI codebase for iOS and Android** against a first-party Esri SDK — roughly halves the UI, feature-card, and layer-wiring work versus writing Swift and Kotlin separately; offline map areas supported; strong rendering; single test suite instead of two | Newest SDK in the family and explicitly not yet at full parity, with no published timeline; smaller sample corpus and community than Swift/Kotlin; Dart is a new language for the team; deep OS integrations still need per-platform plugin work; adds Flutter toolchain to what FWP maintains long-term |
| **Kotlin Multiplatform, native UI** | Contracts plus the shareable half of the client logic | Regulations three-tier client, offline resolver, tile math, and state models written **once** in Kotlin and shared to both platforms; UI stays SwiftUI and Compose; each side calls its own first-party SDK | Adds a build-system and tooling dimension; iOS developers work in Kotlin for the shared layer; smaller hiring pool; the shared layer is the non-UI half, so map and card work is still per-platform. (The Kotlin SDK itself is Android-only — KMP shares logic, not the map.) |
| **Invest in the current stack** | Nearly all of it | Cheapest by a wide margin; one codebase keeps serving web and both stores; background location, better native chrome, and most store-integration gaps are reachable with targeted plugins | Does not deliver offline feature layers, widgets, Wallet, or App Intents; ceiling on map performance with large feature counts; remains a web view to reviewers and to some stakeholders |
| **Native shell, incremental adoption** | Most of it, temporarily | Ship the native map and field tools first, keep content-heavy screens as web views, replace them over time; de-risks the schedule | Two paradigms in one app, two navigation models to reconcile, and a seam that tends to become permanent |
| **React Native / Expo** | Contracts, data, and React familiarity | Closest to the current team's idiom; the React component model and much of the product logic carry over conceptually | **No first-party ArcGIS SDK** — the map, the largest and most technical part of this product, would ride on a community wrapper or a bridge FWP maintains, plus more bridging for offline tiles and filesystem work. The familiarity advantage does not extend to the part that matters most |
| **iOS first, Android later** | Everything, deferred | Halves the near-term scope; proves the architecture on one platform before doubling it | Montana's user base is not iOS-majority; leaves a large audience on the current app indefinitely, which makes the web application decision (§7) sharper, not softer |

**A reasonable reading of this table:** there are four serious candidates —
Swift + Kotlin, Flutter, Kotlin Multiplatform, and investing in the current
stack — and they trade the same two things against each other: *how much is
written once* versus *how mature and complete the platform is*. Swift + Kotlin
sits at one end (most duplication, most maturity, deepest platform reach);
Flutter sits at the other (least duplication, a first-party SDK that is
capable but still filling in); KMP splits the difference on the non-map half.
React Native is the one option the map argues against.

The practical recommendation is not to pick from this page but to make it a
short, explicit item in the assessment phase: confirm against Esri's current
parity page whether anything Engage MT needs is still outstanding on Flutter,
weigh that against the roughly halved UI and test surface, and record the
reasoning. Two native apps is the safe, fully-supported default and a
defensible answer; Flutter is the one that could materially reduce the build if
the parity check comes back clean. Investing in the current stack remains the
honest low-cost comparator any business case should be measured against.

---

## 7. The web application

A native iOS and Android track describes the mobile surface. The public web
application — which is today the *same* application — is a separate question,
and it should be answered deliberately rather than by omission.

**What the web surface currently is.** The whole product. `mobile/` is a wrapper
around `web/dist`; the browser app is not a companion to the mobile app, it is
the source of it. It is also the only surface with no install friction, the one
that works on a desk at a regional office, the one reachable from a link in an
FWP email or a search result, and the one available to users who will not or
cannot install an app. It runs standalone with no server, falling back to a
bundled regulations snapshot.

**What happens to it under a native build.** The Capacitor wrapper retires
cleanly; `web/` does not. Three futures, each with consequences:

| Option | Consequence |
|---|---|
| **Keep and maintain it** | Three clients, three release cadences, and a standing parity policy is required from day one. Costs the most, preserves the most reach. |
| **Freeze it as a reduced public surface** | Keep regulations lookup, district search, and public-land maps on the web; let the field tools (waypoints, tracks, offline packs) be app-only. Cheapest honest answer; needs an explicit feature-parity statement so users are not surprised. |
| **Retire it** | Everything becomes app-only. Loses the no-install audience and the desktop use case entirely. Should not happen by default. |

**The part that is time-sensitive.** Divergence begins the day native
development starts. If the web app keeps shipping features during a native MVP
build, the native apps are chasing a moving target; if it is frozen without
saying so, users notice before anyone announces it. Naming the option above
during planning costs an hour; discovering it in month three costs a
re-plan.

**What is not in question:** the staff console (`staff/`) stays a web
application, and the regulations API stays the shared backend for every client.
Those are the contracts that keep whatever surfaces exist consistent — together
with the shared map service from §5, they are the whole integration story.

---

## 8. Honest comparison — today versus native

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

### 8.2 What a native build is expected to add

| Capability | Why native helps |
|---|---|
| Background track recording | Removes the foreground-only limit. Available with a background-geolocation approach on the current stack too, but natively it is first-party and better supported. Still carries an Android foreground service with a permanent notification, iOS always-on authorization, and store-review justification on both platforms. |
| Push notifications and geofenced alerts | Platform-idiomatic once the backend exists. **Note:** push is a backend and credential gap, not a client-technology gap — it needs FWP-provisioned Apple and Firebase credentials plus a sender, and those are the same work regardless of client. OS geofencing remains capped at 20 monitored regions on iOS and 100 on Android for native and hybrid apps alike, so covering arbitrary district or closure polygons stays a design problem. |
| Offline feature layers | Genuinely better — **if** §5 happens. Supported by every SDK in the Native Apps family at the free Lite license level, so it is gated on a published map, not on which client language wins. |
| Map performance and memory | Real gains on large feature counts and long sessions. |
| Platform integration | Wallet passes for licenses, widgets, App Intents / Siri, Live Activities, Android Auto and CarPlay, share-sheet extensions. None of these are reachable from the current stack. |
| Accessibility ceiling | Native VoiceOver and TalkBack semantics, Dynamic Type, and system-level controls exceed what a web view offers — though the current build is already axe-verified and keyboard-walked, so this is a raised ceiling, not a fixed defect. |
| Store and OS posture | First-class platform citizenship: review, privacy labels, and OS updates behave as reviewers and users expect. |

### 8.3 What gets harder, and should be planned for

- **Two codebases become three surfaces** (iOS, Android, and whatever §6
  decides about web). Every feature is specified once and built two or three
  times.
- **The 47 layers and 28 cards are re-expressed per platform** unless the shared
  map service lands first.
- **The test suite and the 12 audit gates do not port.** Rebuilding equivalent
  confidence is a deliverable.
- **Release cadence changes.** A web deploy becomes two store submissions with
  review latency, and a regulations-season fix has to clear both.
- **The privacy posture must be re-established deliberately.** It is currently
  structural — there is no analytics SDK to disable because none is installed.
  In a new codebase that is a policy decision someone has to keep making.

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

**Phase 1 — assess and decide (the phase that determines the cost of the other two)**

- Read the seams in §2 and confirm the API and registry contracts hold.
- **Decide the shared map service (§5) and name its owner.** Everything in the
  map track depends on this answer.
- **Decide the web application's future (§7)** and publish the parity policy.
- **Confirm the client stack (§6).** Check Esri's current Flutter parity page
  against what Engage MT actually needs, and record why the chosen stack won.
- Confirm the Esri license level and account type — a Lite license string is
  free and covers what this app does; verify nothing in the target design
  pushes it to Basic or Standard.
- Resolve the MyFWP sign-in dependency or scope the MVP around the stub.
- Agree what "MVP" contains against §8.1 — what of today's behavior must exist
  on day one, and what is explicitly deferred.
- Stand up the native test and CI skeleton before feature work, so §8.3 does not
  land in month three.

**Phase 2 — build the core**

- Map, layers, and tap-to-query against the shared map item.
- Hunt tab: district browsing and the three-tier regulations client.
- Offline: basemap areas, and feature layers if §5 landed.
- Field tools and the native capability set.
- Port the feature cards in priority order; the registry tells you which are
  most used.

**Phase 3 — validate and ship**

- Parity checklist against §8.1, item by item, on both platforms.
- Accessibility validation with VoiceOver and TalkBack, not just automated checks.
- Privacy labels and data-safety declarations consistent with the actual behavior.
- Store submission, and a knowledge-transfer pass to whoever maintains it next.

---

## 10. Decisions FWP owns

Collected here so they land in the right risk register rather than in a
developer's inbox:

1. **Shared map service** — build it, who owns it, and whether it is referenced
   or hosted per layer. (§5)
2. **Web application future** — keep, reduce, or retire, and the parity policy
   during the build. (§6)
3. **Esri licensing and hosting** — confirm the license level (Lite is free and
   likely sufficient), the account type, and who pays the ArcGIS Online credits
   or Enterprise capacity for hosted layers and offline map area generation.
4. **MyFWP OAuth** — endpoint availability and the license wallet contract.
5. **Push and notifications** — Apple and Firebase credentials, a sender, and
   the policy for what the app is allowed to tell users.
6. **Background location** — whether the product wants it, given the permission
   prompts and store-review obligations it brings.
7. **Privacy posture** — whether "no telemetry, location never leaves the
   device" is a standing requirement for the native apps, stated up front.
8. **Hosting** — where the regulations API and database live long-term.
9. **Third-party layer terms** — per-source, for anything rehosted or
   re-published under FWP branding.

---

## 11. Where to look in this repository

| Question | File |
|---|---|
| The same migration as a single Flutter codebase | [FLUTTER_MIGRATION_GUIDE.md](FLUTTER_MIGRATION_GUIDE.md) |
| What are the pieces and how big is each? | [codebase-overview.md](codebase-overview.md) |
| How is it built? | [architecture.md](architecture.md) |
| How do I run, test, and change it? | [development.md](development.md) |
| Every document, indexed | [DOCS.md](../DOCS.md) |
| Map layer definitions | `web/src/config/layers/` and `web/src/config/layers.ts` |
| The regulations-to-geography join | `shared/src/arcgisLayers.ts` |
| Feature card renderers | `web/src/components/map/featureCards/` |
| Offline tile sources and zoom bounds | `web/src/config/offlineBasemaps.ts` |
| Regulations API | [regs-manager/api.md](regs-manager/api.md) |
| Seams awaiting FWP systems | [stubs/README.md](stubs/README.md) |
| Mobile build and store release | [mobile/README.md](mobile/README.md) |
| Engineering conventions by domain | [rules/](rules/README.md) |
| Deployment and data operations | [deploy/README.md](deploy/README.md) |

---

### External references

Every claim in this document about Esri's SDKs is checkable at these pages.
They move — re-check them at assessment time rather than trusting this
snapshot, which was taken 2026-09-14.

| Claim in this document | Source |
|---|---|
| The Native Apps SDK family is Swift, Kotlin, .NET, Qt, and Flutter | [ArcGIS Maps SDKs for Native Apps](https://developers.arcgis.com/documentation/glossary/arcgis-maps-sdks-for-native-apps/) |
| Flutter SDK exists, is first-party, and its current capabilities | [ArcGIS Maps SDK for Flutter](https://developers.arcgis.com/flutter/) |
| Flutter is not yet at full parity; what is still coming | [Flutter Maps SDK parity](https://developers.arcgis.com/flutter/parity/) |
| Offline map areas — preplanned and on-demand — are supported | [Offline maps, scenes, and data](https://developers.arcgis.com/flutter/offline-maps-scenes-and-data/) |
| A license string is required for deployment and is distinct from an API key | [Get a license](https://developers.arcgis.com/swift/license-and-deployment/get-a-license/) |
| Lite is free and covers offline; Basic and Standard thresholds | [License levels and capabilities](https://developers.arcgis.com/swift/license-and-deployment/license-levels-and-capabilities/) |
| No first-party React Native SDK | Absence from the Native Apps family list above |

Platform geofencing limits (20 monitored regions on iOS, 100 on Android) come
from Apple's Core Location and Android's geofencing documentation respectively;
they are platform ceilings and apply to native and hybrid apps alike.

---

*Engage MT is MIT licensed. Reuse of any part of this codebase — in a native
rewrite or anywhere else — carries no restriction beyond attribution.*
