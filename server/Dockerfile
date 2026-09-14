# ============================================================================
# FWP Regs Manager — portable OCI image (doctrine: no vendor lock-in,
# env-var secrets, runs on any Docker host / K8s / Railway).
# Build context = repo ROOT (so shared/ + staff/ are reachable).
#   docker build -f server/Dockerfile -t fwp-regs-manager .
# One image serves the public read API, the staff CRUD API, and the staff SPA.
# ============================================================================

# ── Builder ────────────────────────────────────────────────────────────────
# Digest-pinned for reproducible, CVE-assessable builds (CIS supply-chain).
# Renovate (pinDigests) bumps the digest; the trailing tag comment is the anchor.
# Digest tag anchor: node:22-alpine
FROM node:22-alpine@sha256:16e22a550f3863206a3f701448c45f7912c6896a62de43add43bb9c86130c3e2 AS builder
WORKDIR /app

# Install deps against the root lockfile (workspaces).
COPY package.json package-lock.json ./
COPY shared/package.json ./shared/
COPY server/package.json ./server/
COPY staff/package.json ./staff/
# web + mobile are workspaces too; copy their manifests so `npm ci` resolves the
# lockfile, but we never build them here.
COPY web/package.json ./web/
COPY mobile/package.json ./mobile/
# --ignore-scripts: the root install runs every workspace's lifecycle hooks, and
# web's `postinstall` (calcite:assets → bash scripts/copy-calcite-assets.sh) needs
# bash + web/scripts, neither of which this server image copies. We build shared/
# staff/server explicitly below, and the server's deps (@node-rs/argon2, pg,
# esbuild-via-Vite) resolve their native binaries from platform optional-deps —
# no postinstall required. So skipping install scripts is both safe and necessary.
RUN npm ci --no-audit --no-fund --ignore-scripts

# Sources for the three workspaces we build.
COPY shared/ ./shared/
COPY server/ ./server/
COPY staff/ ./staff/

RUN npm run build --workspace @engage-mt/regs-shared \
 && npm run build --workspace @engage-mt/regs-staff \
 && npm run build --workspace @engage-mt/regs-server

# Prune dev deps for the runtime image (--ignore-scripts for the same reason as
# the install above: prune re-runs workspace lifecycle hooks, incl. web's bash one).
RUN npm prune --omit=dev --ignore-scripts

# ── Runtime ────────────────────────────────────────────────────────────────
# Digest tag anchor: node:22-alpine
FROM node:22-alpine@sha256:16e22a550f3863206a3f701448c45f7912c6896a62de43add43bb9c86130c3e2 AS runtime
WORKDIR /app
ENV NODE_ENV=production
# Non-DEA rows for the unified slug (optional; emitted by the web build pipeline).
# Bundled data path the compat endpoint reads is resolved relative to the server.

# Chromium for the staff print-to-PDF export (puppeteer-core drives it with
# --no-sandbox). We run the container as the non-root `node` user (below), which
# is the RECOMMENDED, safe way to use --no-sandbox — the dangerous combination is
# --no-sandbox AS ROOT, which this image no longer does (CIS Docker 4.1). ONLY the
# /print/book.pdf endpoint touches Chromium — the API, HTML proof, and ICML export
# never load it. Adds ~150 MB to the image; acceptable for a staff tool.
# (apk runs as root at build time, before the USER switch.)
RUN apk add --no-cache chromium nss freetype harfbuzz ca-certificates ttf-freefont
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/shared/dist ./shared/dist
COPY --from=builder /app/shared/package.json ./shared/package.json
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/server/package.json ./server/package.json
# migrations are .sql (not compiled) — copy them next to the compiled runner.
COPY --from=builder /app/server/src/db/migrations ./server/dist/db/migrations
COPY --from=builder /app/staff/dist ./staff/dist

WORKDIR /app/server
EXPOSE 8080

# Run as the non-root `node` user (uid 1000, shipped by the node:alpine base) for
# CIS Docker 4.1. The copied artifacts are world-readable and read-only at runtime;
# migrate/seed write only to Postgres over the network, and Chromium writes only to
# /tmp + $HOME — both writable by `node`. No chown of node_modules needed (avoids a
# large redundant layer). $PORT (8080) is >1024 so a non-root bind is fine.
ENV HOME=/home/node
USER node

# Container-level liveness for orchestrators without their own probe.
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/api/v1/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Migrate → seed (idempotent lookups + first admin) → boot. Railway restarts on failure.
CMD ["sh", "-c", "node dist/db/migrate.js up && node dist/db/seed.js && node dist/index.js"]
