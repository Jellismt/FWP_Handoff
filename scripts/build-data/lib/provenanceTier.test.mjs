/**
 * @file provenanceTier.test.mjs
 * @module engage-mt/build-data
 * @description Default tier, upstream detection, demo signals, and overrides.
 * @author Jamie Ellis / Engage MT
 * @created 2026-09-06
 * @updated 2026-09-06
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyProvenanceTier } from "./provenanceTier.mjs";

test("defaults to demo-fixture when no authoritative upstream is named", () => {
  assert.equal(classifyProvenanceTier({ source: "Hand-typed list" }), "demo-fixture");
  assert.equal(classifyProvenanceTier({}), "demo-fixture");
});

test("names an authoritative upstream → extracted, unless a demo signal is present", () => {
  assert.equal(classifyProvenanceTier({ source: "FWP Wildlife — districts" }), "extracted");
  assert.equal(classifyProvenanceTier({ source: "USGS NWIS Site Service" }), "extracted");
  assert.equal(classifyProvenanceTier({ source: "USGS sample fixture" }), "demo-fixture");
});

test("an explicit tier wins and unknown tiers throw", () => {
  assert.equal(classifyProvenanceTier({ source: "x", provenanceTier: "authoritative" }), "authoritative");
  assert.throws(() => classifyProvenanceTier({ provenanceTier: "guess" }));
});
