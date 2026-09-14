# Deploying the web app

The web app is a **static Vite bundle served by nginx**, built and served by
the root `Dockerfile`. Two stages:

1. **Builder** (`node:22-alpine`, digest-pinned) — `npm ci` for the workspace
   tree (runs the Calcite-asset postinstall), then a production Vite build.
   The image builds the SPA **from source in-container**, so the shipped bundle
   is always in lockstep with the checked-out commit — never a stale local
   `dist/`.
2. **Runtime** (`nginxinc/nginx-unprivileged:1.27-alpine`, digest-pinned,
   non-root) — serves `web/dist` with SPA fallback, cache rules, and the full
   security-header set.

```bash
docker build -t engage-mt-web \
  --build-arg VITE_FWP_API_BASE=https://<your-regs-api-host>/api/v1/fwp \
  .
docker run -p 8080:8080 engage-mt-web
```

## Build-time environment (baked into the bundle)

Vite inlines `VITE_*` variables **at build time** — a runtime service variable
on your host is invisible to the already-built JS. On platforms that separate
build args from service variables (e.g. Railway), the API base **must** be
supplied as a Docker build arg; a service variable alone silently produces a
bundle with no API base (the app then runs offline-first from the bundled regs
snapshot).

| Variable | Purpose |
|---|---|
| `VITE_FWP_API_BASE` | Regs Manager public API base, **including the `/api/v1/fwp` route prefix** (the client rewrites v1→v2 internally). The standard variable for web deploys. Declared as a Dockerfile `ARG`. |
| `VITE_FWP_API_V2_BASE` | Explicit v2 base — overrides everything when set. Rarely needed. |
| `VITE_FWP_REGS_API_BASE` | Regs-only base used by the **mobile** build, so regulations fetch live when online while all other data stays bundled. Not normally set for web deploys. |
| `VITE_BUILD_SHA` / `VITE_BUILD_DATE` | Build provenance, shown on the Diagnostics page. The built SHA is also served at `/build-sha.txt` — a quick "what commit is live?" endpoint. |

Leave every API base unset to build a fully offline bundle (cache → bundled
snapshot only) — this is exactly what the mobile pipeline does for
non-regulation data.

## Runtime environment

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `8080` | nginx listen port (envsubst-templated at container start) |
| `ANTI_ABUSE_ENABLED` | `1` | Master switch for the anti-scraping friction (User-Agent denylist, hotlink guard). Set `0` temporarily so a vulnerability scanner isn't 403'd. See [../security/anti-abuse.md](../security/anti-abuse.md). |

Health check: `GET /healthz` → 200 (exempt from the anti-abuse User-Agent
rules, so any probe can reach it). The image also declares a Docker
`HEALTHCHECK` against that path, so orchestrators without their own probe still
get container liveness. `/build-sha.txt` reports the deployed commit.

## Security headers

`web/nginx-security-headers.conf` ships the enforced header set — CSP, HSTS,
`X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`,
`X-Frame-Options`, COOP — included into **every** nginx `location{}` block
(nginx `add_header` does not inherit into locations that declare their own).
The dev-server config (`web/serve.json`) carries the same header set;
`npm run check:security-headers` fails the build if the two drift.

The CSP `connect-src`/`img-src` allowlists enumerate every external host the
app talks to (ESRI/ArcGIS services, USGS, NOAA, and your regs API host).
`npm run check:csp-allowlist` gates drift between code and CSP.

**You do NOT hand-edit the CSP for your regs API host.** The Docker build reads
the origin of `VITE_FWP_API_BASE` and injects it into the CSP `connect-src`
automatically — so setting that one build arg (below) keeps the app *and* the
browser CSP in agreement. (The source `web/nginx-security-headers.conf` +
`web/serve.json` keep a default host for the parity gate; only the built image
is rewritten.) You'd only touch the CSP by hand to add a *different* kind of
external host (a new data provider), not for the API host.

## Serving without Docker

The bundle is plain static files: `npm run build --workspace web` →
`web/dist/`. Any static host works if it provides (a) SPA fallback to
`index.html` and (b) the security headers above. `npm run start --workspace
web` runs a minimal local static server using `web/serve.json`.

## Platform notes (PaaS / Railway-style hosts)

- The repo-root `railway.json` selects the root `Dockerfile` for the web
  service; the health-check path `/healthz` and on-failure restarts are
  configured there (`check:container-config` keeps it in step with the image).
- Supply `VITE_FWP_API_BASE` as a **build argument** (see above) — not just a
  service variable.
- If the platform's CLI deploys by uploading the working tree, be aware:
  uncommitted local changes will deploy. Prefer deploying from a clean
  checkout of the release commit, and verify afterwards that
  `https://<web-host>/build-sha.txt` matches the commit you meant to ship.
