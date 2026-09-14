# STUB-001 — MyFWP License Wallet

| Field | Value |
|---|---|
| Status | AWAITING_FWP_ACCESS |
| Feature | MyFWP License Wallet (licenses, e-tags, permits) |
| Stub File | `web/src/services/stubs/myFwpLicenses.stub.ts` |
| Expected Endpoint | `GET /api/myfwp/licenses` |
| Auth | Bearer (XMT OAuth 2.0) |
| Owner of Real Endpoint | FWP MyFWP / XMT team |

## Request

```http
GET /api/myfwp/licenses
Authorization: Bearer <xmt-token>
Accept: application/json
```

No query params for the canonical "fetch my wallet" call. A future `?year=YYYY` filter is possible.

## Response

```ts
interface LicenseWalletResponse {
  user: { id: string; name: string; alsId: string };
  licenses: License[];
  etags: ETag[];
  permits: Permit[];
}

interface License {
  id: string;
  type: string;            // Product name as MyFWP would return it
  validFrom: string;       // ISO date
  validTo: string;         // ISO date
  number: string;
  species?: string[];
}

interface ETag {
  id: string;
  species: string;          // "Whitetail Deer", "Elk", etc.
  region: number;           // FWP region 1–7
  district: string;
  status: "Issued" | "Tagged" | "Validated" | "Expired";
  issuedAt: string;
}

interface Permit {
  id: string;
  type: string;
  number: string;
  validFrom: string;
  validTo: string;
}
```

Example:

```json
{
  "user": { "id": "u_42", "name": "Test Hunter", "alsId": "ALS123456" },
  "licenses": [
    { "id":"L1","type":"Conservation License","validFrom":"2026-03-01","validTo":"2027-02-28","number":"CON-2026-001124" },
    { "id":"L2","type":"AIS Prevention Pass","validFrom":"2026-03-01","validTo":"2027-02-28","number":"AIS-2026-004417" },
    { "id":"L3","type":"Resident Sportsman Combo","validFrom":"2026-03-01","validTo":"2027-02-28","number":"SPM-2026-000891" },
    { "id":"L4","type":"Antelope License","validFrom":"2026-08-15","validTo":"2026-11-30","number":"ANT-2026-002310" }
  ],
  "etags": [
    { "id":"E1","species":"Whitetail Deer","region":3,"district":"380","status":"Issued","issuedAt":"2026-09-01T10:00:00Z" }
  ],
  "permits": [
    { "id":"P1","type":"Elk Shoulder Season","number":"ESS-2026-000789","validFrom":"2026-11-01","validTo":"2027-02-15" }
  ]
}
```

## Demo persona & licensing logic

The stub fixture is **not** an arbitrary grab-bag — it is one legally-coherent
persona: a Montana **resident** who bought the Sportsman combo and added the
tags it doesn't cover. It follows Montana's real licensing rules:

- **License `type` strings equal catalog `name` values exactly** — so the
  License Wizard's wallet-dedup ("already in wallet ✓, won't be re-charged")
  resolves them.
- **Universal prerequisites are present** — every fishing/hunting license
  requires a **Conservation License** *and* an **AIS Prevention Pass**
  (AISPP as universal prerequisite), plus a
  **Base Hunting License** for any tag (provided here inside the combo).
- **The Sportsman combo's coverage is not double-listed.** It bundles base
  hunt + general deer + general elk + black bear + upland + season fishing,
  so none of those appear as separate licenses. (This is exactly why the demo
  cannot also hold "Resident Fishing", "Upland Bird Stamp", etc.)
- **Every e-tag has a backing license.** Whitetail Deer → general deer (combo);
  Antelope (Buck) → the drawn Antelope License; Mule Deer (Doe) → the drawn
  Deer B (antlerless) License.
- **A preference point is not a license.** The Bighorn Sheep Preference Point
  is a draw-pool point and needs no underlying bighorn license to hold.

These invariants describe the fixture's intent; the shape and behaviour of the
stub itself are covered by
[`myFwpLicenses.stub.test.ts`](../../web/src/services/stubs/myFwpLicenses.stub.test.ts),
which runs in the verify gate. The licence-coherence rules above are not
independently asserted by a test — a reviewer changing the fixture should
re-read this list.

## Replacement Plan

1. Confirm endpoint URL + base path with FWP MyFWP team.
2. Confirm XMT OAuth scope strings.
3. Add the OAuth client (there is no auth service in this build — sign-in is inert).
4. Move logic from `myFwpLicenses.stub.ts` to a real client; preserve the same exported function signature.
5. Delete the stub file once tests pass against production.
6. Set this stub's status to `REPLACED` and keep the doc as historical record.
