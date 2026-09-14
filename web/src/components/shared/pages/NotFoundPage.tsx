/**
 * @file NotFoundPage.tsx
 * @module engage-mt/shared
 * @description Real 404 page. Replaces the prior silent
 *              `<Navigate to="/" replace />` catch-all in App.tsx so
 *              broken external links and typos read as a deliberate
 *              "page not found" with three useful CTAs instead of as
 *              "the homepage just loaded weirdly."
 *
 *              FWP voice: authoritative, accessible, no blame. The page
 *              reuses the shared `<EmptyStateCard>` primitive so its
 *              visual matches every other "nothing here" state in the
 *              app — there's no special 404 chrome, which is the right
 *              call: a 404 is one species of empty state.
 *
 *              Accessibility: the underlying EmptyStateCard renders
 *              `role="status"` + announces the title via the SR layer.
 *              The page also sets a `<title>` via `document.title` on
 *              mount so screen readers (and tab labels) reflect the
 *              actual state instead of stale "Engage MT".
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-02
 * @updated 2026-07-03
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { useEffect } from "react";
import { Compass } from "lucide-react";
import { useLocation } from "react-router-dom";
import { EmptyStateCard } from "@/components/shared/feedback/EmptyStateCard";
import "./NotFoundPage.css";

const TITLE = "Page not found — Engage MT";

export const NotFoundPage = (): JSX.Element => {
  const location = useLocation();

  useEffect(() => {
    const prior = document.title;
    document.title = TITLE;
    return () => {
      document.title = prior;
    };
  }, []);

  return (
    <section
      className="not-found-page fwp-mobile-safe-bottom"
      data-module="shared"
      aria-labelledby="not-found-heading"
    >
      <EmptyStateCard
        icon={Compass}
        module="shared"
        title="That page moved or never existed"
        body={
          <>
            We couldn&rsquo;t find anything at <code>{location.pathname}</code>. The link you
            followed may be out of date — Engage MT is under active development and routes
            occasionally shift. Pick a starting point below.
          </>
        }
        suggestions={[
          { label: "View map", href: "/" },
          { label: "Browse Hunt", href: "/hunt" },
          { label: "Browse Explore & Access", href: "/explore" },
        ]}
      />
    </section>
  );
};
