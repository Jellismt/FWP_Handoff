# Security policy

## Reporting a vulnerability

Report suspected vulnerabilities privately through GitHub's **Report a
vulnerability** form on this repository (Security → Advisories), or to the
repository owner directly. Do not open a public issue for security reports.
Expect an acknowledgement within five business days.

## What is in scope

- The public web app (`web/`) and its nginx image (root `Dockerfile`).
- The Regs Manager API and staff console (`server/`, `staff/`, `server/Dockerfile`).
- The Capacitor mobile wrappers (`mobile/`).

## How the repo defends itself

- `npm run verify` runs `npm audit --audit-level=moderate` across every
  workspace as a blocking step; findings are fixed by bumping, never allow-listed.
- The Content-Security-Policy is enforced and drift-gated (`check:csp-allowlist`,
  `check:security-headers`); see [docs/security/](docs/security/README.md).
- No credentials, keystores, or tokens are committed; deploy secrets live only
  in the hosting platform's variables. `scripts/ci.sh` runs a `gitleaks` scan
  when the binary is present; run it before publishing.
- The public app is local-first: no telemetry and no user location leaves the
  device ([docs/rules/privacy.md](docs/rules/privacy.md)).
