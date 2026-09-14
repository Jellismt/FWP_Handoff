/**
 * @file TrackCard.tsx
 * @module engage-mt/map/featureCards
 * @description Tier-2 renderer for user-recorded tracks
 *              (synthetic layer id `engage-mt-field-track`).
 *
 *              Hero leads with total distance
 *              (the highest-information attribute) using `domain="elev"`;
 *              the track name + duration take the supporting badge row.
 *              Card-level Actions row gains Share (composes GPX via
 *              `shareService.buildTrackPayload`) and Open-in-Field-Tools.
 *              Mutation goes through the new `updateRoute` store action
 *              instead of inline `setState`.
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
  Crosshair,
  Edit3,
  ExternalLink,
  Mountain,
  Ruler,
  Save,
  Scissors,
  Share2,
  Timer,
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
import { useFieldToolsStore, type CapturedRoute } from "@/store/field/fieldToolsStore";
import { PillButton } from "@/components/shared/forms/PillButton";
import { useTakeoverPopupStore } from "@/store/map/takeoverPopupStore";
import { buildPinSharePayload, share } from "@/services/mobile/shareService";
import { createLogger } from "@/utils/logger";
import "./WaypointCard.css";

const log = createLogger("track-card");

const formatDuration = (startISO: string, endISO: string): string => {
  try {
    const ms = new Date(endISO).getTime() - new Date(startISO).getTime();
    if (!Number.isFinite(ms) || ms < 0) return "—";
    const totalMin = Math.round(ms / 60_000);
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    if (h === 0) return `${m} min`;
    if (m === 0) return `${h} h`;
    return `${h} h ${m} min`;
  } catch {
    return "—";
  }
};

const Body = ({ attrs }: FeatureRendererProps): JSX.Element => {
  const id = String(attrs.id ?? "");
  const route = useFieldToolsStore((s) => s.routes.find((r) => r.id === id) ?? null);

  if (!route) {
    return (
      <Paragraph>
        This track was removed. Close the panel and choose another from the map.
      </Paragraph>
    );
  }
  return <TrackBody route={route} />;
};

const TrackBody = ({ route }: { route: CapturedRoute }): JSX.Element => {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(route.name);
  const [notes, setNotes] = useState(route.notes ?? "");
  const updateRoute = useFieldToolsStore((s) => s.updateRoute);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setName(route.name);
    setNotes(route.notes ?? "");
  }, [route.id, route.name, route.notes]);

  useEffect(() => {
    if (editing) window.setTimeout(() => nameInputRef.current?.focus(), 0);
  }, [editing]);

  const onSave = (): void => {
    updateRoute(route.id, {
      name: name.trim() || route.name,
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
            placeholder="Conditions, observations, route notes…"
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
              setName(route.name);
              setNotes(route.notes ?? "");
              setEditing(false);
            }}
          >
            Cancel
          </PillButton>
        </div>
      </form>
    );
  }

  return (
    <>
      <HeroBlock
        caption={route.name || "Recorded track"}
        value={route.distanceMi.toFixed(2)}
        unit="mi"
        domain="elev"
      />
      <BadgeRow
        badges={[
          { icon: Timer, label: formatDuration(route.startedAt, route.endedAt) },
          { icon: Calendar, label: formatFullDate(route.startedAt) },
        ]}
      />
      <MetricGrid>
        <MetricPill
          label="Elevation gain"
          value={`${Math.round(route.gainFt)} ft`}
          icon={Mountain}
        />
        <MetricPill label="GPS samples" value={String(route.path.length)} icon={Ruler} />
        {route.accuracyMedianM != null && (
          <MetricPill
            label="GPS accuracy"
            value={`±${route.accuracyMedianM} m (median of ${route.path.length} fixes)`}
            icon={Crosshair}
          />
        )}
        {route.segments && route.segments.length > 1 && (
          <MetricPill
            label="Recording gaps"
            value={`${route.segments.length - 1} · drawn as ${route.segments.length} segments`}
            icon={Scissors}
          />
        )}
      </MetricGrid>
      {route.notes && (
        <KeyValueRow stack label="Notes" value={<span className="wp-notes">{route.notes}</span>} />
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
  const remove = useFieldToolsStore((s) => s.removeRoute);
  const route = useFieldToolsStore((s) => s.routes.find((r) => r.id === id) ?? null);
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

  if (!route) {
    // The panel's top-right X is the close affordance — no inline button.
    return <></>;
  }

  const onShare = async (): Promise<void> => {
    try {
      // Engage MT deep link (full fidelity) + GPX body (cross-app).
      const payload = buildPinSharePayload({ routes: [route] });
      await share(payload);
    } catch (err) {
      log.warn("track share failed", { error: err instanceof Error ? err.message : err });
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
        Share track
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

registerFeature("engage-mt-field-track", {
  // The body already shows distance + point count — no meta-row repeat.
  hideMeta: true,
  summary: (a) => {
    const name = typeof a.name === "string" && a.name.length > 0 ? a.name : "Recorded track";
    return name;
  },
  subtitle: (a) =>
    typeof a.distanceMi === "number" ? `${a.distanceMi.toFixed(2)} mi recorded` : "Saved track",
  Body,
  Actions,
  presentation: "panel",
});

export const __trackRegistered = true;
