# Stub contracts

One contract doc per FWP endpoint the app stubs — `STUB-NNN.md`. Each documents
the expected request/response and the swap plan for when real access lands.
Convention: [docs/rules/data-stubs.md](../../docs/rules/data-stubs.md).

> **Frozen filenames.** `STUB-NNN.md` names are asserted by
> `web/src/services/stubs/registry.test.ts` (`swapDoc` must match
> `^docs/stubs/STUB-\d+\.md$`). Do **not** rename or subfolder them — it turns
> `npm run check:stubs` red.

The authoritative status registry is `web/src/services/stubs/registry.ts`
(gated by `npm run check:stubs`). Status vocabulary: `AWAITING_FWP_ACCESS` ·
`IN_DEV`.

## Contracts

| Doc                     | Feature                                             |
| ----------------------- | --------------------------------------------------- |
| [STUB-001](STUB-001.md) | MyFWP License Wallet                                |
| [STUB-034](STUB-034.md) | External share-link bridge (record-only)            |
| [STUB-035](STUB-035.md) | Bloomreach CMS (regulation map assets, server-side) |

STUB-035 is a server-side contract listed here for visibility; it lives in
`server/src/services/cms/`, not the web registry.

## Meta

| File                                         | What it covers                                   |
| -------------------------------------------- | ------------------------------------------------ |
| [rate-limit-policy.md](rate-limit-policy.md) | Rate-limit policy for external service calls     |

## Adding a stub

Follow [docs/rules/data-stubs.md](../../docs/rules/data-stubs.md): create
`STUB-NNN.md` (next free number), add the `.stub.ts` under
`web/src/services/stubs/`, and register it in `registry.ts` so `check:stubs`
stays green.
