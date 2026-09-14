# `store/` — Zustand stores, by domain

One store = one file = one concern, named `<thing>Store.ts`, test co-located.
Grouped by domain:

| Folder     | Holds                                     | Examples                                                                                                                                                                                                                                                                                                                   |
| ---------- | ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `map/`     | Everything the map substrate needs        | `mapStore` (camera/extent), `layerStore` + `layerVisibilityStore` + `layerLoadStatusStore`, `mapModeStore` (persisted basemap + viewpoint), `mapNavStore`, `mapInteractionStore`, `mapViewRefStore`, `takeoverPopupStore`, `tapQueryFailureStore`, `highlightedFeatureStore`, `featureFocusStore`, `elevationProfileStore`, `tappedPortionStore` (map-tap → hunt-district code bridge) |
| `field/`   | Field-tool state                          | `fieldToolsStore` (waypoints/tracks/shapes), `fieldModeStore`, `pendingImportStore`, `offlineAoiDraftStore`, `offlineAreasStore`, `userGraphicsVisibleStore`                                                                                                                                                               |
| `app/`     | App-wide UI + device                      | `themeStore`, `toastStore`, `connectivityStore`                                                                                                                                                                                                                                                        |
| `account/` | Personal data (Manage-domain)             | `walletStore`, `tipMontStore`                                                                                                                                                                                                                                                                                              |
| root       | Persistence plumbing shared by all stores | `persistedKey.ts` (localStorage/Preferences key helpers), `capacitorPreferencesStorage.ts`                                                                                                                                                                                                                                 |

## Rules of the road

- **Persisting?** Use `createPersistedKey` / the helpers in `persistedKey.ts` —
  never a raw `localStorage` literal. Keys are UI state, never tracking
  ([privacy.md](../../../docs/rules/privacy.md)).
- **New state:** first ask whether it's really client state — data-shaped
  questions belong in the Tier-2 data layer, spatial in layers
  ([data-layer.md](../../../docs/rules/data-layer.md) decision tree).
- **Persisted-shape changes are high-risk** — no gate covers on-device key
  migration; write a migration and a test.
- Import stores by full path (`@/store/map/mapStore`) — no barrels.
