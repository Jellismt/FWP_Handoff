/**
 * @file ModuleLandingShell.tsx
 * @module engage-mt/shared
 * @description Shared landing layout for Hunt / Fish / Explore / Access / Manage.
 *              Renders a glass-morphic hero with module accent gradient + hero-scale
 *              "View map" CTA, then a uniform-square tool tile grid.
 * @author Jamie Ellis / Engage MT
 * @created 2026-05-29
 * @updated 2026-07-03
 * @version 2.3.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ChevronRight } from "lucide-react";
import type { EngageMtModule } from "@/types/layers";
import { MODULE_ACCENT_VAR } from "@/config/navigation";
import { WalletNotice } from "@/components/shared/notices/WalletNotice";
import "./ModuleLandingShell.css";

export interface Tool {
  id: string;
  title: string;
  description: string;
  icon?: string;
  /** Optional route. If set, the card becomes a Link. */
  to?: string;
}

/**
 * One beat of the hero "creed": a three-line litany
 * under the intro (lead phrase in module accent + short qualifier).
 */
export interface CreedBeat {
  lead: string;
  rest: string;
}

interface ModuleLandingShellProps {
  module: EngageMtModule;
  title: string;
  intro: string;
  tools: Tool[];
  notice?: ReactNode;
  /** Optional three-beat creed rendered between the intro and the stats. */
  creed?: readonly CreedBeat[];
}

const ToolCard = ({ tool }: { tool: Tool }): JSX.Element => {
  const body = (
    <>
      <div className="module-landing__tool-header">
        {tool.to ? (
          <span className="module-landing__tool-arrow" aria-hidden>
            <ChevronRight size={18} strokeWidth={2} />
          </span>
        ) : null}
      </div>
      <div className="module-landing__tool-content">
        <h3 className="module-landing__tool-title">{tool.title}</h3>
        <p className="module-landing__tool-description">{tool.description}</p>
      </div>
    </>
  );
  const klass = `module-landing__tool${tool.to ? " module-landing__tool--link" : ""}`;
  if (tool.to) {
    return (
      <li className={klass}>
        <Link to={tool.to} className="module-landing__tool-link">
          {body}
        </Link>
      </li>
    );
  }
  return <li className={klass}>{body}</li>;
};

export const ModuleLandingShell = ({
  module,
  title,
  intro,
  tools,
  notice,
  creed,
}: ModuleLandingShellProps): JSX.Element => {
  const toolCount = tools.length;

  return (
    <section
      className="module-landing"
      data-module={module}
      style={{ "--module-accent": MODULE_ACCENT_VAR[module] } as React.CSSProperties}
    >
      <header className="module-landing__hero">
        <div className="module-landing__hero-card">
          <Link to="/" className="module-landing__map-cta">
            <span>View map</span>
            <ArrowRight size={18} strokeWidth={2.25} aria-hidden />
          </Link>
          <div className="module-landing__hero-text fwp-rise">
            <h1 className="module-landing__title">{title}</h1>
            <p className="module-landing__intro">{intro}</p>
            {creed && creed.length > 0 && (
              <ul className="module-landing__creed">
                {creed.map((beat) => (
                  <li key={beat.lead}>
                    <strong>{beat.lead}</strong> {beat.rest}
                  </li>
                ))}
              </ul>
            )}
            <div className="module-landing__stats" aria-label="Tool count">
              <span className="module-landing__stat-count">{toolCount}</span>
              <span className="module-landing__stat-label">
                {toolCount === 1 ? "tool" : "tools"}
              </span>
            </div>
          </div>
        </div>
      </header>

      <WalletNotice module={module} />

      {notice && <div className="module-landing__notice">{notice}</div>}

      <section className="module-landing__tools" aria-label={`${title} tools`}>
        <h2 className="module-landing__tools-heading">Tools</h2>
        <ul className="module-landing__grid">
          {tools.map((t) => (
            <ToolCard key={t.id} tool={t} />
          ))}
        </ul>
      </section>
    </section>
  );
};
