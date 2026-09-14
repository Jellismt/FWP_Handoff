/**
 * @file FeatureDetailShell.tsx
 * @module engage-mt/shared
 * @description Generic detail-page shell used by BMA / WMA / State Park (and any future
 *              feature whose detail page is "fetch the row, render the card, link back").
 *              The card is composed via the FeatureCard registry so summary copy + body
 *              fields stay consistent with the TapQueryPanel rendering.
 * @author Jamie Ellis / Engage MT
 * @created 2026-05-29
 * @updated 2026-07-03
 * @version 1.1.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CalciteLoader, CalciteNotice } from "@esri/calcite-components-react";
import type { EngageMtModule } from "@/types/layers";
import { findLayerById } from "@/config/layers";
import { FeatureCard } from "@/components/map/featureCards";
import { fetchFeatureById } from "@/services/public/arcgisFeature";
import "./FeatureDetailShell.css";

interface Props {
  /** Layer id from the registry; drives URL + renderer resolution. */
  layerId: string;
  /** Raw id from the route (e.g. OBJECTID, BMA_ID). */
  rawId: string;
  /** WHERE template with `{id}` token. */
  where?: string;
  /** "Back to {Module}" route. */
  backTo: string;
  /** Back link label. */
  backLabel: string;
}

export const FeatureDetailShell = ({
  layerId,
  rawId,
  where,
  backTo,
  backLabel,
}: Props): JSX.Element => {
  const layer = findLayerById(layerId);
  const [attrs, setAttrs] = useState<Record<string, unknown> | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "missing" | "error" | "offline">(
    "loading",
  );
  const [errMsg, setErrMsg] = useState<string>("");

  useEffect(() => {
    if (!layer) {
      setState("error");
      setErrMsg(`Layer "${layerId}" is not in the registry.`);
      return;
    }
    // Upstream temporarily offline (e.g. FWP Block Management out of
    // season). Short-circuit before any query so we neither hit a failing
    // service nor risk an ArcGIS sign-in prompt — show the friendly note.
    if (layer.unavailable) {
      setState("offline");
      return;
    }
    const controller = new AbortController();
    setState("loading");
    fetchFeatureById({
      url: layer.url,
      where,
      id: rawId,
      signal: controller.signal,
    })
      .then((row) => {
        if (controller.signal.aborted) return;
        if (!row) {
          setState("missing");
        } else {
          setAttrs(row);
          setState("ready");
        }
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setState("error");
        setErrMsg(err instanceof Error ? err.message : "Unknown error");
      });
    return () => controller.abort();
  }, [layer, layerId, rawId, where]);

  return (
    <section className="feature-detail">
      <header className="feature-detail__header">
        <Link to={backTo} className="feature-detail__back">
          ← {backLabel}
        </Link>
      </header>

      {state === "loading" && (
        <div className="feature-detail__suspense" aria-busy="true">
          <CalciteLoader scale="m" label="Loading feature…" />
        </div>
      )}

      {state === "offline" && layer?.unavailable && (
        <CalciteNotice open kind="info" icon="information">
          <div slot="title">{layer.title} is offline</div>
          <div slot="message">{layer.unavailable.note}</div>
        </CalciteNotice>
      )}

      {state === "missing" && (
        <CalciteNotice open kind="warning" icon="exclamation-mark-triangle">
          <div slot="title">Feature not found</div>
          <div slot="message">
            We couldn&rsquo;t find a feature with id <code>{rawId}</code> on this layer.
          </div>
        </CalciteNotice>
      )}

      {state === "error" && (
        <CalciteNotice open kind="danger" icon="exclamation-mark-triangle">
          <div slot="title">Couldn&rsquo;t load this feature</div>
          <div slot="message">{errMsg || "Try again in a moment."}</div>
        </CalciteNotice>
      )}

      {state === "ready" && layer && attrs && (
        <div className="feature-detail__card">
          <FeatureCard
            layerId={layer.id}
            layerTitle={layer.title}
            module={layer.module as EngageMtModule}
            attrs={attrs}
          />
        </div>
      )}
    </section>
  );
};
