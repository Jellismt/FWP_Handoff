/**
 * @file ShapeCard.tsx
 * @module engage-mt/map/featureCards
 * @description Tier-2 renderer for user-drawn shapes
 *              (synthetic layer id `engage-mt-field-shape`).
 *
 *              Hero shows shape area / length as
 *              the dominant metric (the most useful thing about a drawn
 *              shape), with the name + color swatch in supporting badges.
 *              Mutations go through the new `updateShape` store action.
 *              Card-level Actions gain Open-in-Field-Tools and a properly-
 *              worded two-step Delete.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-09
 * @updated 2026-07-03
 * @version 1.1.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { useEffect, useRef, useState } from "react";
import { formatFullDate } from "@/utils/formatDate";
import { useNavigate } from "react-router-dom";
import {
  Calendar,
  Edit3,
  ExternalLink,
  Hash,
  Palette,
  Ruler,
  Save,
  Share2,
  Shapes,
  Trash2,
  X,
} from "lucide-react";
import {
  BadgeRow,
  HeroBlock,
  KeyValueRow,
  MetricGrid,
  MetricPill,
  Paragraph,
} from "@/components/map/featureCards/core/cardPrimitives";
import { registerFeature } from "@/components/map/featureCards/core/registry";
import type { FeatureRendererProps } from "@/components/map/featureCards/core/types";
import { useFieldToolsStore, type DrawnShape } from "@/store/field/fieldToolsStore";
import { PillButton } from "@/components/shared/forms/PillButton";
import { useTakeoverPopupStore } from "@/store/map/takeoverPopupStore";
import { buildPinSharePayload, share } from "@/services/mobile/shareService";
import { createLogger } from "@/utils/logger";
import "./WaypointCard.css";

const log = createLogger("shape-card");

const SHAPE_LABEL: Record<DrawnShape["shape"], string> = {
  polygon: "Polygon",
  polyline: "Polyline",
  rectangle: "Rectangle",
  circle: "Circle",
};

/** Equirectangular polygon area in acres (good to ±5% at Montana's latitude). */
const polygonAreaAcres = (vertices: ReadonlyArray<readonly [number, number]>): number | null => {
  if (vertices.length < 3) return null;
  const meanLat = vertices.reduce((sum, [, lat]) => sum + lat, 0) / vertices.length;
  const cosLat = Math.cos((meanLat * Math.PI) / 180);
  const M_PER_DEG_LAT = 110_574;
  const M_PER_DEG_LON = 111_320 * cosLat;
  let area2 = 0;
  for (let i = 0; i < vertices.length; i++) {
    const [x1, y1] = vertices[i];
    const [x2, y2] = vertices[(i + 1) % vertices.length];
    area2 += x1 * M_PER_DEG_LON * (y2 * M_PER_DEG_LAT) - x2 * M_PER_DEG_LON * (y1 * M_PER_DEG_LAT);
  }
  const sqM = Math.abs(area2) / 2;
  return sqM * 0.000247105;
};

/** Polyline length in miles. */
const polylineMiles = (vertices: ReadonlyArray<readonly [number, number]>): number | null => {
  if (vertices.length < 2) return null;
  const M_PER_DEG_LAT = 110_574;
  let totalM = 0;
  for (let i = 1; i < vertices.length; i++) {
    const [x1, y1] = vertices[i - 1];
    const [x2, y2] = vertices[i];
    const meanLat = (y1 + y2) / 2;
    const cosLat = Math.cos((meanLat * Math.PI) / 180);
    const dx = (x2 - x1) * 111_320 * cosLat;
    const dy = (y2 - y1) * M_PER_DEG_LAT;
    totalM += Math.hypot(dx, dy);
  }
  return totalM / 1609.344;
};

const Body = ({ attrs }: FeatureRendererProps): JSX.Element => {
  const id = String(attrs.id ?? "");
  const shape = useFieldToolsStore((s) => s.shapes.find((sh) => sh.id === id) ?? null);

  if (!shape) {
    return (
      <Paragraph>
        This shape was removed. Close the panel and choose another from the map.
      </Paragraph>
    );
  }
  return <ShapeBody shape={shape} />;
};

const ShapeBody = ({ shape }: { shape: DrawnShape }): JSX.Element => {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(shape.name);
  const [notes, setNotes] = useState(shape.notes ?? "");
  const updateShape = useFieldToolsStore((s) => s.updateShape);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setName(shape.name);
    setNotes(shape.notes ?? "");
  }, [shape.id, shape.name, shape.notes]);

  useEffect(() => {
    if (editing) window.setTimeout(() => nameInputRef.current?.focus(), 0);
  }, [editing]);

  const onSave = (): void => {
    updateShape(shape.id, {
      name: name.trim() || shape.name,
      notes: notes.trim() ? notes.trim() : undefined,
    });
    setEditing(false);
  };

  if (editing) {
    return (
      <form
        className="wp-edit-form"
        onSubmit={(e) => {
          e.preventDefault();
          onSave();
        }}
      >
        <label className="wp-edit-form__field">
          <span className="wp-edit-form__label">Name</span>
          <input
            ref={nameInputRef}
            className="wp-edit-form__input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={120}
          />
        </label>
        <label className="wp-edit-form__field">
          <span className="wp-edit-form__label">Notes</span>
          <textarea
            className="wp-edit-form__textarea"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            maxLength={1000}
          />
        </label>
        <div className="wp-edit-form__actions">
          <PillButton type="submit" variant="primary" iconStart={Save} size="sm">
            Save
          </PillButton>
          <PillButton
            type="button"
            variant="ghost"
            iconStart={X}
            size="sm"
            onClick={() => {
              setName(shape.name);
              setNotes(shape.notes ?? "");
              setEditing(false);
            }}
          >
            Cancel
          </PillButton>
        </div>
      </form>
    );
  }

  const isPolyline = shape.shape === "polyline";
  const acres = isPolyline ? null : polygonAreaAcres(shape.vertices);
  const miles = isPolyline ? polylineMiles(shape.vertices) : null;

  return (
    <>
      {miles !== null ? (
        <HeroBlock
          caption={shape.name || "Drawn line"}
          value={miles.toFixed(miles < 1 ? 2 : 1)}
          unit="mi"
          domain="elev"
        />
      ) : acres !== null ? (
        <HeroBlock
          caption={shape.name || "Drawn area"}
          value={acres.toFixed(acres < 10 ? 2 : 0)}
          unit="ac"
          domain="park"
        />
      ) : (
        <HeroBlock
          caption={SHAPE_LABEL[shape.shape]}
          value={shape.name || "Untitled shape"}
          domain="park"
        />
      )}
      <BadgeRow
        badges={[
          { icon: Shapes, label: SHAPE_LABEL[shape.shape] },
          { icon: Palette, label: shape.color },
          { icon: Calendar, label: formatFullDate(shape.createdAt) },
        ]}
      />
      <MetricGrid>
        <MetricPill label="Vertices" value={String(shape.vertices.length)} icon={Hash} />
        {miles === null && acres === null && (
          <MetricPill label="Shape" value={SHAPE_LABEL[shape.shape]} icon={Ruler} />
        )}
      </MetricGrid>
      {shape.notes && (
        <KeyValueRow stack label="Notes" value={<span className="wp-notes">{shape.notes}</span>} />
      )}
      <div className="wp-inline-actions">
        <PillButton
          variant="secondary"
          iconStart={Edit3}
          size="sm"
          onClick={() => setEditing(true)}
        >
          Edit
        </PillButton>
      </div>
    </>
  );
};

const Actions = ({ attrs }: FeatureRendererProps): JSX.Element => {
  const id = String(attrs.id ?? "");
  const remove = useFieldToolsStore((s) => s.removeShape);
  const shape = useFieldToolsStore((s) => s.shapes.find((sh) => sh.id === id) ?? null);
  const exists = shape != null;
  const closeTakeover = useTakeoverPopupStore((s) => s.close);
  const navigate = useNavigate();
  const [armedDelete, setArmedDelete] = useState(false);
  const armTimer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (armTimer.current != null) window.clearTimeout(armTimer.current);
    },
    [],
  );

  if (!exists) {
    // The panel's top-right X is the close affordance — no inline button.
    return <></>;
  }

  const onShare = async (): Promise<void> => {
    if (!shape) return;
    try {
      // Shapes have no GPX analog — the Engage MT link carries the full shape.
      const payload = buildPinSharePayload({ shapes: [shape] });
      await share(payload);
    } catch (err) {
      log.warn("shape share failed", { error: err instanceof Error ? err.message : err });
    }
  };

  const onArmOrDelete = (): void => {
    if (armedDelete) {
      remove(id);
      closeTakeover();
      return;
    }
    setArmedDelete(true);
    armTimer.current = window.setTimeout(() => setArmedDelete(false), 4000);
  };

  return (
    <div className="feature-card__actions">
      <PillButton variant="primary" iconStart={Share2} onClick={onShare}>
        Share shape
      </PillButton>
      <PillButton
        variant="secondary"
        iconStart={ExternalLink}
        onClick={() => {
          closeTakeover();
          navigate("/field");
        }}
      >
        Field tools
      </PillButton>
      <PillButton
        variant="danger"
        iconStart={Trash2}
        onClick={onArmOrDelete}
        aria-pressed={armedDelete}
      >
        {armedDelete ? "Tap to confirm" : "Delete"}
      </PillButton>
    </div>
  );
};

registerFeature("engage-mt-field-shape", {
  // The body already shows the shape kind + color — no meta-row repeat.
  hideMeta: true,
  summary: (a) => {
    const name = typeof a.name === "string" && a.name.length > 0 ? a.name : "Drawn shape";
    return name;
  },
  subtitle: (a) => {
    const shape = typeof a.shape === "string" ? (a.shape as DrawnShape["shape"]) : "polygon";
    const label = SHAPE_LABEL[shape] ?? "Shape";
    const color = typeof a.color === "string" ? a.color : "";
    return color ? `${label} · ${color}` : label;
  },
  Body,
  Actions,
  presentation: "panel",
});

export const __shapeRegistered = true;
