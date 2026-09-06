# scripts/build-data

Build-time pipeline that produces the Tier-2 reference datasets under
`web/public/data/` plus the `data-manifest.json` that describes them.

Each dataset's rows live in a typed `sources/<dataset>.source.ts` module that
exports a `rows` array. `build_all.mjs` imports every source, writes the JSON
output, then regenerates the manifest with row counts, byte sizes, and a
`sha256` integrity hash per entry. `annotate-provenance.mjs` runs last and
stamps a `provenanceTier` on every manifest entry.

## Layout

```
scripts/build-data/
├── README.md                                this file
├── build_all.mjs                            orchestrator — builds every dataset + manifest
├── annotate-provenance.mjs                  post-pass — stamps provenanceTier on the manifest
├── build_regs_snapshot.mjs                  standalone — FWP Regs Manager API snapshot
├── lib/
│   └── provenanceTier.mjs                   shared source→tier classifier
└── sources/                                 typed dataset inputs (export `rows`)
    └── hunting-district-facts.source.ts
```

## Datasets

`build_all.mjs` builds the **freshness-tracked Tier-2 datasets** and writes their
manifest entries. Today that is one dataset:

| Manifest id              | Output file                                   |
| ------------------------ | --------------------------------------------- |
| `hunting-district-facts` | `web/public/data/hunting-district-facts.json` |
| `usgs-gages`             | `web/public/data/usgs-gages.json`             |

Add another by appending an entry to the `DATASETS` array in `build_all.mjs` and
creating `sources/<name>.source.ts` (exports a `rows` array).

### Manifest scope (what's tracked, and what's deliberately not)

`data-manifest.json` tracks **freshness-lifecycle** Tier-2 datasets only — the
ones that expire and need periodic refresh (integrity `sha256` + `effectiveDate`
gated by `check:manifest` + `check:data-freshness`). The other files under
`web/public/data/` are **intentionally excluded** because they are not
freshness-tracked — each is covered a different way:

| File(s) | Why not in the manifest | How it's covered instead |
|---|---|---|
| `montana-boundary.geojson`, `major-rivers.geojson`, `major-lakes.geojson` | Static reference geometry (a one-off GDAL transform of a fixed MSDI dataset — see below). No freshness lifecycle. | Committed + git-versioned; regenerated only if the MSDI source is revised. |
| `regs-snapshot.json` | Built by its own standalone `build_regs_snapshot.mjs`, not `build_all.mjs`. | Its own freshness gate: `npm run check:regs-floor` (reads the snapshot's internal `generatedAt`). |
| `cwd-check-stations.geojson` | Hand-committed reference data (CWD check stations pending an FWP feed). | Committed + git-versioned. |

**Do not force these into the freshness manifest** — the 12-month
`check:data-freshness` rule is for datasets that actually expire; applying it to
static geometry would require inventing effective dates. This split is a design
decision, not an oversight.

## Usage

```bash
# From web/:
npm run build:data          # build_all.mjs + annotate-provenance.mjs

# Or directly from repo root:
node --experimental-strip-types --no-warnings scripts/build-data/build_all.mjs
node scripts/build-data/annotate-provenance.mjs

# Regulations snapshot (fetches from the FWP Regs Manager API):
npm run data:regs           # from web/
```

Outputs land in `web/public/data/` plus a regenerated `data-manifest.json`.

## Conventions

1. **Source label** in the manifest is honest: `(sample fixture)` is carried
   until FWP-authoritative data is wired in.
2. **Manifest version** bumps when any dataset changes. Format: `YYYY.N-dev`
   while fixtures, `YYYY.N` once authoritative.
3. **Aggregate ≤ 6 MB.** `build_all.mjs` fails loud if total `sizeBytes`
   Exceeds the budget.
4. **Row counts auto-derived.** The builder writes each file then reads it back
   to record rows + bytes + sha256.

## Swap path to authoritative

When FWP supplies a CSV/JSON for a given domain:

1. Drop the file at `sources/<dataset>.fwp.csv` (or `.json`).
2. Update `sources/<dataset>.source.ts` to re-export rows parsed from the file
   (parser stays in the source file).
3. Drop the `(sample fixture)` suffix from the dataset's `source` label in
   `build_all.mjs`.
4. Drop the `-dev` suffix from the manifest version.
5. Run `npm run build:data` and commit the regenerated JSON + manifest.

## Schema evolution

When a dataset's schema changes:

1. Bump `schemaVersion` in the dataset's `DATASETS` entry in `build_all.mjs`.
2. Update `requiredSchemaVersion` in the consuming
   `web/src/services/sql/<domain>.<query>.sql.ts`.
3. Note the migration in `CHANGELOG.md`.

## Major rivers & lakes (`web/public/data/major-{rivers,lakes}.geojson`)

These two are **not** produced by `build:data` — they're a one-off GDAL
transform of a static Montana State Library dataset, regenerated only if the
source is ever revised. They are deliberately not in `data-manifest.json`:
like `montana-boundary.geojson` they are static reference geometry, not a
freshness-tracked Tier-2 dataset.

**Why bundled rather than a live service:** the MSDI NHD flowline service they
replaced is the full 269k-feature stream network, where every river arrives
shattered into reach segments (the Ruby River was 199 features, the Missouri
1,775) — a tap hit a 50 m fragment and labels repeated down the channel.
Dissolving by name fixes that, and you can only dissolve data you bundle.

Source: [Major Lakes and Streams in Montana, 1:100,000
scale](https://www.sciencebase.gov/catalog/item/4fff207de4b08406cdf65620) —
Montana State Library, public domain (TIGER-derived; `hd43a` arcs = streams,
`hd43p` polygons = waterbodies).

```bash
curl -L "https://www.sciencebase.gov/catalog/file/get/4fff207de4b08406cdf65620" -o hd43.zip
unzip hd43.zip
export SHAPE_RESTORE_SHX=YES   # hd43p ships a zero-length .shx

# Streams → one feature per named river; unnamed connector arcs kept as-is
# so the network stays visually continuous.
ogr2ogr -f GeoJSON major-rivers.geojson hd43a/hd43a.shp -dialect SQLite \
  -sql "SELECT ST_LineMerge(ST_Union(geometry)) AS geometry, NAME AS name, MAX(CLASS) AS class, ROUND(SUM(MILES),1) AS miles FROM hd43a WHERE NAME <> 'x' AND NAME IS NOT NULL GROUP BY NAME
        UNION ALL
        SELECT geometry, NULL AS name, CLASS AS class, ROUND(MILES,1) AS miles FROM hd43a WHERE NAME = 'x' OR NAME IS NULL" \
  -t_srs EPSG:4326 -simplify 0.0003 -lco COORDINATE_PRECISION=4 -lco RFC7946=YES

# Waterbodies → one feature per named lake/reservoir.
ogr2ogr -f GeoJSON major-lakes.geojson hd43p/hd43p.shp -dialect SQLite \
  -sql "SELECT ST_Union(geometry) AS geometry, NAME AS name, MAX(CLASS) AS class, SUM(ACRES) AS acres FROM hd43p WHERE NAME <> 'x' AND NAME IS NOT NULL GROUP BY NAME
        UNION ALL
        SELECT geometry, NULL AS name, CLASS AS class, ACRES AS acres FROM hd43p WHERE NAME = 'x' OR NAME IS NULL" \
  -t_srs EPSG:4326 -simplify 0.0003 -lco COORDINATE_PRECISION=4 -lco RFC7946=YES
```

`-simplify 0.0003` (~33 m) sits well inside the source's own 1:100k
generalization and both layers only draw at 1:1.5M or closer; it plus
4-decimal precision keeps the pair at ~7.5 MB (~1.8 MB gzipped). Result:
1,096 river features (989 named) and 299 named waterbodies.
