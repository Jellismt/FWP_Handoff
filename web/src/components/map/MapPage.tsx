/**
 * @file MapPage.tsx
 * @module engage-mt/map
 * @description Default landing route. Composes the MapView with the LayerPanel +
 *              tap-query.
 * @author Jamie Ellis / Engage MT
 * @created 2026-05-29
 * @updated 2026-07-15
 * @version 2.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { useCallback, useEffect, useState } from "react";
import { CalciteShell } from "@esri/calcite-components-react";
import { useSearchParams } from "react-router-dom";
import { useLayerVisibilityStore } from "@/store/map/layerVisibilityStore";
import { useMapInteractionStore, type MapTool } from "@/store/map/mapInteractionStore";
import { useHighlightedFeatureStore } from "@/store/map/highlightedFeatureStore";
import { MapView } from "./MapView";
import { LayerPanel } from "./LayerPanel";
import { MapToolRail } from "./MapToolRail";
import { TapQueryPanel, type TapQueryResult, type TapQueryMore } from "./TapQueryPanel";
import type { TapPoint } from "./featureCards/core/types";
import { OfflineAoiConfirmSheet } from "./OfflineAoiConfirmSheet";
import { ToolIntroExplainer } from "./ToolIntroExplainer";
import { RecordingStatusChip } from "@/components/field/RecordingStatusChip";
import { supportsGpsCapture } from "@/utils/capacitor";
import "./MapPage.css";

export const MapPage = (): JSX.Element => {
  const [queryResults, setQueryResults] = useState<TapQueryResult[] | null>(null);
  // Cached tap point so the right-rail card's enrichment block
  // can derive lat/lon, UTM, county, FWP region, etc. without reaching
  // back into the map view. Cleared in lockstep with queryResults.
  const [tapPoint, setTapPoint] = useState<TapPoint | null>(null);
  // "N more features here" payload for the current tap.
  const [more, setMore] = useState<TapQueryMore | null>(null);

  // One tap-result handler feeding the panel + highlight-clear behavior. The
  // view reads it through a latest-callback ref, so a stable identity isn't
  // required — but useCallback keeps it tidy.
  const handleQueryResults = useCallback(
    (results: TapQueryResult[], point: TapPoint | null, morePayload?: TapQueryMore | null) => {
      setQueryResults(results);
      setTapPoint(point);
      setMore(morePayload ?? null);
      // An empty tap clears the persistent parcel highlight the
      // previous tap set (runTapQuery only sets it on a hit).
      if (results.length === 0) {
        useHighlightedFeatureStore.getState().clear();
      }
    },
    [],
  );

  // Deep-link layer toggles. Two flavors, both consumed once + stripped to
  // keep the URL clean:
  //   • "/?focus=<id>"  — SOLO: turn this layer on and every other off. Used by
  //     "open the map with only this layer" tool cards (Fishing Access Sites,
  //     State Parks, WMAs, BMA, cadastral, hunting districts). Composite-aware.
  // • "/?layer=<id>" — additive: turn this layer on, leave the rest
  //     as-is. Kept for back-compat.
  const [searchParams, setSearchParams] = useSearchParams();
  const setVisible = useLayerVisibilityStore((s) => s.setVisible);
  const soloLayer = useLayerVisibilityStore((s) => s.soloLayer);
  const setActiveTool = useMapInteractionStore((s) => s.setActiveTool);

  // Deep-link a map tool — "/?tool=<id>" activates that map tool on arrival.
  // Consumed once + stripped to keep the URL clean.
  useEffect(() => {
    const tool = searchParams.get("tool");
    if (!tool) return;
    setActiveTool(tool as MapTool);
    searchParams.delete("tool");
    setSearchParams(searchParams, { replace: true });
  }, [searchParams, setActiveTool, setSearchParams]);

  useEffect(() => {
    const focus = searchParams.get("focus");
    if (focus) {
      soloLayer(focus);
      searchParams.delete("focus");
      setSearchParams(searchParams, { replace: true });
      return;
    }
    const requested = searchParams.get("layer");
    if (!requested) return;
    setVisible(requested, true);
    searchParams.delete("layer");
    setSearchParams(searchParams, { replace: true });
  }, [searchParams, soloLayer, setVisible, setSearchParams]);

  return (
    <CalciteShell className="map-page">
      <div className="map-page__canvas" slot="">
        {/* The map IS the page's content but paints to a canvas, so the document
            still needs a level-one heading for screen-reader users and the axe
            `page-has-heading-one` rule. Visually hidden — the map is the visual. */}
        <h1 className="fwp-sr-only">Montana map — layers, access, and live conditions</h1>
        <MapView onQueryResults={handleQueryResults} />
        <div className="map-page__overlay map-page__overlay--top-left">
          <LayerPanel />
        </div>
        {/* Live track-recording HUD. Self-renders null
            when the recorder is idle; otherwise floats top-right over the
            map with live distance/duration/gain AND the Pause / Resume /
            Stop & save controls, so a recording runs without leaving the
            map. Started from the Capture cluster on the tool rail.
            GPS track recording is mobile-only, so the HUD
            never mounts on web (a planning surface). */}
        {supportsGpsCapture() && (
          <div className="map-page__overlay map-page__overlay--top-right">
            <RecordingStatusChip />
          </div>
        )}
        {/* Closeable intro card for map-first tools,
            shown when a tool opens the map via "&intro=<toolId>". Non-blocking
            (the user can still pan + tap). Self-renders null with no intro
            param or once dismissed. */}
        <ToolIntroExplainer />
      </div>
      {/* Map-tool rail relocated from a floating right-edge
          column to a white horizontally-scrollable strip pinned between
          the map and the bottom tab bar. Same buttons, same behavior;
          better thumb reach on phones + clearer affordance on desktop. */}
      <div className="map-page__tool-strip">
        <MapToolRail />
      </div>
      {/* `active` is unconditional: the panel only renders content when
          `results` is non-empty, so an always-true `active` is inert until a
          tap lands. */}
      <TapQueryPanel
        results={queryResults}
        tapPoint={tapPoint}
        more={more}
        onClose={() => {
          setQueryResults(null);
          setTapPoint(null);
          setMore(null);
          // The persistent highlight lives for the panel's lifetime.
          useHighlightedFeatureStore.getState().clear();
        }}
        active={true}
      />
      {/* Offline AOI confirm dialog — self-renders null unless a "Download this
          area" box was just drawn (offlineAoiDraftStore). */}
      <OfflineAoiConfirmSheet />
    </CalciteShell>
  );
};
