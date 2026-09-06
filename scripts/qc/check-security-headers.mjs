#!/usr/bin/env node
/**
 * @file check-security-headers.mjs
 * @module engage-mt/scripts
 * @description Production-hardening parity gate. Engage MT ships its
 *              security headers (CSP + HSTS + friends) from TWO surfaces
 *              that MUST stay identical:
 *                • `web/serve.json` — read by the `serve` package on the
 *                  `npm run start` path (local + mobile static-serve).
 *                • the nginx `engage-security-headers.conf` snippet inlined
 *                  in the root `Dockerfile` — the ACTUAL production surface
 *                  on Railway.
 *
 *              The two drifted historically: serve.json carried a full
 *              header set while the nginx production path shipped NONE. This
 *              gate makes that class of bug impossible to miss — it parses
 *              both surfaces and fails when any header key is missing on
 *              either side or any value differs (whitespace-normalized).
 *
 *              Complements `check:csp-allowlist` (which guards the CSP
 *              connect-src allowlist against the code's actual upstreams).
 *              Together: code → serve.json → nginx all provably consistent.
 *
 *              Wired into `npm run check:security-headers` + `npm run verify`.
 *              See: docs/security/README.md.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-01
 * @updated 2026-07-14
 * @version 1.2.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..", "..");
const SERVE_JSON = resolve(REPO_ROOT, "web", "serve.json");
const DOCKERFILE = resolve(REPO_ROOT, "Dockerfile");
// The production nginx security headers live in a real file that the Dockerfile
// COPYs into the image (NOT an inline heredoc). BuildKit content-hashes a
// COPY-of-file, so a CSP change always invalidates the layer — a `COPY <<EOF`
// heredoc does NOT (its cache key is the instruction text, so a changed CSP
// would silently ship stale). Parse the file directly.
const NGINX_HEADERS_CONF = resolve(REPO_ROOT, "web", "nginx-security-headers.conf");

// The header keys that are the security contract. Cache-Control /
// content-type are per-route concerns handled separately, so they're
// intentionally NOT parity-checked here.
const SECURITY_HEADER_KEYS = [
  "Content-Security-Policy-Report-Only",
  "Content-Security-Policy",
  "Strict-Transport-Security",
  "X-Content-Type-Options",
  "Referrer-Policy",
  "Permissions-Policy",
  "X-Frame-Options",
  "Cross-Origin-Opener-Policy",
  // Corrected spelling of the real header (was the non-standard
  // "Cross-Origin-Embedding-Policy", which matched nothing). COEP is
  // intentionally NOT shipped on either surface — see docs/security/known-non-issues.md
  // (adding `credentialless` would require a full crossOriginIsolated map
  // re-verification for zero scan benefit). The key stays listed so that IF a
  // real COEP is ever added it is parity-enforced across both surfaces.
  "Cross-Origin-Embedder-Policy",
];

/** Collapse internal whitespace so multi-line vs single-line formatting
 * differences between the two surfaces don't read as a value mismatch. */
const norm = (v) => v.replace(/\s+/g, " ").trim();

// ─── 1. serve.json security headers ──────────────────────────────────
function parseServeJson() {
  const config = JSON.parse(readFileSync(SERVE_JSON, "utf8"));
  const block = config.headers?.find((h) => h.source === "**/*");
  if (!block) {
    console.error("✗ serve.json has no `**/*` header block");
    process.exit(1);
  }
  const out = new Map();
  for (const { key, value } of block.headers ?? []) {
    if (SECURITY_HEADER_KEYS.includes(key)) out.set(key, norm(value));
  }
  return out;
}

// ─── 2. nginx security-headers file (COPY'd by the Dockerfile) ───────
function parseDockerfileSnippet() {
  // Guardrail: the Dockerfile must actually COPY the headers file into the
  // snippet path, or the file would never reach nginx at runtime.
  const dockerText = readFileSync(DOCKERFILE, "utf8");
  if (
    !/COPY\s+web\/nginx-security-headers\.conf\s+\/etc\/nginx\/snippets\/engage-security-headers\.conf/.test(
      dockerText,
    )
  ) {
    console.error(
      "✗ Dockerfile no longer COPYs web/nginx-security-headers.conf into the nginx snippet path",
    );
    process.exit(1);
  }
  const text = readFileSync(NGINX_HEADERS_CONF, "utf8");
  const out = new Map();
  // add_header <Key> "<value>" [always];
  const lineRe = /^\s*add_header\s+(\S+)\s+"([^"]*)"\s*(?:always)?\s*;/;
  for (const line of text.split("\n")) {
    const lm = lineRe.exec(line);
    if (lm && SECURITY_HEADER_KEYS.includes(lm[1])) out.set(lm[1], norm(lm[2]));
  }
  return out;
}

// ─── 3. Compare ──────────────────────────────────────────────────────
const serve = parseServeJson();
const nginx = parseDockerfileSnippet();

// The Dockerfile rewrites one regs-API origin in the CSP to the deployed
// VITE_FWP_API_BASE origin. That literal must be the origin the CSP files
// actually carry, or a deployment silently keeps calling the wrong host.
{
  const dockerText = readFileSync(DOCKERFILE, "utf8");
  const sedHost = /sed -i "s#(https:\/\/[^#"]+)#/.exec(dockerText)?.[1];
  const csp = serve.get("Content-Security-Policy") ?? "";
  if (!sedHost) {
    console.error("✗ Dockerfile no longer rewrites the regs-API origin in the CSP (sed pattern missing)");
    process.exit(1);
  }
  if (!csp.includes(sedHost)) {
    console.error(`✗ Dockerfile rewrites ${sedHost}, but web/serve.json's CSP does not contain that origin`);
    process.exit(1);
  }
}

if (serve.size === 0) {
  console.error("✗ No security headers found in serve.json");
  process.exit(1);
}

const problems = [];

// Every serve.json security header must appear identically in nginx.
for (const [key, value] of serve) {
  if (!nginx.has(key)) {
    problems.push(`  • \`${key}\` present in serve.json but MISSING from Dockerfile nginx snippet`);
  } else if (nginx.get(key) !== value) {
    problems.push(
      `  • \`${key}\` value differs:\n      serve.json: ${value}\n      nginx     : ${nginx.get(key)}`,
    );
  }
}
// And no security header may exist only on the nginx side.
for (const key of nginx.keys()) {
  if (!serve.has(key)) {
    problems.push(`  • \`${key}\` present in Dockerfile nginx snippet but MISSING from serve.json`);
  }
}

if (problems.length > 0) {
  console.error("✗ Security-header drift between web/serve.json and the");
  console.error("  Dockerfile nginx snippet. The production (nginx) and");
  console.error("  static-serve (serve.json) surfaces must be identical.\n");
  console.error(problems.join("\n"));
  console.error("\n  Reconcile both, then re-run. See docs/security/README.md.");
  process.exit(1);
}

console.log(
  `✓ Security headers in lockstep across serve.json + Dockerfile nginx (${serve.size} headers)`,
);
