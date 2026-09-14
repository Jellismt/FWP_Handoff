/**
 * @file registryCoverage.test.tsx
 * @module engage-mt/map/featureCards
 * @description Coverage net for every renderer registered in the
 *              FeatureCard registry. Per `docs/rules/feature-cards.md`
 *              every Tier-2 renderer must be partial-data tolerant:
 *              `summary()` returns a string for any attrs shape, `Body`
 *              renders without throwing for empty attrs, `detailRoute`
 *              (when defined) either returns null or a string for empty
 * Attrs. covered the 10 highest-traffic renderers with
 *              fixture-driven content assertions; this file extends the
 *              net to every remaining registered layer id so accidental
 *              DOM-shape drift is caught on every PR.
 *
 *              The test loops `registeredLayerIds()` after the side-effect
 *              import has run, then for each id:
 *                - asserts `summary()` returns a non-empty string with the
 *                  fixture attrs (or `{}` if no fixture is declared).
 *                - renders `<Body />` inside MemoryRouter, asserting no
 *                  throw + at least one DOM node produced.
 *                - if `detailRoute` is declared, asserts it returns either
 *                  a string starting with `/` or `null`.
 *
 *              The assertions are intentionally shallow: high-traffic
 *              renderers keep their richer content tests in
 *              `renderers.test.tsx`. This file is the safety net for the
 *              long tail.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-02
 * @updated 2026-07-03
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
// Side-effect import — every Tier-2 renderer registers itself at module load.
import "../index";
import { registeredLayerIds, resolveFeature } from "@/components/map/featureCards/core/registry";
import { FIXTURE_ATTRS, fixtureProps } from "@/test/fixtures";

describe("FeatureCard registry coverage", () => {
  const ids = registeredLayerIds();

  it("registers a non-trivial set of renderers", () => {
    // Sanity check — + s found 47 renderers; the floor of 25
    // here just guards against accidental side-effect-import drops.
    expect(ids.length).toBeGreaterThanOrEqual(25);
  });

  for (const layerId of ids) {
    describe(`renderer "${layerId}"`, () => {
      const renderer = resolveFeature(layerId);

      it("is resolvable from the registry", () => {
        expect(renderer).toBeTruthy();
      });

      it("summary() returns a non-empty string from fixture (or empty attrs)", () => {
        if (!renderer) return;
        const attrs = FIXTURE_ATTRS[layerId] ?? {};
        const out = renderer.summary(attrs);
        expect(typeof out).toBe("string");
        expect(out.length).toBeGreaterThan(0);
      });

      it("Body renders without throwing", () => {
        if (!renderer) return;
        const Body = renderer.Body;
        const { container } = render(
          <MemoryRouter>
            <Body {...fixtureProps(layerId)} />
          </MemoryRouter>,
        );
        // Any DOM node — even a single empty wrapper — counts as a non-throw.
        expect(container.firstChild).toBeTruthy();
      });

      it("detailRoute (if defined) returns null or an in-app path", () => {
        if (!renderer || !renderer.detailRoute) return;
        const route = renderer.detailRoute(FIXTURE_ATTRS[layerId] ?? {});
        if (route !== null) {
          expect(typeof route).toBe("string");
          expect(route.startsWith("/")).toBe(true);
        }
      });
    });
  }
});
