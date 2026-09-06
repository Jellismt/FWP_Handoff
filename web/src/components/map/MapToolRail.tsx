/**
 * @file MapToolRail.tsx
 * @module engage-mt/map
 * @description Floating map tool rail. Primary one-tap controls (Locate ·
 *              Basemap) sit as direct glass-morphic yellow pills; secondary tools
 *              collapse into labelled, expandable clusters (Markup · Measure ·
 *              Capture) in the modern outdoor-app idiom. Each pill wraps a
 *              Lucide icon so it renders crisply on any basemap without Calcite
 *              icon assets.
 *
 *              Web vs mobile: the web app is a *planning*
 *              surface — plan by drawing and measuring — so GPS track recording
 *              and offline downloads are gated behind `supportsGpsCapture()` /
 *              `supportsOfflineDownload()` and appear only in the Capacitor app,
 *              where GPS + storage are real. Dropping a WAYPOINT is available on
 *              web too: the pin saves in the browser and is handed to
 *              the phone via send-to-phone. So on web the Capture cluster is
 *              absent but Drop-waypoint stays in Markup — a clean planning
 *              toolset, not a graveyard of dead buttons.
 *
 * The canvas draw + measure tools
 *              require pointer input; keyboard + SR users get the same outcome
 *              via the Keyboard-entry item (CoordinateEntryDialog): type
 *              vertices, pick polygon/line/distance/area, save. Output lands in
 *              `useFieldToolsStore` identically to the canvas-driven flow.
 * @author Jamie Ellis / Engage MT
 * @created 2026-05-29
 * @updated 2026-07-14
 * @version 2.0.1
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { useMemo, useRef, useState } from "react";
import {
  Circle,
  Download,
  Eye,
  EyeOff,
  Keyboard,
  MapPin,
  Navigation,
  Loader2,
  Pencil,
  Ruler,
  Spline,
  Square,
} from "lucide-react";
import { useMapInteractionStore, type MapTool } from "@/store/map/mapInteractionStore";
import { useUserGraphicsVisibleStore } from "@/store/field/userGraphicsVisibleStore";
import { useTrackRecorderStore } from "@/services/field/trackRecorder";
import { impact } from "@/services/mobile/haptics";
import { supportsGpsCapture, supportsOfflineDownload } from "@/utils/capacitor";
import { useLocate } from "@/hooks/useLocate";
import { useRovingTabindex } from "@/hooks/useRovingTabindex";
import { useToast } from "@/hooks/useToast";
import { useMapNavigation } from "@/hooks/useMapNavigation";
import { Tooltip } from "@/components/shared/overlays/Tooltip";
import { TOOLTIPS } from "@/copy/tooltips";
import { CoordinateEntryDialog } from "./CoordinateEntryDialog";
import { BasemapPicker } from "./BasemapPicker";
import { ToolCluster, type ToolClusterItem } from "./ToolCluster";
import "./MapToolRail.css";

interface ToolButtonProps {
  /** Short verb phrase used for the SR-only aria-label ("Locate me"). */
  ariaLabel: string;
  /** Full plain-English explanation shown on hover via the shared
   *  Tooltip component (from the TOOLTIPS catalog in copy/tooltips.ts). */
  tooltip: string;
  icon: React.ReactNode;
  active?: boolean;
  onClick: () => void | Promise<void>;
}

const ToolButton = ({
  ariaLabel,
  tooltip,
  icon,
  active,
  onClick,
}: ToolButtonProps): JSX.Element => (
  <Tooltip content={tooltip} placement="left">
    <button
      type="button"
      className={`map-tool-rail__button ${active ? "map-tool-rail__button--active" : ""}`}
      onClick={() => void onClick()}
      aria-label={ariaLabel}
      aria-pressed={active}
    >
      {icon}
    </button>
  </Tooltip>
);

/** Inline component for the user-graphics visibility toggle. */
const UserGraphicsToggle = (): JSX.Element => {
  const visible = useUserGraphicsVisibleStore((s) => s.visible);
  const toggle = useUserGraphicsVisibleStore((s) => s.toggle);
  return (
    <ToolButton
      ariaLabel={visible ? "Hide my pins" : "Show my pins"}
      tooltip={
        visible
          ? "Hide your saved waypoints, tracks, and shapes to inspect the operational map underneath. Recording stays visible."
          : "Show your saved waypoints, tracks, and shapes again."
      }
      icon={
        visible ? <Eye size={18} strokeWidth={2.25} /> : <EyeOff size={18} strokeWidth={2.25} />
      }
      active={!visible}
      onClick={toggle}
    />
  );
};

export const MapToolRail = (): JSX.Element => {
  const railRef = useRef<HTMLDivElement>(null);
  // The rail is one Tab stop; arrows move between its pills.
  const roving = useRovingTabindex(railRef, { orientation: "both" });
  const { state, locate } = useLocate();
  const { show } = useToast();
  const { flyTo } = useMapNavigation();
  const [locating, setLocating] = useState(false);
  const [coordEntryOpen, setCoordEntryOpen] = useState(false);
  const activeTool = useMapInteractionStore((s) => s.activeTool);
  const setActiveTool = useMapInteractionStore((s) => s.setActiveTool);
  const toggleTool = (tool: MapTool): void => setActiveTool(activeTool === tool ? "none" : tool);

  // GPS track recording + offline downloads are mobile-only.
  // Dropping a WAYPOINT is NOT gated anymore — web users plan a pin and send it
  // to their phone. Resolved once per render; the predicates read the Capacitor
  // global, which is stable for a session.
  const gpsCaptureEnabled = supportsGpsCapture();
  const offlineEnabled = supportsOfflineDownload();

  const recorderStatus = useTrackRecorderStore((s) => s.status);
  const startRecording = useTrackRecorderStore((s) => s.start);
  const recording = recorderStatus === "recording";
  const paused = recorderStatus === "paused";
  const recorderLive = recording || paused;

  // Preselect the dialog's operation to match whichever draw/measure tool the
  // user already had active — a sighted user who switches to keyboard entry
  // mid-flow shouldn't have to re-pick the operation.
  const coordEntryInitialOp = useMemo<"polygon" | "polyline" | "distance" | "area">(() => {
    if (activeTool === "draw-polygon") return "polygon";
    if (activeTool === "draw-polyline") return "polyline";
    if (activeTool === "measure-area") return "area";
    return "distance";
  }, [activeTool]);

  // --- Markup cluster: draw shape / line, drop waypoint (mobile), keyboard entry.
  const markupItems: ToolClusterItem[] = [
    {
      key: "draw-polygon",
      label: "Draw a shape",
      hint: TOOLTIPS.mapToolDrawShape,
      icon: <Pencil size={18} strokeWidth={2.25} aria-hidden />,
      checked: activeTool === "draw-polygon",
      onSelect: () => toggleTool("draw-polygon"),
    },
    {
      key: "draw-polyline",
      label: "Draw a line",
      hint: TOOLTIPS.mapToolDrawLine,
      icon: <Spline size={18} strokeWidth={2.25} aria-hidden />,
      checked: activeTool === "draw-polyline",
      onSelect: () => toggleTool("draw-polyline"),
    },
    // Drop-waypoint is available on web + mobile. On web the pin is
    // saved in this browser and can be sent to your phone from Field Tools.
    {
      key: "drop-waypoint",
      label: "Drop a waypoint",
      hint: TOOLTIPS.mapToolWaypoint,
      icon: <MapPin size={18} strokeWidth={2.25} aria-hidden />,
      checked: activeTool === "drop-waypoint",
      onSelect: () => toggleTool("drop-waypoint"),
    },
    {
      key: "keyboard-entry",
      label: "Enter coordinates",
      hint: TOOLTIPS.mapToolCoordinateEntry,
      icon: <Keyboard size={18} strokeWidth={2.25} aria-hidden />,
      onSelect: () => setCoordEntryOpen(true),
    },
  ];
  const markupActive =
    activeTool === "draw-polygon" ||
    activeTool === "draw-polyline" ||
    activeTool === "drop-waypoint";

  // --- Measure cluster: distance / area.
  const measureItems: ToolClusterItem[] = [
    {
      key: "measure-distance",
      label: "Measure distance",
      hint: TOOLTIPS.mapToolMeasure,
      icon: <Ruler size={18} strokeWidth={2.25} aria-hidden />,
      checked: activeTool === "measure-distance",
      onSelect: () => toggleTool("measure-distance"),
    },
    {
      key: "measure-area",
      label: "Measure area",
      hint: TOOLTIPS.mapToolMeasureArea,
      icon: <Square size={18} strokeWidth={2.25} aria-hidden />,
      checked: activeTool === "measure-area",
      onSelect: () => toggleTool("measure-area"),
    },
  ];
  const measureActive = activeTool === "measure-distance" || activeTool === "measure-area";

  // --- Capture cluster (mobile only): record a GPS track, download an area.
  const captureItems: ToolClusterItem[] = [
    {
      key: "record-track",
      label: recorderLive ? (recording ? "Recording a track" : "Track paused") : "Record a track",
      hint: recorderLive
        ? "Use the tracker card on the map to pause, stop, or save it."
        : "Walk your route and save it as a track. Stays on this device.",
      icon: (
        <Circle
          size={18}
          strokeWidth={2.5}
          fill={recorderLive ? "currentColor" : "none"}
          aria-hidden
        />
      ),
      rowClassName: recording
        ? "tool-cluster__item--recording"
        : paused
          ? "tool-cluster__item--paused"
          : undefined,
      // While live the on-map HUD owns stop — a rail tap must never lose a
      // track by accident, so it's a no-op that keeps the menu open.
      keepOpen: recorderLive,
      onSelect: () => {
        if (recorderStatus !== "idle") return;
        void impact("medium");
        startRecording();
      },
    },
    ...(offlineEnabled
      ? [
          {
            key: "select-offline-aoi",
            label: "Download this area",
            hint: TOOLTIPS.mapToolOfflineArea,
            icon: <Download size={18} strokeWidth={2.25} aria-hidden />,
            checked: activeTool === "select-offline-aoi",
            onSelect: () => toggleTool("select-offline-aoi"),
          } satisfies ToolClusterItem,
        ]
      : []),
  ];
  const captureActive = recorderLive || activeTool === "select-offline-aoi";
  const captureTriggerClassName = recording
    ? "map-tool-rail__button--recording"
    : paused
      ? "map-tool-rail__button--paused"
      : undefined;

  const onLocate = async (): Promise<void> => {
    setLocating(true);
    try {
      await locate();
      if (state.error) {
        show({
          kind: "warning",
          title: "Couldn't get your location",
          message: state.error.message,
        });
        return;
      }
      if (state.coords) {
        flyTo({ lat: state.coords.lat, lon: state.coords.lon, zoom: 14 });
      }
    } finally {
      setLocating(false);
    }
  };

  return (
    <div
      ref={railRef}
      className="map-tool-rail"
      role="toolbar"
      aria-label="Map tools"
      aria-orientation="vertical"
      {...roving}
    >
      {/* Primary controls — one-tap essentials stay as direct pills. */}
      <ToolButton
        ariaLabel="Find your location"
        tooltip={TOOLTIPS.mapToolLocate}
        icon={
          locating || state.loading ? (
            <Loader2 size={18} strokeWidth={2.25} className="map-tool-rail__spin" />
          ) : (
            <Navigation size={18} strokeWidth={2.25} />
          )
        }
        onClick={onLocate}
      />
      <BasemapPicker />

      {/* Grouped tool clusters (modern outdoor-app pattern). */}
      <ToolCluster
        label="Markup"
        tooltip={TOOLTIPS.mapClusterMarkup}
        icon={<Pencil size={18} strokeWidth={2.25} />}
        active={markupActive}
        items={markupItems}
      />
      <ToolCluster
        label="Measure"
        tooltip={TOOLTIPS.mapClusterMeasure}
        icon={<Ruler size={18} strokeWidth={2.25} />}
        active={measureActive}
        items={measureItems}
      />
      {/* Capture cluster — record a track / download offline. Mobile only:
          these need real on-device GPS + storage. */}
      {gpsCaptureEnabled && (
        <ToolCluster
          label="Capture"
          tooltip={TOOLTIPS.mapClusterCapture}
          icon={
            <Circle size={18} strokeWidth={2.5} fill={recorderLive ? "currentColor" : "none"} />
          }
          active={captureActive}
          triggerClassName={captureTriggerClassName}
          items={captureItems}
        />
      )}

      {/* "Hide my pins" toggle stays a direct pill: it's a frequent
          quick action while inspecting the operational map underneath. */}
      <UserGraphicsToggle />

      <CoordinateEntryDialog
        open={coordEntryOpen}
        initialOperation={coordEntryInitialOp}
        onClose={() => setCoordEntryOpen(false)}
      />
    </div>
  );
};
