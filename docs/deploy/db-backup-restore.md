# Regs database — backup & restore

The regs Postgres is the system of record for staff-authored regulation edits,
publication history, and the audit log. **Schema and reference data are fully
reproducible from the repo** (`migrate up` + `seed` + the ETL loaders); the
dump protects what is *not* in the repo: staff draft edits, the `publication`
history, and `audit_log`.

## Backup

```bash
DATABASE_URL=postgres://… npm run db:backup -- --out /backups/regs --keep 30
```

`db:backup` runs `pg_dump --format=custom --no-owner --no-privileges` into the
output directory as `regs-YYYYMMDD-HHMM.dump`, prints the file's SHA-256, and
deletes dumps beyond the newest `--keep` (default 30). It warns when the local
`pg_dump` major version is older than the server's — **match the client to the
server** (on macOS: `brew install libpq`, binary at
`/opt/homebrew/opt/libpq/bin/pg_dump`). The API image ships no Postgres client,
so run this from an ops host, or from a throwaway container:

```bash
docker run --rm -e DATABASE_URL -v /backups/regs:/backups postgres:16-alpine \
  pg_dump --format=custom --no-owner --no-privileges -f /backups/regs-$(date -u +%Y%m%d-%H%M).dump "$DATABASE_URL"
```

Recommended practice:

- **Schedule it daily** (cron or your platform's scheduler) with the rolling
  window above.
- **Store dumps off the database host** (object storage, a backup share).
- **Layer it on top of your platform's automatic snapshots** if the host
  provides them — the portable dump is what lets you leave the host.
- Use the database's **public/proxy connection string** when dumping from
  outside the host's private network.

## Rehearse a restore (quarterly, and after any major upgrade)

```bash
SCRATCH_DATABASE_URL=postgres://…/regs_scratch npm run db:restore-rehearsal -- /backups/regs/regs-20260906-1405.dump --drop
```

The rehearsal refuses to run when `SCRATCH_DATABASE_URL` equals
`DATABASE_URL`, optionally drops and recreates the scratch database (`--drop`),
runs `pg_restore --no-owner --no-privileges`, then prints the row counts of
`published_regulations`, `publication`, `audit_log`, and `staff_user` and exits
non-zero if the restore failed or no published regulations came back. A green
rehearsal is the only proof a backup is usable.

## Restore to production (disaster recovery — destructive)

This stays a coordinated manual step. Announce the outage, then:

```bash
psql "$DATABASE_URL" -c "DROP SCHEMA IF EXISTS regs CASCADE;"
pg_restore --no-owner --no-privileges --dbname="$DATABASE_URL" regs-YYYYMMDD-HHMM.dump
```

Then restart the API container — its boot path (`migrate up → seed`) is
idempotent and will apply any migrations newer than the dump.

## Standing up a brand-new environment from a dump

1. Create an empty database; set `DATABASE_URL` on the API service.
2. `pg_restore` the dump as above (before or after first boot — the migration
   runner tolerates both, but restoring first is cleaner).
3. Boot the API; check `GET /api/v1/healthz` and spot-check
   `/api/v2/fwp/...` responses against the staff console's published version.
