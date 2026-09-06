/**
 * @file check-container-config.test.mjs
 * @module engage-mt/scripts
 * @description Container hygiene rules: health checks, non-root users, and
 *              probe-path parity with the hosting config.
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
import { checkContainerConfig } from "./check-container-config.mjs";

const good = {
  webDockerfile: "FROM nginx\nUSER root\nRUN x\nUSER nginx\nHEALTHCHECK CMD wget http://127.0.0.1:8080/healthz\n",
  apiDockerfile: "FROM node\nUSER node\nHEALTHCHECK CMD node -e \"fetch('http://127.0.0.1:8080/api/v1/healthz')\"\n",
  compose: "services:\n  db:\n    image: x\n    healthcheck:\n      test: a\n  web:\n    image: y\n    healthcheck:\n      test: b\n\nvolumes:\n  pgdata:\n",
  webRailway: JSON.stringify({ deploy: { healthcheckPath: "/healthz" } }),
  apiRailway: JSON.stringify({ deploy: { healthcheckPath: "/api/v1/healthz" } }),
};

test("a compliant configuration passes", () => {
  assert.deepEqual(checkContainerConfig(good), []);
});

test("missing HEALTHCHECK, root USER, unprobed service, and path drift are reported", () => {
  const problems = checkContainerConfig({
    ...good,
    apiDockerfile: "FROM node\nUSER root\n",
    compose: "services:\n  db:\n    image: x\n",
    webRailway: JSON.stringify({ deploy: { healthcheckPath: "/" } }),
  });
  assert.ok(problems.some((p) => /server\/Dockerfile: no HEALTHCHECK/.test(p)));
  assert.ok(problems.some((p) => /server\/Dockerfile: does not end as a non-root USER/.test(p)));
  assert.ok(problems.some((p) => /service "db" has no healthcheck/.test(p)));
  assert.ok(problems.some((p) => /web: HEALTHCHECK path \/healthz != railway.json healthcheckPath \//.test(p)));
});
