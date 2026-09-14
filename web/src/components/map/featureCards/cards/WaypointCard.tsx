/**
 * @file WaypointCard.tsx
 * @module engage-mt/map/featureCards
 * @description Tier-2 renderer for user-saved field waypoints
 *              (synthetic layer id `engage-mt-field-waypoint`).
 *
 *              Killed the "Waypoint · Waypoint"
 *              triple-print: title is now the user-supplied name only;
 *              subtitle pairs the kind label with the formatted coords.
 *              Hero leads with the kind icon glyph + label, with the name
 *              as a secondary line; coordinates render in a dedicated row
 *              that flips between DD / DMS via a toggle. Long-press-drops
 *              auto-enter edit mode (`lastCreatedId` consumed once). Card
 *              footer carries Share + Open-in-Field-Tools alongside Edit
 *              and a properly-worded two-step Delete. Spatial-context
 *              enrichment (county / FWP region / hunting district / HUC)
 *              renders under the body.
 *
 *              The renderer resolves fresh state from `useFieldToolsStore`
 *              by `attrs.id` so edits propagate to the map graphics
 *              immediately. Privacy: every attribute stays on device.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-09
 * @updated 2026-07-14
 * @version 1.2.1
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { useEffect, useRef, useState } from "react";
import { formatFullDate } from "@/utils/formatDate";
import { useNavigate } from "react-router-dom";
import { Edit3, ExternalLink, Save, Share2, Tag, Trash2, X } from "lucide-react";
import {
  BadgeRow,
  KeyValueRow,
  MetricCallout,
  MetricGrid,
  MetricPill,
  Paragraph,
} from "@/components/map/featureCards/core/cardPrimitives";
import { registerFeature } from "@/components/map/featureCards/core/registry";
import type { FeatureRendererProps } from "@/components/map/featureCards/core/types";
import {
  useFieldToolsStore,
  WAYPOINT_KIND_INFO,
  type Waypoint,
  type WaypointColorName,
  type WaypointKind,
} from "@/store/field/fieldToolsStore";
import { PillButton } from "@/components/shared/forms/PillButton";
import { ColorPicker } from "@/components/shared/forms/ColorPicker";
import { PhotoStrip } from "@/components/field/PhotoStrip";
import {
  PhotoQuotaError,
  attachWaypointPhoto,
  detachWaypointPhoto,
} from "@/services/field/waypointPhotos";
import { useToast } from "@/hooks/useToast";
import { TagsInput } from "@/components/field/TagsInput";
import { useTakeoverPopupStore } from "@/store/map/takeoverPopupStore";
import { buildPinSharePayload, share } from "@/services/mobile/shareService";
import { createLogger } from "@/utils/logger";
import { formatDms } from "@/services/spatialContext/utm";
import "./WaypointCard.css";

const log = createLogger("waypoint-card");

const formatDD = (lat: number, lon: number): string => `${lat.toFixed(5)}°, ${lon.toFixed(5)}°`;

const formatDmsPair = (lat: number, lon: number): string =>
  `${formatDms(lat, "lat")}  ${formatDms(lon, "lon")}`;

const WAYPOINT_KIND_LIST: readonly WaypointKind[] = Object.keys(
  WAYPOINT_KIND_INFO,
) as readonly WaypointKind[];

/** Map waypoint kind → MetricCallout intent. Hazard pins fire the danger
 *  treatment; everything else stays at the neutral default so the card's
 *  module accent (shared/yellow) drives the color, not the kind. */
const KIND_INTENT: Partial<Record<WaypointKind, "default" | "warning" | "danger">> = {
  hazard: "danger",
  "kill-site": "warning",
};

/** Keyboard-navigable kind picker grid. ARIA radiogroup. */
const KindPicker = ({
  value,
  onChange,
}: {
  value: WaypointKind;
  onChange: (k: WaypointKind) => void;
}): JSX.Element => {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const focusByIndex = (idx: number): void => {
    const wrapped =
      ((idx % WAYPOINT_KIND_LIST.length) + WAYPOINT_KIND_LIST.length) % WAYPOINT_KIND_LIST.length;
    const next = refs.current[wrapped];
    next?.focus();
    onChange(WAYPOINT_KIND_LIST[wrapped]);
  };
  return (
    <div className="wp-kind-picker" role="radiogroup" aria-label="Waypoint type">
      {WAYPOINT_KIND_LIST.map((k, idx) => {
        const info = WAYPOINT_KIND_INFO[k];
        const selected = k === value;
        return (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            ref={(el) => {
              refs.current[idx] = el;
            }}
            className={`wp-kind-picker__chip${selected ? " wp-kind-picker__chip--on" : ""}`}
            onClick={() => onChange(k)}
            onKeyDown={(e) => {
              switch (e.key) {
                case "ArrowRight":
                case "ArrowDown":
                  e.preventDefault();
                  focusByIndex(idx + 1);
                  break;
                case "ArrowLeft":
                case "ArrowUp":
                  e.preventDefault();
                  focusByIndex(idx - 1);
                  break;
                case "Home":
                  e.preventDefault();
                  focusByIndex(0);
                  break;
                case "End":
                  e.preventDefault();
                  focusByIndex(WAYPOINT_KIND_LIST.length - 1);
                  break;
              }
            }}
            style={{ "--chip-accent": info.color } as React.CSSProperties}
          >
            {info.label}
          </button>
        );
      })}
    </div>
  );
};

const Body = ({ attrs }: FeatureRendererProps): JSX.Element => {
  const id = String(attrs.id ?? "");
  const waypoint = useFieldToolsStore((s) => s.waypoints.find((w) => w.id === id) ?? null);

  if (!waypoint) {
    return (
      <Paragraph>
        This waypoint was removed. Close the panel and choose another from the map.
      </Paragraph>
    );
  }
  return <WaypointBody waypoint={waypoint} />;
};

const WaypointBody = ({ waypoint }: { waypoint: Waypoint }): JSX.Element => {
  // Auto-enter edit mode if the long-press flow just dropped this pin.
  const justCreated = useFieldToolsStore.getState().lastCreatedId === waypoint.id;
  const consumeLastCreated = useFieldToolsStore((s) => s.consumeLastCreated);
  const [editing, setEditing] = useState(justCreated);
  const [showDms, setShowDms] = useState(false);
  const [name, setName] = useState(waypoint.name);
  const [kind, setKind] = useState<WaypointKind>(waypoint.kind);
  const [notes, setNotes] = useState(waypoint.notes ?? "");
  const [color, setColor] = useState<WaypointColorName | null>(waypoint.color ?? null);
  const [tags, setTags] = useState<string[]>(waypoint.tags ?? []);
  const update = useFieldToolsStore((s) => s.updateWaypoint);
  const { show } = useToast();
  const addPhoto = async (uri: string): Promise<void> => {
    try {
      await attachWaypointPhoto(waypoint.id, uri);
    } catch (err) {
      show({
        kind: "warning",
        title: err instanceof PhotoQuotaError ? "Photo library full" : "Couldn't save the photo",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  };
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (justCreated) {
      consumeLastCreated(waypoint.id);
    }
    // Consume runs once on mount for the matching id; subsequent renders
    // of the same waypoint stay in their persisted editing state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setName(waypoint.name);
    setKind(waypoint.kind);
    setNotes(waypoint.notes ?? "");
    setColor(waypoint.color ?? null);
    setTags(waypoint.tags ?? []);
  }, [waypoint.id, waypoint.name, waypoint.kind, waypoint.notes, waypoint.color, waypoint.tags]);

  useEffect(() => {
    if (editing) {
      // Defer to next tick so the input is mounted before focus.
      window.setTimeout(() => nameInputRef.current?.focus(), 0);
    }
  }, [editing]);

  // CO-4 belt-and-suspenders: an unknown `kind` (e.g. from a legacy persisted
  // row) must never crash the card — fall back to the generic entry.
  const info = WAYPOINT_KIND_INFO[waypoint.kind] ?? WAYPOINT_KIND_INFO.general;

  const onSave = (): void => {
    update(waypoint.id, {
      name: name.trim() || waypoint.name,
      kind,
      notes: notes.trim() ? notes.trim() : undefined,
      color: color ?? undefined,
      tags,
    });
    setEditing(false);
  };

  const onCancel = (): void => {
    setName(waypoint.name);
    setKind(waypoint.kind);
    setNotes(waypoint.notes ?? "");
    setColor(waypoint.color ?? null);
    setTags(waypoint.tags ?? []);
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
        <div className="wp-edit-form__field">
          <span className="wp-edit-form__label">Type</span>
          <KindPicker value={kind} onChange={setKind} />
        </div>
        <div className="wp-edit-form__field">
          <span className="wp-edit-form__label">Color</span>
          <ColorPicker value={color} onChange={setColor} />
        </div>
        <label className="wp-edit-form__field">
          <span className="wp-edit-form__label">Notes</span>
          <textarea
            className="wp-edit-form__textarea"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="What did you see? Wind direction, time of day, sign…"
            maxLength={1000}
          />
        </label>
        <div className="wp-edit-form__field">
          <span className="wp-edit-form__label">Tags</span>
          <TagsInput value={tags} onChange={setTags} />
        </div>
        <div className="wp-edit-form__field">
          <span className="wp-edit-form__label">Photos</span>
          <PhotoStrip
            photos={waypoint.photos}
            onAdd={(uri) => void addPhoto(uri)}
            onRemove={(photoId) => detachWaypointPhoto(waypoint.id, photoId)}
          />
        </div>
        <div className="wp-edit-form__actions">
          <PillButton type="submit" variant="primary" iconStart={Save} size="sm">
            Save
          </PillButton>
          <PillButton type="button" variant="ghost" iconStart={X} size="sm" onClick={onCancel}>
            Cancel
          </PillButton>
        </div>
      </form>
    );
  }

  return (
    <>
      <MetricCallout
        title={info.label}
        value={waypoint.name || "Untitled waypoint"}
        sub={waypoint.notes ? undefined : formatDD(waypoint.lat, waypoint.lon)}
        intent={KIND_INTENT[waypoint.kind] ?? "default"}
      />
      {waypoint.photos.length > 0 && (
        <BadgeRow
          badges={[
            {
              icon: Tag,
              label: `${waypoint.photos.length} photo${waypoint.photos.length === 1 ? "" : "s"}`,
            },
          ]}
        />
      )}
      <MetricGrid stack>
        <MetricPill
          label={showDms ? "Coords (DMS)" : "Coords (DD)"}
          value={
            <button
              type="button"
              className="wp-coord-toggle"
              aria-label={`Switch to ${showDms ? "decimal degrees" : "degrees-minutes-seconds"}`}
              onClick={() => setShowDms((v) => !v)}
            >
              {showDms
                ? formatDmsPair(waypoint.lat, waypoint.lon)
                : formatDD(waypoint.lat, waypoint.lon)}
            </button>
          }
        />
        {waypoint.updatedAt !== waypoint.createdAt && (
          <MetricPill label="Edited" value={formatFullDate(waypoint.updatedAt)} />
        )}
        {typeof waypoint.accuracyAtCapture === "number" && (
          <MetricPill label="GPS accuracy" value={`±${Math.round(waypoint.accuracyAtCapture)} m`} />
        )}
      </MetricGrid>
      {waypoint.notes && (
        <KeyValueRow
          stack
          label="Notes"
          value={<span className="wp-notes">{waypoint.notes}</span>}
        />
      )}
      {waypoint.tags && waypoint.tags.length > 0 && (
        <KeyValueRow
          label="Tags"
          value={
            <span className="wp-tag-row">
              <Tag size={12} aria-hidden />
              {waypoint.tags.join(", ")}
            </span>
          }
        />
      )}
      {waypoint.photos.length > 0 && (
        <PhotoStrip photos={waypoint.photos} onAdd={() => {}} onRemove={() => {}} readOnly />
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
  const remove = useFieldToolsStore((s) => s.removeWaypoint);
  const waypoint = useFieldToolsStore((s) => s.waypoints.find((w) => w.id === id) ?? null);
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

  if (!waypoint) {
    // The panel's top-right X is the close affordance — no inline button.
    return <></>;
  }

  const onShare = async (): Promise<void> => {
    try {
      // Dual payload: an Engage MT deep link (full fidelity for
      // another user) + a GPX block (other mapping apps / no-app recipients).
      const payload = buildPinSharePayload({ waypoints: [waypoint] });
      await share(payload);
    } catch (err) {
      log.warn("waypoint share failed", { error: err instanceof Error ? err.message : err });
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
        Share pin
      </PillButton>
      {/* Web planners carry a pin to the field companion via a
          same-origin receive link (QR / email / copy). Native app users already
          have the pin on-device, so the action is web-only. */}
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

registerFeature("engage-mt-field-waypoint", {
  // The body already shows kind + coordinates — the shell meta-row would
  // repeat them verbatim above the card.
  hideMeta: true,
  summary: (a) => {
    const name = typeof a.name === "string" && a.name.length > 0 ? a.name : "Saved waypoint";
    return name;
  },
  subtitle: (a) => {
    const kindKey = typeof a.kind === "string" ? (a.kind as WaypointKind) : "general";
    const label = WAYPOINT_KIND_INFO[kindKey]?.label ?? "Waypoint";
    if (typeof a.lat === "number" && typeof a.lon === "number") {
      return `${label} · ${formatDD(a.lat, a.lon)}`;
    }
    return label;
  },
  Body,
  Actions,
  presentation: "panel",
});

/** Re-export so the side-effect import in `index.ts` keeps the module live-loaded. */
export const __wpRegistered = true;
