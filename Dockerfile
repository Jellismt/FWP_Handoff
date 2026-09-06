# Self-building multi-stage deploy.
#
# WHY THIS CHANGED (away from "ship a pre-built dist verbatim"):
#   The old Dockerfile `COPY web/dist/` shipped whatever `dist/` happened
#   to be on disk at deploy time, which makes a deploy silently stale
#   whenever someone forgets to rebuild.
#
#   We now build the SPA from source INSIDE the container, so the shipped
#   bundle is always in lockstep with the committed source. node_modules
#   exists at build time, so the Calcite asset copy + Vite public-dir
#   mirror (icons, data, manifest) all happen deterministically.
#
# Stage 1 (builder)  node:20-alpine — npm ci + vite build.
# Stage 2 (runtime)  nginx:alpine    — serve the built dist (~25 MB base).

# ── Stage 1: build the Vite SPA from source ──────────────────────────
# Digest-pinned for reproducible, CVE-assessable builds (CIS supply-chain).
# Renovate (pinDigests) bumps the digest; the trailing tag comment is the
# human-readable anchor. To re-pin: query the Docker Hub manifest-list digest
# for the tag and update both the digest and the comment in lockstep.
# Digest tag anchor: node:22-alpine
FROM node:22-alpine@sha256:16e22a550f3863206a3f701448c45f7912c6896a62de43add43bb9c86130c3e2 AS builder

WORKDIR /app

# Build-time provenance — surfaced on the Diagnostics page via
# VITE_BUILD_SHA / VITE_BUILD_DATE and served at /build-sha.txt.
#
# Railway names this RAILWAY_GIT_COMMIT_SHA, and only populates it for a
# repo-CONNECTED service (a `railway up` CLI upload has no commit, so it
# arrives empty and the fallback chain below takes over). Do NOT try to
# bridge the two with a service variable of `${{RAILWAY_GIT_COMMIT_SHA}}`
# — that reference syntax does not resolve at build time and silently
# renders to an EMPTY string, which is strictly worse than "docker"
# because it makes /build-sha.txt blank rather than obviously-unset.
ARG RAILWAY_GIT_COMMIT_SHA=
ARG VITE_BUILD_SHA=docker
ENV VITE_BUILD_SHA=${VITE_BUILD_SHA}

# Regs Manager API base — the public web bundle reads DEA hunting regs from the
# FWP Regs Manager API at build time. Vite ONLY inlines VITE_* from .env files /
# the build environment; Railway *service* variables are invisible to `docker
# build`, so the base URL MUST arrive as a build ARG (a service var alone
# silently produces a bundle with no API base → RegsUnavailableError in the app).
# Must include the /api/v1/fwp route prefix (server/src/app.ts registers
# publicRoutes there). Override at build time with --build-arg for a different
# host (e.g. the FWP in-house deploy). The Capacitor build sets this EMPTY for
# offline-first — do not rely on this default there.
ARG VITE_FWP_API_BASE=https://regs-api-production.up.railway.app/api/v1/fwp
ENV VITE_FWP_API_BASE=${VITE_FWP_API_BASE}

# Copy the workspace manifests + the full web workspace BEFORE `npm ci`
# so web's postinstall (copy-calcite-assets.mjs, which reads web/public
# and node_modules) has everything it needs in one pass. mobile is a
# workspace too, so its manifest must be present for lockfile resolution.
COPY package.json package-lock.json ./
COPY mobile/package.json mobile/package.json
COPY web/ web/

# Install the full workspace tree from the lockfile (runs web's calcite
# postinstall). Builder stage only — discarded in the final image.
RUN npm ci --no-audit --no-fund

# The ArcGIS SDK bundle pushes Vite past Node's default heap on smaller
# build runners (OOM, exit 134). Bump to 4 GB so the build stays robust.
ENV NODE_OPTIONS=--max-old-space-size=4096

# Stamp build provenance, then build. Vite auto-loads .env.production in
# production mode; `date` is provided by busybox in alpine.
#
# SHA source of truth, in precedence order — the last link is a literal so
# this can never resolve to the empty string:
#   1. web/.deploy-sha   — written by scripts/deploy.sh into the clean archive
#   2. RAILWAY_GIT_COMMIT_SHA — a repo-connected Railway deploy (short-formed)
#   3. VITE_BUILD_SHA    — explicit --build-arg, or the "docker" ARG default
#   4. "docker"          — belt-and-braces if either arg arrives set-but-empty
# After the build we drop the SHA at dist/build-sha.txt so it's served at
# /build-sha.txt — a grep-free "what commit is live?" endpoint that
# scripts/deploy.sh polls to confirm the exact commit went live (and to catch
# a concurrent clobber).
RUN SHA="$(cat web/.deploy-sha 2>/dev/null \
      || echo "${RAILWAY_GIT_COMMIT_SHA:-${VITE_BUILD_SHA:-docker}}" | cut -c1-7)" \
 && SHA="${SHA:-docker}" \
 && printf 'VITE_BUILD_SHA=%s\nVITE_BUILD_DATE=%s\nVITE_FWP_API_BASE=%s\n' \
      "$SHA" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$VITE_FWP_API_BASE" \
      > web/.env.production \
 && npm run build --workspace web \
 && printf '%s' "$SHA" > web/dist/build-sha.txt

# ── Stage 2: static nginx server (non-root) ──────────────────────────
# nginx-unprivileged runs as uid 101 (`nginx`), writes its pid to /tmp, and
# pre-chowns the cache/temp dirs — so the container satisfies CIS Docker 4.1
# ("run as a non-root user") with no manual user setup, and we drop the old
# root-only runtime `sed` PORT patch in favour of the base image's envsubst
# templating entrypoint. Digest-pinned (see Stage 1 note).
# Digest tag anchor: nginxinc/nginx-unprivileged:1.27-alpine
FROM nginxinc/nginx-unprivileged:1.27-alpine@sha256:65e3e85dbaed8ba248841d9d58a899b6197106c23cb0ff1a132b7bfe0547e4c0


# Security headers — the wire-level complement to the code-layer privacy
# posture (see docs/security/README.md + docs/rules/privacy.md).
#
# WHY THIS LIVES HERE (and not only in web/serve.json): production is
# served by THIS nginx image on Railway, NOT by the `serve` package —
# so serve.json's header block never reaches real traffic. Before this
# snippet the production site shipped ZERO security headers. The two
# surfaces are kept byte-for-byte in lockstep by the parity gate
# `npm run check:security-headers` (fails verify on drift).
#
# CSP is ENFORCED. A report-only sweep (all 3 basemaps, the full map-layer
# catalog, tap-query) mapped the complete allowlist, so enforcing it blocks
# nothing legitimate:
#   - connect-src server.arcgisonline.com (imagery basemap tiles) — added
#     (was only in img-src; the map fetches tiles via Fetch API = connect-src).
#   - connect-src data: (SVG map-pin markers fetched via Fetch API) — added.
#   - font-src static.arcgis.com (ArcGIS map-label glyphs) — added below.
#   - img-src mapservices.weather.noaa.gov (NOAA radar-reflectivity raster
#     tiles, loaded as <img>) — added (was only in connect-src); only visible
#     with the radar layer on.
#   - script-src 'wasm-unsafe-eval' — added. REQUIRED by the ArcGIS map engine,
#     which compiles/runs WebAssembly (the geometry engine + the WASM-based
#     Arcade expression evaluator) — that needs `wasm-unsafe-eval`. Note this is
#     the STRICTER form: plain `unsafe-eval` (arbitrary JS eval) is NOT granted.
#     This is NOT our code and is not configurable away without dropping the
#     ArcGIS renderer itself. It is the one directive relaxed —
#     everything else stays strict (default-src 'none', object-src 'none',
#     frame-ancestors 'none', a tight connect-src allowlist that still blocks
#     data exfiltration, base-uri/form-action 'self'), so enforce is a real
#     upgrade over report-only, which enforced nothing. Compensating control:
#     the app renders no untrusted HTML (local-first, no user-content HTML
#     sink), so the residual eval-XSS surface is minimal. See
#     developers.arcgis.com/javascript/latest/faq (CSP) + docs/security.
# TO ROLL BACK: re-append `-Report-Only` to the key in BOTH files + redeploy.
#
# The snippet is `include`d into EVERY location{} block below because
# nginx add_header does NOT inherit into a location that declares its
# own add_header (all three set Cache-Control) — so a server-level
# add_header would be silently dropped. `always` keeps the headers on
# error responses (404s) too.
COPY web/nginx-security-headers.conf /etc/nginx/snippets/engage-security-headers.conf

# Build-time CSP injection (ONE knob for a new deployment). The CSP `connect-src`
# must allow the regs-API origin, and the app fetches from VITE_FWP_API_BASE — so
# rewrite the default host in the CSP to the ORIGIN of that build arg. Result: a
# fresh project (e.g. FWP's Railway) sets ONLY VITE_FWP_API_BASE and the app +
# the browser CSP stay in agreement automatically — no separate CSP edit. The
# SOURCE files keep the default host, so the `check:security-headers` parity gate
# (which compares the source configs) is unaffected; only the image copy changes.
ARG VITE_FWP_API_BASE=https://regs-api-production.up.railway.app/api/v1/fwp
USER root
RUN FWP_ORIGIN="$(printf '%s' "$VITE_FWP_API_BASE" | sed -E 's#^(https?://[^/]+).*#\1#')" \
 && sed -i "s#https://regs-api-production.up.railway.app#${FWP_ORIGIN}#g" \
      /etc/nginx/snippets/engage-security-headers.conf
USER nginx

# SPA fallback + cache rules. Mirrors web/serve.json semantics.
#
# Shipped as an envsubst TEMPLATE (rendered to /etc/nginx/conf.d/default.conf
# by the base image entrypoint at container start) rather than COPY'd straight
# into conf.d — the entrypoint substitutes ${PORT} + ${ANTI_ABUSE_ENABLED} and
# then runs `nginx -g 'daemon off;'`. This replaces the old root-only `sed`
# PORT patch (a non-root user can't rewrite a root-owned conf.d file in place).
#
# ANTI-ABUSE (nginx-only — no serve.json equivalent): a few proportionate
# checks against casual curl/scraping + wholesale copying. NOT `add_header`
# lines, so they don't participate in the `check:security-headers` parity gate
# (which only compares the header keys in engage-security-headers.conf).
# serve.json can only express headers, so this friction is intentionally
# production-nginx-only — the asymmetry is documented, not drift. The
# ANTI_ABUSE_ENABLED master switch lets a vulnerability scan run without being
# 403'd (set the service var to 0 for the scan window). See docs/security/anti-abuse.md.
COPY web/nginx-default.conf /etc/nginx/templates/default.conf.template

# Ship the freshly-built dist from the builder stage.
COPY --from=builder /app/web/dist/ /usr/share/nginx/html/

# Only these two names are eligible for envsubst substitution, so nginx's own
# runtime variables ($host, $uri, $http_user_agent, $ua_blocked, …) are left
# intact in the rendered config. PORT defaults to 8080 for a plain `docker run`;
# Railway overrides it at runtime. ANTI_ABUSE_ENABLED=1 = friction on (normal ops).
ENV NGINX_ENVSUBST_FILTER="^(PORT|ANTI_ABUSE_ENABLED)$"
ENV PORT=8080

# Container-level liveness for orchestrators without their own probe. /healthz
# is exempt from the anti-abuse user-agent rules, so a plain wget can reach it.
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/healthz" >/dev/null || exit 1
ENV ANTI_ABUSE_ENABLED=1

# Explicit non-root user (the base image already defaults to this; stated here
# so a CIS/Docker scan sees the directive in our Dockerfile). Inherit the base
# ENTRYPOINT + CMD — do NOT re-declare CMD or the envsubst templating won't run.
USER nginx
