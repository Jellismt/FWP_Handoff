# STUB-035 — Bloomreach CMS (regulation map assets)

| Field | Value |
|---|---|
| Status | AWAITING_FWP_ACCESS |
| Feature | The regulation **maps/figures** — deer/elk region plates (book pp.30-41), antelope plates (pp.130-136), CWD samples map, bear distribution, sunrise-sunset zone map, cover, per-restricted-area maps — sourced from FWP's **Bloomreach** CMS |
| Stub (server) | `server/src/services/cms/provider.ts` (`BloomreachStubProvider`) |
| Stub endpoint | `GET /api/v1/cms-stub/assets/:docId` → a deterministic placeholder SVG map plate |
| Real client | `server/src/services/cms/provider.ts` (`BloomreachProvider`), inert until env is set |
| Expected Endpoint | `GET {BLOOMREACH_BASE_URL}/delivery/site/v1/channels/{BLOOMREACH_CHANNEL}/documents/{docId}` |
| Auth | None (Bloomreach public Delivery API) |
| Owner of Real Endpoint | FWP Communications / Web (Bloomreach content team) |

> **Server-side stub (deviation from the web-stub convention).** Unlike the other
> stubs (which live under `web/src/services/stubs/*.stub.ts`), this one lives in the
> **server** — the CMS is resolved server-side so the public v2 API can return a ready
> map URL. Because it is not a web stub it is deliberately absent from
> `web/src/services/stubs/registry.ts`, so `check:stubs` does not track it; this
> document is its record.

## How it's wired

`regs.cms_asset` rows carry a `cms_doc_id` (Bloomreach document id; placeholder rows use
`stub:<slug>`). Staff attach an asset to a region (`regs.region_asset`) / restricted area
/ content section. The public v2 endpoints (`GET /api/v2/fwp/hunting/regions`, `.../restricted-areas`)
resolve each `cms_doc_id` to a URL through `pickCmsProvider()`:

- No env set → `BloomreachStubProvider` → `…/api/v1/cms-stub/assets/<docId>` (placeholder SVG).
- `BLOOMREACH_BASE_URL` + `BLOOMREACH_CHANNEL` set → `BloomreachProvider` → the real
  Delivery-API document URL.

## Response (real Delivery API — expected shape)

```json
{
  "data": {
    "url": "https://cdn.fwp.mt.gov/…/deer-elk-region-3.png",
    "title": "Deer & Elk District Map — Region 3",
    "altText": "Region 3 deer and elk hunting district boundaries",
    "width": 1200, "height": 1600,
    "mimeType": "image/png",
    "lastModified": "2026-01-15T00:00:00Z"
  }
}
```

## Replacement Plan

1. Obtain the Bloomreach channel + base URL from FWP; set `BLOOMREACH_BASE_URL` +
   `BLOOMREACH_CHANNEL` on the `regs-api` service.
2. Replace each `cms_asset.cms_doc_id` placeholder (`stub:region-3-deer-elk`) with the
   real Bloomreach document id (staff can do this in the Assets screen).
3. `pickCmsProvider()` switches to `BloomreachProvider` automatically — no code change.
4. Flip this row to `REPLACED`.
