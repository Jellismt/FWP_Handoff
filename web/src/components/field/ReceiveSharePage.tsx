/**
 * @file ReceiveSharePage.tsx
 * @module engage-mt/field
 * @description Receive surface for a high-fidelity pin-share link
 *              (`/field/receive?d=<payload>`). Decodes the `?d=` payload, shows
 *              a pre-commit preview (item counts, omitted-photo note, optional
 *              trip), and commits into the field-tools store — then flies the
 *              map to the first imported pin (the "open → look at it" behavior
 *              users expect from consumer map apps). When the same items already
 *              exist it offers a copy-vs-skip choice so a re-opened link never
 *              clobbers edits.
 *
 *              A bad / missing / non-Engage-MT payload (e.g. a link from another
 *              app) lands on a friendly guidance state instead of a crash,
 *              pointing the user at the export-a-file path.
 *
 *              Privacy: the payload is decoded on-device; nothing is fetched.
 *              Per docs/rules/privacy.md.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-30
 * @updated 2026-07-14
 * @version 1.1.1
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Check, Copy, MapPin, PackageOpen, Route as RouteIcon, Shapes, X } from "lucide-react";
import { PillButton } from "@/components/shared/forms/PillButton";
import { useToast } from "@/hooks/useToast";
import { useFieldToolsStore } from "@/store/field/fieldToolsStore";
import { useMapNavStore } from "@/store/map/mapNavStore";
import {
  countBundleItems,
  decodeShareBundle,
  ShareDecodeError,
  type EngageMtShareBundle,
} from "@/services/field/pinShareCodec";
import { buildShareLink, parseShareLinkParam } from "@/services/field/shareLink";
import { isCapacitor } from "@/utils/capacitor";
import {
  commitShareBundle,
  countShareConflicts,
  type ConflictMode,
} from "@/services/field/receiveShare";
import { impact } from "@/services/mobile/haptics";
import "./ReceiveSharePage.css";

interface DecodeState {
  bundle: EngageMtShareBundle | null;
  error: string | null;
}

export const ReceiveSharePage = (): JSX.Element => {
  const { search } = useLocation();
  const navigate = useNavigate();
  const { show } = useToast();
  const activeTripId = useFieldToolsStore((s) => s.activeTripId);
  const requestGoto = useMapNavStore((s) => s.requestGoto);

  const { bundle, error }: DecodeState = useMemo(() => {
    const payload = parseShareLinkParam(search);
    if (!payload) return { bundle: null, error: "This link doesn't carry a shared pin." };
    try {
      return { bundle: decodeShareBundle(payload), error: null };
    } catch (err) {
      return {
        bundle: null,
        error: err instanceof ShareDecodeError ? err.message : "This share link couldn't be read.",
      };
    }
  }, [search]);

  const conflicts = useMemo(() => (bundle ? countShareConflicts(bundle) : 0), [bundle]);
  const [mode, setMode] = useState<ConflictMode>("copy");

  const onCommit = (): void => {
    if (!bundle) return;
    const result = commitShareBundle(bundle, { mode, activeTripId });
    const added = result.addedWaypoints + result.addedRoutes + result.addedShapes;
    void impact("medium");
    show({
      kind: "success",
      title: added > 0 ? "Added to your field tools" : "Nothing new to add",
      message:
        added > 0
          ? `${added} item${added === 1 ? "" : "s"} saved${result.skipped ? `, ${result.skipped} skipped` : ""}.`
          : "Those items were already on your device.",
    });
    if (result.firstTarget) {
      requestGoto(result.firstTarget);
      navigate("/");
    } else {
      navigate(isCapacitor() ? "/field" : "/");
    }
  };

  if (!bundle) {
    return (
      <div className="receive-share">
        <section className="receive-share__card" aria-labelledby="receive-share-title">
          <h1 id="receive-share-title" className="receive-share__title">
            <PackageOpen size={20} aria-hidden /> Couldn&apos;t open this pin
          </h1>
          <p className="receive-share__lede">{error}</p>
          <div className="receive-share__guidance">
            <strong>Was this a link from another app?</strong> Some apps&rsquo; share links only
            open in that app. Ask the sender to <em>Export</em> the pin as a <strong>GPX</strong> or{" "}
            <strong>KML</strong> file and send that instead — then open it in the Engage MT mobile
            app&rsquo;s Field Tools.
          </div>
          <div className="receive-share__actions">
            <PillButton
              variant="primary"
              iconStart={PackageOpen}
              onClick={() => navigate(isCapacitor() ? "/field" : "/")}
            >
              {isCapacitor() ? "Go to Field Tools" : "Back to the map"}
            </PillButton>
          </div>
        </section>
      </div>
    );
  }

  const total = countBundleItems(bundle);
  const counts = [
    { icon: MapPin, n: bundle.waypoints?.length ?? 0, one: "waypoint", many: "waypoints" },
    { icon: RouteIcon, n: bundle.routes?.length ?? 0, one: "track", many: "tracks" },
    { icon: Shapes, n: bundle.shapes?.length ?? 0, one: "shape", many: "shapes" },
  ].filter((c) => c.n > 0);

  return (
    <div className="receive-share">
      <section className="receive-share__card" aria-labelledby="receive-share-title">
        <h1 id="receive-share-title" className="receive-share__title">
          <PackageOpen size={20} aria-hidden /> Someone shared {total} pin{total === 1 ? "" : "s"}
        </h1>
        <p className="receive-share__lede">
          Review and add these to your own Field Tools. They stay on your device.
        </p>

        <ul className="receive-share__counts">
          {counts.map((c) => (
            <li key={c.one}>
              <c.icon size={16} aria-hidden /> <strong>{c.n}</strong> {c.n === 1 ? c.one : c.many}
            </li>
          ))}
        </ul>

        {bundle.trip && (
          <p className="receive-share__hint">
            Grouped under the trip <strong>{bundle.trip.name}</strong>.
          </p>
        )}
        {bundle.photosOmitted > 0 && (
          <p className="receive-share__note">
            {bundle.photosOmitted} photo{bundle.photosOmitted === 1 ? "" : "s"} not included —
            photos stay on the sender&apos;s device.
          </p>
        )}

        {conflicts > 0 && (
          <fieldset className="receive-share__choice">
            <legend>
              {conflicts} of these match items you already have. How should we handle that?
            </legend>
            <label className="receive-share__radio">
              <input
                type="radio"
                name="conflict-mode"
                value="copy"
                checked={mode === "copy"}
                onChange={() => setMode("copy")}
              />
              <Copy size={15} aria-hidden /> Add as new copies
            </label>
            <label className="receive-share__radio">
              <input
                type="radio"
                name="conflict-mode"
                value="skip"
                checked={mode === "skip"}
                onChange={() => setMode("skip")}
              />
              <Check size={15} aria-hidden /> Skip the duplicates
            </label>
          </fieldset>
        )}

        <div className="receive-share__actions">
          <PillButton variant="primary" iconStart={Check} onClick={onCommit}>
            Add to my field tools
          </PillButton>
          <PillButton variant="ghost" iconStart={X} onClick={() => navigate("/field")}>
            Not now
          </PillButton>
        </div>

        {/* A phone-browser visitor who has the native app can open the
            same payload there instead. Rebuilt from the decoded bundle as an
            `engagemt://` deep link; on a device with the app installed the OS
            hands off to it. Web-only — inside the app this page IS the app. */}
        {!isCapacitor() && (
          <a className="receive-share__applink" href={buildShareLink(bundle).deepLink}>
            Have the Engage&nbsp;MT app? Open it there instead
          </a>
        )}
      </section>
    </div>
  );
};
