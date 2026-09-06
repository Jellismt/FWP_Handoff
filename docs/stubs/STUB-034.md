# STUB-034 — External Share-Link Bridge (record-only; infeasible without a partnership)

| Field | Value |
|---|---|
| Status | AWAITING_FWP_ACCESS (blocked on a third-party partnership, not an FWP endpoint) |
| Feature | Resolving a proprietary third-party mapping-app share link into an openable pin |
| Stub File | **None** — there is nothing to stub; the format is proprietary and undecodable |
| Detect-and-guide | `isExternalShareLink()` in `web/src/services/field/shareLink.ts`; routed by `classifyLaunchUrl()` in `web/src/services/mobile/appLifecycle.ts` |
| Expected Endpoint | N/A — no public third-party resolution API exists |
| Auth | N/A |
| Owner of Real Endpoint | A commercial third-party mapping-app vendor |

> **Context.** A third-party mapping app hands a pin to a friend in three forms. Engage MT
> handles two of them and cannot handle the third:
>
> | Sender action | Engage MT result | Why |
> |---|---|---|
> | Other app → **Export** → `.gpx` / `.kml` file, then text / email / AirDrop | **Opens** | Standard formats; our GPX/KML parsers + the OS file-handler import them losslessly. The same path covers exports from any other mapping app or GPS device. |
> | Other app's in-app **Share** / **Send to Phone** → proprietary vendor link | **Cannot open** — detect-and-guide instead | Proprietary link into the vendor's servers/app. There is no public API to resolve it into coordinates + name. |
> | Plain coordinate / Apple-Maps link | Partial — lat/lon only | No name/icon/notes to recover. |
>
> This is a **third-party-side** limitation, not an Engage MT gap. Those vendors deliberately
> keep pins inside their apps. We do **not** register as an OS handler for those external
> domains (they belong to the vendor); detection only fires when a user actively brings such a
> link into the app.

## Current behavior (detect-and-guide)

When an external (non-`fwp.mt.gov`) third-party share link reaches the app (opened as a deep
link, or the receive page loaded without a valid `?d=` payload), the user sees plain-language
guidance rather than a dead end:

> **Was this a link from another app?** Some mapping apps' share links only open in that app.
> Ask the sender to **Export** the pin as a **GPX** or **KML** file and send that instead — then
> open it from your Field Tools.

Surfaced in `ReceiveSharePage.tsx` (guidance state) and `ImportDialog.tsx` (intro note).

## Replacement Plan

Only viable via a **business relationship**, not a code change:

1. FWP + a third-party vendor agree to an interop path (a "resolve share link" partner API, or
   an export-to-standard-format webhook).
2. If a resolution API materializes, add `web/src/services/stubs/externalShareBridge.stub.ts`
   behind a `useRealExternalBridge` flag and swap `classifyLaunchUrl`'s `external-guidance`
   branch to attempt a resolve-then-import before falling back to guidance.
3. Until then, this entry stays record-only. **Do not** attempt to scrape or reverse-engineer
   third-party share links — that is neither reliable nor appropriate for a public agency app.
