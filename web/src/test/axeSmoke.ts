/**
 * @file axeSmoke.ts
 * @module engage-mt/test
 * @description Unit-level axe-core helper. Runs the axe engine against a
 *              rendered DOM subtree and returns violations. Two rule families
 *              are disabled because the happy-dom test environment computes no
 *              layout: `color-contrast` (needs pixel colors) and `region`
 *              (primitives render in isolation without page landmarks). Those
 *              are covered by the real-browser Playwright sweep
 *              (`npm run verify:e2e`). What DOES run reliably here — roles,
 *              accessible names, required ARIA attributes, duplicate ids,
 *              label associations — is exactly the regression class that slips
 *              past eslint-plugin-jsx-a11y's static checks.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-01
 * @updated 2026-07-01
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import axe, { type AxeResults, type RunOptions } from "axe-core";
import { expect } from "vitest";

/** Rules that require real layout / a full page — verified in Playwright, not here. */
const LAYOUT_DEPENDENT_RULES: RunOptions["rules"] = {
  "color-contrast": { enabled: false },
  region: { enabled: false },
};

/**
 * Run axe against `container` and assert zero violations. Throws with a
 * readable per-violation summary (id + affected node HTML) so a failure points
 * straight at the offending markup.
 */
export async function expectNoAxeViolations(
  container: Element,
  extraRules: RunOptions["rules"] = {},
): Promise<void> {
  const results: AxeResults = await axe.run(container, {
    rules: { ...LAYOUT_DEPENDENT_RULES, ...extraRules },
  });

  if (results.violations.length > 0) {
    const summary = results.violations
      .map((v) => `• [${v.id}] ${v.help}\n    ${v.nodes.map((n) => n.html).join("\n    ")}`)
      .join("\n");
    // Attach the summary to the assertion so vitest prints it on failure.
    expect(results.violations, `axe violations:\n${summary}`).toHaveLength(0);
  }
}
