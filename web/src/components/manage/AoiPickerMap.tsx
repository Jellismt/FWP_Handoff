/**
 * @file AoiPickerMap.tsx
 * @module engage-mt/manage
 * @description Small Montana-scoped ArcGIS map for picking an offline-map Area
 *              of Interest by drawing a rectangle, embedded in the Offline Maps
 *              page. Two taps draw a box (via the shared attachAoiRectangle
 *              helper); the resulting bbox is reported up through `onChange`.
 *              The committed bbox is also rendered back as a solid rectangle, so
 *              editing the page's number fields redraws the box — the map and
 *              the inputs are two controlled views of one bbox. The number
 *              fields remain the keyboard / screen-reader equivalent of drawing.
 *
 *              Self-contained: owns its own Map + MapView (not the app's primary
 *              view) so it can mount/unmount with the page section. Privacy: no
 *              user location; the bbox stays on-device.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-30
 * @updated 2026-06-30
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { useEffect, useRef } from "react";
import EsriMap from "@arcgis/core/Map";
import EsriBasemap from "@arcgis/core/Basemap";
import EsriMapView from "@arcgis/core/views/MapView";
import Extent from "@arcgis/core/geometry/Extent";
import GraphicsLayer from "@arcgis/core/layers/GraphicsLayer";
import Graphic from "@arcgis/core/Graphic";
import Polygon from "@arcgis/core/geometry/Polygon";
import { MONTANA_CONSTRAINT_EXTENT } from "@/data/montanaBoundary";
import {
  DEFAULT_CENTER,
  DEFAULT_ZOOM,
  MIN_ZOOM,
  MAX_ZOOM,
} from "@/components/map/mapViewConstants";
import { attachAoiRectangle } from "@/components/map/attachAoiRectangle";
import { bboxRing, type AoiBbox } from "@/services/map/aoiGeometry";
import "./AoiPickerMap.css";

// Solid committed-selection box: FWP gold outline + faint fill. Distinct from
// the dashed in-progress draw preview owned by attachAoiRectangle.
const SELECTION_FILL: [number, number, number, number] = [255, 199, 44, 0.12];
const SELECTION_OUTLINE: [number, number, number, number] = [212, 145, 35, 1];

interface Props {
  /** The current bbox (also bound to the page's number fields). */
  value: AoiBbox;
  /** Called when the user finishes drawing a new box. */
  onChange: (bbox: AoiBbox) => void;
}

export const AoiPickerMap = ({ value, onChange }: Props): JSX.Element => {
  const containerRef = useRef<HTMLDivElement>(null);
  const selectionLayerRef = useRef<GraphicsLayer | null>(null);
  // Hold the latest onChange without re-running the mount effect.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Mount the view once.
  useEffect(() => {
    if (!containerRef.current) return;

    const selectionLayer = new GraphicsLayer({ id: "engage-mt-aoi-selection", listMode: "hide" });
    selectionLayerRef.current = selectionLayer;

    const map = new EsriMap({
      basemap: EsriBasemap.fromId("topo-vector") ?? ("topo-vector" as never),
      layers: [selectionLayer],
    });

    const view = new EsriMapView({
      container: containerRef.current,
      map,
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      constraints: {
        minZoom: MIN_ZOOM,
        maxZoom: MAX_ZOOM,
        geometry: new Extent(MONTANA_CONSTRAINT_EXTENT),
        rotationEnabled: false,
      },
    });
    (view as unknown as { popupEnabled: boolean }).popupEnabled = false;

    const detachAoi = attachAoiRectangle(view, {
      onComplete: (bbox) => onChangeRef.current(bbox),
    });

    return () => {
      detachAoi();
      selectionLayerRef.current = null;
      view.destroy();
    };
  }, []);

  // Redraw the committed-selection rectangle whenever the bound bbox changes
  // (either from a fresh draw or from the page's number-field edits).
  useEffect(() => {
    const layer = selectionLayerRef.current;
    if (!layer) return;
    layer.removeAll();
    layer.add(
      new Graphic({
        geometry: new Polygon({
          rings: [bboxRing(value)],
          spatialReference: { wkid: 4326 },
        }),
        symbol: {
          type: "simple-fill" as const,
          color: SELECTION_FILL,
          outline: { color: SELECTION_OUTLINE, width: 2 },
        },
      }),
    );
  }, [value]);

  return (
    <div
      ref={containerRef}
      className="aoi-picker-map"
      role="application"
      aria-label="Draw an offline area on the map — tap two corners to set a box. Keyboard users can use the coordinate fields below instead."
    />
  );
};
