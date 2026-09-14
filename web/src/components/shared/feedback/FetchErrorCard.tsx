/**
 * @file FetchErrorCard.tsx
 * @module engage-mt/shared
 * @description User-facing fetch-error card. Replaces the
 *              silent `.catch(() => setRows([]))` empty-array fallback
 *              that ~14 list pages reproduced. Composes `<TipBlock
 *              intent="warning">` from the existing cardPrimitives
 *              system (no new visual chrome) plus a Retry CTA built
 *              from `<PillButton>`. Optional Help link routes to the
 *              on-device log store.
 *
 *              Accessibility: `role="alert"` so screen readers announce
 *              the error on appearance; focus moves to the Retry
 *              button when the card mounts so keyboard users can
 *              recover with a single keystroke.
 *
 *              Privacy: no error details (stack traces, fetch URLs)
 *              are sent anywhere. The `error` prop is rendered locally
 *              for the user's eyes only, and only the `.message`
 *              property is read (never the whole error).
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-02
 * @updated 2026-07-03
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { useEffect, useRef } from "react";
import { RotateCcw } from "lucide-react";
import { TipBlock } from "@/components/map/featureCards/core/cardPrimitives";
import { fetchError } from "@/copy/errors";
import "./FetchErrorCard.css";

interface FetchErrorCardProps {
  /** Short label of what the page tried to load (e.g., "districts", "trails"). */
  subject: string;
  /** Raw error from the fetch site. `.message` is the only field read. */
  error?: unknown;
  /** Retry callback — called when the user taps the primary CTA. */
  onRetry?: () => void;
  /** When true, autofocus moves to the Retry button on mount (default true). */
  autoFocus?: boolean;
  /** Test hook. */
  "data-testid"?: string;
}

const messageOf = (error: unknown): string | null => {
  if (!error) return null;
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return null;
};

export const FetchErrorCard = ({
  subject,
  error,
  onRetry,
  autoFocus = true,
  "data-testid": testId,
}: FetchErrorCardProps): JSX.Element => {
  const { title, body } = fetchError(subject);
  const retryRef = useRef<HTMLButtonElement>(null);
  const detail = messageOf(error);

  useEffect(() => {
    if (autoFocus && retryRef.current) {
      retryRef.current.focus();
    }
  }, [autoFocus]);

  return (
    <div role="alert" data-testid={testId}>
      <TipBlock heading={title} intent="warning">
        {body}
        {detail ? (
          <>
            {" "}
            <small className="fetch-error__detail">(Detail: {detail})</small>
          </>
        ) : null}
        <div className="fetch-error__actions">
          {onRetry ? (
            <button
              ref={retryRef}
              type="button"
              className="fwp-pill-button fwp-pill-button--primary fwp-pill-button--sm"
              onClick={onRetry}
              aria-label={`Try loading ${subject} again`}
            >
              <RotateCcw size={14} strokeWidth={2.25} aria-hidden />
              <span className="fwp-pill-button__label">Try again</span>
            </button>
          ) : null}
        </div>
      </TipBlock>
    </div>
  );
};
