/**
 * @file index.ts
 * @module engage-mt/map/featureCards
 * @description Barrel that side-effect-imports every Tier-2 renderer so they register
 *              themselves before TapQueryPanel resolves layers. Add new renderers here.
 * @author Jamie Ellis / Engage MT
 * @created 2026-05-29
 * @updated 2026-07-15
 * @version 2.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import "@/components/map/featureCards/cards/BmaCard";
import "@/components/map/featureCards/cards/PublicLandOwnershipHintCard";
import "@/components/map/featureCards/cards/FasCard";
import "@/components/map/featureCards/cards/HuntingDistrictCard";
import "@/components/map/featureCards/cards/ActiveFireCard";
import "@/components/map/featureCards/cards/WmaCard";
import "@/components/map/featureCards/cards/StateParkCard";
import "@/components/map/featureCards/cards/AisStationCard";
// CWD check-station POINT layer. Reference group, default-visible.
import "@/components/map/featureCards/cards/CwdCheckStationCard";
// FWP public-data integration — warden districts, license ambassadors, and
// live waterbody closures, all from FWP's public hosted org.
import "@/components/map/featureCards/cards/WardenCard";
import "@/components/map/featureCards/cards/LicenseAmbassadorCard";
import "@/components/map/featureCards/cards/WaterbodyClosureCard";
// GageCard registers `usgs-gages` / `dnrc-stage-gages` — a deliberately
// minimal two-number popup (flow + temp).
import "@/components/map/featureCards/cards/GageCard";
import "@/components/map/featureCards/cards/CadastralCard";
import "@/components/map/featureCards/cards/NhdStreamCard";
import "@/components/map/featureCards/cards/WeatherStationCard";
import "@/components/map/featureCards/cards/WindStationCard";
import "@/components/map/featureCards/cards/AccessProgramCard";
import "@/components/map/featureCards/cards/ConservationLayerCard";
import "@/components/map/featureCards/cards/RoadCard";
import "@/components/map/featureCards/cards/AdminBoundaryCard";
// DNRC State Trust Land access classification renderer.
import "@/components/map/featureCards/cards/BlmRecCard";
import "@/components/map/featureCards/cards/UsfsRecCard";
import "@/components/map/featureCards/cards/BorRecCard";
// User-created field tools (waypoints / tracks / shapes).
// The map dispatches synthetic layer ids (`engage-mt-field-waypoint` /
// `engage-mt-field-track` / `engage-mt-field-shape`) for hits on the
// always-on field-tools GraphicsLayer.
import "@/components/map/featureCards/cards/WaypointCard";
import "@/components/map/featureCards/cards/TrackCard";
import "@/components/map/featureCards/cards/ShapeCard";
// Trail Explorer — unified TrailCard registered against the authoritative
// trail layer ids (USFS, NPS Glacier, NPS Yellowstone, Lewis & Clark,
// Missoula County, Bozeman GVLT).
import "@/components/map/featureCards/cards/TrailCard";

export { FeatureCard } from "@/components/map/featureCards/core/FeatureCard";
export { resolveFeature, registeredLayerIds } from "@/components/map/featureCards/core/registry";
