# Regs Manager — database & data model

Postgres, everything under the `regs` schema. **Stock Postgres 16+ — no
extensions required** (the DB is tabular; there is no PostGIS, no geometry
column). The whole schema is reproducible from the numbered migrations plus the
seed; content arrives via ETL loaders or a restored dump.

## How the schema is built

1. **Migrations** — numbered, append-only SQL in `server/src/db/migrations/`
   (`0001_lookups.sql` … `0027_portion_snapshot.sql`), applied in order by
   `npm run migrate` (`server/src/db/migrate.ts`). Never edit a shipped
   migration; add a new higher-numbered one.
2. **Seed** — `npm run seed` (`server/src/db/seed.ts`) idempotently inserts the
   stable reference vocabularies (regions, species, instrument/season/restriction
   types, the GIS-layer registry rows) and, on an empty DB, the first admin user
   from `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`.
3. **ETL** — the `etl:*` scripts load real regulation content (see below).

The container boot command runs **migrate → seed → serve**, so a fresh
Postgres becomes a working (empty-of-content) API on first start.

## The draft / published split

This is the heart of the data model. Two parallel worlds live in the same
schema:

- **Working (draft) tables** — `district`, `district_portion`,
  `restricted_area`, `opportunity`, `season_window`, `license_product`,
  `product_price`, `license_instrument`, `content_section`, `contact`,
  `important_date`, `district_note`, and their link tables. Staff edits land
  here. The unified draft view `v_regs_unified_draft` (and `v_fees_flat`)
  assembles them into the shape the app expects, for preview/validation.
- **Published snapshot tables** — `published_regulations`,
  `published_content`, `published_fees`, `published_contacts`,
  `published_important_dates`, `published_district_notes`. These are
  **immutable materializations** written only by the publish transaction.

`publish.ts` runs one transaction: validate the year → flip draft rows to
`PUBLISHED` → `SELECT` the unified view into the `published_*` tables → mark the
`season_year` `PUBLISHED` → insert a `publication` row (version, approver,
timestamp; `is_correction` + affected scope for v2+). **The public API reads
only the `published_*` tables**, so nothing staff type is ever visible until a
publish completes.

```
season_year: DRAFT ──publish──▶ PUBLISHED (publication v1)
                                    │
                     edit + re-publish ──▶ PUBLISHED (publication v2, is_correction)
```

`record_status` on the working rows (`DRAFT` / `PUBLISHED` / `ARCHIVED`) is what
the publish flip toggles; `season_year.status` tracks the year as a whole.

## Table groups

| Group | Tables |
|---|---|
| Reference vocabularies | `region`, `species`, `audience`, `season_type`, `instrument_type`, `restriction_type`, `legal_animal_class`, `animal_class_part`, `geography` |
| Geography (codes, not shapes) | `district`, `district_portion`, `restricted_area`, `district_rarea`, `district_note`, `gis_layer` |
| Opportunities & seasons | `opportunity`, `opp_restriction`, `season_window`, `hunt_area`, `hunt_area_member` |
| Licensing | `license_product`, `product_price`, `license_instrument` |
| Editorial content | `content_section`, `content_asset`, `cms_asset`, `source_document`, `important_date`, `contact` |
| Region/area map assets | `region_asset`, `rarea_asset` |
| Sunrise/sunset (legal hours) | `ss_zone`, `ss_zone_county`, `ss_time` |
| Publish snapshots | `published_regulations`, `published_content`, `published_fees`, `published_contacts`, `published_important_dates`, `published_district_notes`, `publication` |
| Staging (ETL landing) | `stg_dea_row`, `stg_antelope_row`, `stg_multi_district`, `stg_restricted_area`, `stg_ss_time`, `stg_youth_pthfv` |
| Auth & audit | `staff_user`, `staff_session`, `audit_log` (indexed by time, table, and `lower(changed_by)`) |
| Views | `v_regs_unified`, `v_regs_unified_draft`, `v_fees_flat` |

The `*_geom` tables you may see in early migrations (`district_geom`,
`portion_geom`, `rarea_geom`) are **retired** — migration `0020` drops the
geometry sidecars. They are why `SKIP_POSTGIS=1` exists: it skips the one legacy
PostGIS migration so a stock Postgres image applies cleanly, and the retirement
migration then removes the sidecars harmlessly. The shipped DB carries no
geometry.

## GIS linkage (no geometry in the DB)

Every geometry-bearing entity (`district`, `district_portion`,
`restricted_area`) stores a **code**, not a shape. The map layer that draws it
lives in FWP's public ESRI service. The canonical mapping — service URL, layer
id, and join field per entity kind — is
[`shared/src/arcgisLayers.ts`](../../shared/src/arcgisLayers.ts), imported by
both the server seed and the app. `gis_layer` mirrors this registry in the DB
(migration `0019`), and a static check (`scripts/qc/check-gis-registry.mjs`)
asserts the DB registry, the shared registry, and the web layer config agree.
This is the seam that makes the data **portable to Oracle or any SQL engine** —
there is no spatial type to migrate.

## ETL loaders

The `etl:*` scripts in `server/package.json` populate content from FWP source
materials. They land raw rows in the `stg_*` staging tables, then transform into
the working tables. Key ones:

| Script | Loads |
|---|---|
| `etl:phase-a` (`loadDeaJson`) | The DEA (district/species/audience) regulation matrix — the core content. |
| `sync:districts` / `etl:portions` / `etl:rekey-portions` | District + portion codes, synced from the FWP GIS layers. |
| `etl:antelope`, `etl:multi-district` | Species/structure-specific opportunity rows. |
| `etl:restricted-areas` | Restricted-area definitions. |
| `etl:fees-content`, `etl:pamphlet-content`, `etl:pamphlet-assets` | Fee schedule + pamphlet editorial content and assets. |
| `etl:important-dates`, `etl:contacts` | Season/application dates + contact directory. |
| `etl:sunrise-sunset`, `etl:sunrise-sunset-grid`, `etl:region-maps` | Legal-hours tables + region map assets. |
| `audit:book` (`auditBook.ts`) | Coverage audit — flags districts/species missing regulation rows before publish. |

`sync:districts` and `sync:portions` are the only loaders that reach the network
(they pull current codes from FWP's public GIS). The rest read curated files.

## What's in the repo vs. what's in a dump

- **In the repo (reproducible):** schema (migrations), reference vocabularies +
  GIS registry (seed), and everything the ETL loaders can rebuild from source
  materials.
- **Only in a database dump:** staff draft edits in progress, the `publication`
  history, and the `audit_log`. That is what
  [../deploy/db-backup-restore.md](../deploy/db-backup-restore.md) protects —
  back it up on a schedule and store dumps off-host.
