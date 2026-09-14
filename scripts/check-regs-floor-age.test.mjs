/**
 * @file check-regs-floor-age.test.mjs
 * @module engage-mt/scripts
 * @description Node test-runner coverage for the built-in regs copy gate:
 *              missing, unstamped, too-old, and expired snapshots fail; a
 *              fresh one passes and reports its version.
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
import { evaluateRegsFloor } from "./check-regs-floor-age.mjs";

const NOW = new Date("2026-09-06T00:00:00Z");
const snap = (meta) => ({ "hunting-regulations-unified": { meta, data: [] } });

test("missing or unreadable snapshot fails", () => {
  assert.equal(evaluateRegsFloor(null, NOW).problems.length, 1);
  assert.equal(evaluateRegsFloor("nope", NOW).problems.length, 1);
});

test("a snapshot without a generatedAt stamp fails", () => {
  assert.match(evaluateRegsFloor(snap({}), NOW).problems[0], /generatedAt/);
});

test("age beyond the limit fails, age within it passes", () => {
  const old = snap({ generatedAt: "2026-05-01T00:00:00Z", validUntil: "2027-02-28", version: 7 });
  assert.match(evaluateRegsFloor(old, NOW, 90).problems[0], /128 days old/);
  const fresh = snap({ generatedAt: "2026-08-20T00:00:00Z", validUntil: "2027-02-28", version: 8, effectiveDate: "2026-03-01" });
  const r = evaluateRegsFloor(fresh, NOW, 90);
  assert.deepEqual(r.problems, []);
  assert.equal(r.summary, "v8 · effective 2026-03-01 · valid until 2027-02-28 · 17 days old");
});

test("a past validUntil fails even when the file is recent", () => {
  const expired = snap({ generatedAt: "2026-09-01T00:00:00Z", validUntil: "2026-02-28", version: 7 });
  assert.match(evaluateRegsFloor(expired, NOW).problems[0], /expired on 2026-02-28/);
});
