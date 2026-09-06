#!/usr/bin/env node
/**
 * @file check-container-config.mjs
 * @module engage-mt/scripts
 * @description Container hygiene gate: both images declare a HEALTHCHECK and
 *              run as a non-root USER, every compose service declares a
 *              healthcheck, and the web image's probe path is the one the
 *              hosting platform is told to hit (railway.json). Part of verify.
 * @author Jamie Ellis / Engage MT
 * @created 2026-09-06
 * @updated 2026-09-06
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (p) => readFileSync(resolve(ROOT, p), "utf8");

/** Pure checks over file contents; returns a list of problems (empty = pass). */
export function checkContainerConfig({ webDockerfile, apiDockerfile, compose, webRailway, apiRailway }) {
  const problems = [];
  const image = (label, text) => {
    if (!/^HEALTHCHECK\b/m.test(text)) problems.push(`${label}: no HEALTHCHECK instruction`);
    const users = [...text.matchAll(/^USER\s+(\S+)/gm)].map((m) => m[1]);
    if (users.length === 0 || users.at(-1) === "root") problems.push(`${label}: does not end as a non-root USER`);
  };
  image("Dockerfile", webDockerfile);
  image("server/Dockerfile", apiDockerfile);

  // Only the `services:` block — volumes/networks are top-level keys too.
  const servicesBlock = /^services:\n([\s\S]*?)(?=^\S|(?![\s\S]))/m.exec(compose)?.[1] ?? "";
  const services = [...servicesBlock.matchAll(/^  ([a-z][a-z0-9-]*):\n((?:    .*\n|\n)*)/gm)];
  if (services.length === 0) problems.push("docker-compose.yml: no services found");
  for (const [, name, body] of services) {
    if (!/^\s{4}healthcheck:/m.test(body)) problems.push(`docker-compose.yml: service "${name}" has no healthcheck`);
  }

  const probe = (text) => /HEALTHCHECK[\s\S]*?(\/[a-z0-9/._-]*healthz)/i.exec(text)?.[1];
  const railwayPath = (json) => JSON.parse(json)?.deploy?.healthcheckPath;
  if (probe(webDockerfile) !== railwayPath(webRailway)) {
    problems.push(`web: HEALTHCHECK path ${probe(webDockerfile)} != railway.json healthcheckPath ${railwayPath(webRailway)}`);
  }
  if (probe(apiDockerfile) !== railwayPath(apiRailway)) {
    problems.push(`api: HEALTHCHECK path ${probe(apiDockerfile)} != server/railway.json healthcheckPath ${railwayPath(apiRailway)}`);
  }
  return problems;
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const problems = checkContainerConfig({
    webDockerfile: read("Dockerfile"),
    apiDockerfile: read("server/Dockerfile"),
    compose: read("docker-compose.yml"),
    webRailway: read("railway.json"),
    apiRailway: read("server/railway.json"),
  });
  if (problems.length > 0) {
    for (const p of problems) console.error(`✗ ${p}`);
    process.exit(1);
  }
  console.log("✓ container config — HEALTHCHECK + non-root USER in both images; every compose service probed; probe paths match railway.json");
}
