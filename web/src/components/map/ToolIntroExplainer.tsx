/**
 * @file ToolIntroExplainer.tsx
 * @module engage-mt/map
 * @description The closeable "here's what you're looking
 *              at" card that pops when a map-first tool opens the map via
 *              `/?focus=<layerId>&intro=<toolId>`. Deliberately NON-blocking (a
 *              floating card, not a modal): staff asked to still pan the map and
 *              tap features while it's up. Carries a Close (session) and a
 *              "Don't show again" (persisted, cross-platform) affordance, plus
 *              an optional deep-link to the tool's full explorer page.
 *
 *              Accessibility: role="region" with an aria-label (complementary
 *              context, not a dialog — it never traps focus). The Close button
 *              is a real <button> with an aria-label; color is paired with text.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-06
 * @updated 2026-07-06
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowRight, X } from "lucide-react";
import { useToolIntroStore } from "@/store/app/toolIntroStore";
import { TOOL_INTROS } from "./toolIntros";
import "./ToolIntroExplainer.css";

export const ToolIntroExplainer = (): JSX.Element | null => {
  const [searchParams, setSearchParams] = useSearchParams();
  const introId = searchParams.get("intro");
  const isDismissed = useToolIntroStore((s) => s.isDismissed);
  const dismissForever = useToolIntroStore((s) => s.dismiss);
  // Session-local close: hide immediately without persisting.
  const [closed, setClosed] = useState(false);

  const intro = introId ? TOOL_INTROS[introId] : undefined;
  if (!intro || !introId || closed || isDismissed(introId)) return null;

  // Strip the intro param so a re-render / back-forward doesn't resurrect it.
  const clearParam = (): void => {
    searchParams.delete("intro");
    setSearchParams(searchParams, { replace: true });
  };

  const close = (): void => {
    setClosed(true);
    clearParam();
  };

  const neverShowAgain = (): void => {
    dismissForever(introId);
    setClosed(true);
    clearParam();
  };

  return (
    <aside
      className="tool-intro"
      data-module={intro.module}
      role="region"
      aria-label={`About ${intro.title}`}
    >
      <div className="tool-intro__body">
        <p className="tool-intro__title">{intro.title}</p>
        <p className="tool-intro__text">{intro.body}</p>
        <div className="tool-intro__actions">
          {intro.cta && (
            <Link className="tool-intro__cta" to={intro.cta.to} onClick={close}>
              {intro.cta.label}
              <ArrowRight size={14} strokeWidth={2.25} aria-hidden />
            </Link>
          )}
          <button type="button" className="tool-intro__dismiss" onClick={neverShowAgain}>
            Don&rsquo;t show again
          </button>
        </div>
      </div>
      <button
        type="button"
        className="fwp-icon-close tool-intro__close"
        onClick={close}
        aria-label={`Close ${intro.title} intro`}
      >
        <X size={18} strokeWidth={2.25} aria-hidden />
      </button>
    </aside>
  );
};
