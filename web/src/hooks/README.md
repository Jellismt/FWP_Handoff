# `hooks/` — index by use-case

Cross-cutting custom hooks live flat here, named `use*`, tests co-located.
(Exception: a few **view-local** map hooks that only ever run inside the MapView
subtree are colocated under `components/map/` — e.g. `useMapHover`,
`useMapInteraction`, `useLayerVisibilitySync`. The rule: cross-module hooks live
here; hooks bound to one component subtree sit with that subtree.) Before writing
a new hook: the async patterns below are settled — don't hand-roll a fetcher or
a loading flag ([design-polish.md](../../../docs/rules/design-polish.md)).

## Async data (pick the right one)

| Hook            | Use when                                                             |
| --------------- | -------------------------------------------------------------------- |
| `useAsyncState` | Any async fetcher → `AsyncState` for `<AsyncBoundary>` (THE default) |
| `useFetchJson`  | Simple same-origin/public JSON GET (wraps useAsyncState)             |

## Domain data

`useDistrictRegulations` · `useDistrictEnrichment` ·
`useWeaponRestrictionArea` · `useWallet` — each wraps
one domain question; read its header for the contract.

## Hydrology & conditions (gage / station surfaces)

`useUsgsLatest` · `useDnrcStage` — the live-reading family behind the
stream-gage cards.

## Map & navigation

`useMapNavigation` (programmatic map moves) · `usePortionAtPoint`.

## Platform / device (Capacitor-aware)

`useLocate` (geolocation, on-device only) ·
`useTrackSave` — all platform-guarded per
[mobile.md](../../../docs/rules/mobile.md).

## UI mechanics

`useTheme` · `useToast` · `useFocusTrap` · `useMediaQuery`.
