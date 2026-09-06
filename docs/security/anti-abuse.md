# Anti-abuse friction — runbook

**Status:** Shipped
**Owner:** Jamie Ellis + FWP web team.
**Related:** [docs/rules/privacy.md](../../docs/rules/privacy.md)

A small, **proportionate** set of checks that make casual `curl`/bot access annoying
and the app harder to copy/replicate wholesale — **without hurting functionality**.
Engage MT is a client-only static SPA served by nginx (root `Dockerfile`, stage 2);
there is no app server, so all server-side friction lives in the nginx `default.conf`.
These are **speed-bumps, not walls** — every one is spoofable by a determined actor.
That is the intended altitude: a few checks, not a fortress on a public, all-data-is-
public government app.

## Why this is privacy-clean

Per [docs/rules/privacy.md](../../docs/rules/privacy.md) § "What about
anti-abuse / anti-scraping friction?": these checks inspect the request's own
`User-Agent` / `Referer` / path at the nginx edge. They do **not** fingerprint the
device, run a JS challenge, contact a third-party bot service, or store/transmit any
detection result. No CAPTCHA, no behavioral scoring, no client-side origin gate.

## The checks

### 1. User-Agent denylist → 403 (`Dockerfile` `default.conf`)
A `map $http_user_agent $ua_blocked` flags known automation UAs (`curl`, `wget`,
`python-requests`, `python-urllib`, `scrapy`, `httpie`, `libwww-perl`, `java/`,
`okhttp`, `axios`, `node-fetch`, **empty UA**); `if ($ua_blocked) { return 403; }` at
server scope.
- Real browsers + the **Capacitor WebView never match** — the mobile app is a *local
  bundle* and never fetches from this origin at all.
- Legit search crawlers (Googlebot/Bingbot) are **not** in the list — they're steered
  by robots.txt, not 403'd.
- Generic infra clients (`Go-http-client`) are **deliberately excluded** so a platform
  health check is never blocked.
- **Rollback footgun:** the empty-UA line is the single most likely false-positive for
  an infra readiness probe. **If a deploy reports UNHEALTHY, remove the `"" 1;` line
  first.**

### 2. Honeypot `/trap/` → 444
A visually-hidden, `aria-hidden`, `tabindex="-1"`, `rel="nofollow"` decoy anchor in
`web/index.html` points at `/trap/`. Real users + assistive tech never reach it; a
link-following scraper that ignores `nofollow` does. robots.txt `Disallow: /trap/`, and
nginx `location /trap/ { return 444; }` drops the connection with no body.
- Cheap deterrent now; **the clean high-signal trigger for a future FWP WAF/Cloudflare
  IP ban** — when the app moves behind an edge firewall, "hit `/trap/`" is a
  ready-made ban rule.

### 3. robots.txt hardening (`web/public/robots.txt`)
App pages stay crawlable (SEO). `Disallow: /data/ /assets/ /trap/`, `Crawl-delay: 10`,
and **AI/LLM scrapers declined by name** (GPTBot, ClaudeBot, anthropic-ai,
Google-Extended, CCBot, PerplexityBot, Bytespider, Amazonbot, Applebot-Extended,
Diffbot, ImagesiftBot, Omgilibot, FacebookBot, meta-externalagent, …).

### 4. Bundle provenance banner (`web/vite.config.ts`)
`build.rollupOptions.output.banner` prepends a `/*! Engage MT (fwp.mt.gov) —
Licensed under the MIT License. */` bang-comment to every emitted chunk. Terser
keeps bang-comments, so a scraped/minified bundle still carries its provenance.
Production sourcemaps are already off (`vite.config.ts` `build.sourcemap`), so the
source tree isn't published.

## The nginx ↔ serve.json asymmetry (intentional, not drift)

`web/serve.json` (the `serve` package path for `npm run start` + mobile static-serve)
can only express **headers**. The UA denylist and honeypot are nginx
directives with no serve.json equivalent, so they exist **only** on the production
nginx surface. This is expected:
- The parity gate `scripts/qc/check-security-headers.mjs` compares **only the 8
  security-header keys** inside the `engage-security-headers.conf` heredoc. None of
  these anti-abuse directives are `add_header` lines, so **they don't affect the gate**
  — `npm run check:security-headers` stays green.
- `serve` is a dev/mobile convenience, not the production edge; the friction that
  matters is on the real (nginx) surface.

## Verification

Local (`serve` path can't exercise the nginx-only rules — headers/robots/banner only):

```bash
npm run check:security-headers                 # must still pass (headers untouched)
npm run build --workspace web
grep -l "Montana Fish" web/dist/assets/*.js    # banner present in a chunk
npx serve web/dist --listen 4199 --single --no-clipboard &
curl -s http://localhost:4199/robots.txt       # new policy
```

After a deploy of the nginx image:

- Deploy status **SUCCESS** + site returns **200** in a browser (health check survived
  the UA block — if not, pull the empty-UA line, check #1).
- `curl -sI https://<prod>/` → **403** (UA block).
- Browser load → **200**; map + Tier-2 data render with **no 403s** in the
  network panel.
- `curl -s https://<prod>/trap/` → connection dropped (444).
- `curl -s https://<prod>/robots.txt` → new policy.

## What we deliberately do NOT do

- **No rate-limiting** — Railway's edge proxy collapses client IPs (naive
  `$remote_addr` would throttle everyone as one bucket) and CGNAT risks nicking real
  rural users. The honeypot + UA checks cover the casual-scraper case instead.
- **No client-side origin gate / "unofficial copy" notice** — strippable from an open
  bundle and risks a false-positive on a future FWP domain.
- **No CAPTCHA / JS challenge / fingerprinting / third-party bot service** — privacy-
  rule and CSP violations, and overkill for a public government app.
