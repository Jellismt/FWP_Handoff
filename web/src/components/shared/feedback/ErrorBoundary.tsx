/**
 * @file ErrorBoundary.tsx
 * @module engage-mt/shared
 * @description Three error-boundary components: app-root, module-route, panel.
 *              Each catches React errors below it, logs via the structured logger,
 * And renders an FWP-voiced fallback..
 * @author Jamie Ellis / Engage MT
 * @created 2026-05-29
 * @updated 2026-07-03
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { Component, type ReactNode } from "react";
import { CalciteNotice } from "@esri/calcite-components-react";
import { RotateCcw } from "lucide-react";
import { PillButton } from "@/components/shared/forms/PillButton";
import { createLogger } from "@/utils/logger";
import "./ErrorBoundary.css";

const log = createLogger("error-boundary");

type Scope = "app" | "route" | "panel";

interface Props {
  scope: Scope;
  /** Optional scope label for logs/fallback (e.g. module name). */
  label?: string;
  children: ReactNode;
}

interface State {
  error: Error | null;
}

const FALLBACK_HEADINGS: Record<Scope, string> = {
  app: "Something went wrong.",
  route: "This view couldn't load.",
  panel: "This panel couldn't render.",
};

const FALLBACK_BODIES: Record<Scope, string> = {
  app: "Engage MT hit an unexpected error. You can reload the app, or pick another tab and come back.",
  route: "This tab couldn't load. Try another tab, or reload to retry.",
  panel: "Engage MT had trouble showing this content. Try again, or move on.",
};

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: unknown): void {
    log.error(`${this.props.scope}${this.props.label ? `:${this.props.label}` : ""} caught error`, {
      message: error.message,
      stack: error.stack,
      errorInfo,
    });
  }

  private reset = (): void => {
    this.setState({ error: null });
  };

  private reload = (): void => {
    window.location.reload();
  };

  render(): ReactNode {
    const { error } = this.state;
    const { scope, children } = this.props;
    if (!error) return children;

    const heading = FALLBACK_HEADINGS[scope];
    const body = FALLBACK_BODIES[scope];

    if (scope === "app") {
      return (
        <main className="error-boundary error-boundary--app" role="alert">
          <div className="error-boundary__inner">
            <h1 className="error-boundary__heading">{heading}</h1>
            <p className="error-boundary__body">{body}</p>
            <div className="error-boundary__actions">
              <PillButton variant="primary" iconStart={RotateCcw} onClick={this.reload}>
                Reload Engage MT
              </PillButton>
            </div>
            <details className="error-boundary__details">
              <summary>Technical details</summary>
              <pre>{error.message}</pre>
            </details>
          </div>
        </main>
      );
    }

    return (
      <div className={`error-boundary error-boundary--${scope}`}>
        <CalciteNotice open kind="warning" icon="exclamation-mark-triangle">
          <div slot="title">{heading}</div>
          <div slot="message">{body}</div>
          <button slot="link" type="button" className="error-boundary__retry" onClick={this.reset}>
            Try again
          </button>
        </CalciteNotice>
      </div>
    );
  }
}
