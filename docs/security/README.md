# Security

Security & compliance docs. CSP is **enforcing** on both serving surfaces. Privacy is
a mission rule and lives in [../../docs/rules/privacy.md](../../docs/rules/privacy.md);
the CSP allowlist is gated by `npm run check:csp-allowlist` and header parity by
`npm run check:security-headers`.

> **Latest audit:** the SITSD Nessus + CIS L1 readiness audit —
> findings register, fixes, compliance mapping, the pre-scan checklist, and the
> two open Railway-infra items (public DB proxy + staff IP allowlist). The full
> audit report is not included in this repo.

| File | What it covers |
|---|---|
| [anti-abuse.md](anti-abuse.md) | nginx-edge anti-scraping friction (UA denylist, honeypot, robots policy) |
| [known-non-issues.md](known-non-issues.md) | Findings verified false, the COEP choice, and out-of-repo security items |

The enforced CSP lives in `web/serve.json` and the Docker nginx
`web/nginx-security-headers.conf` (kept in lockstep by `check:security-headers`);
`connect-src` is the outbound allowlist — trim it whenever a data source is removed.
