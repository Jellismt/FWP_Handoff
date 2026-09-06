# `components/` — module ownership map

Every component has exactly one home. The five product modules follow the IA
ownership table in [docs/rules/ia.md](../../../docs/rules/ia.md) — read it
before deciding where a feature belongs (it also has the tie-breaker questions).

| Folder     | Owns                                                                                                                                                      | Accent    |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| `hunt/`    | Districts, season windows, regulations, CWD                                                                                                               | FWP red   |
| `fish/`    | Fish module landing + regs surfaces                                                                                                                       | FWP blue  |
| `explore/` | Parks, WMAs, trails                                                                                                                                       | brown     |
| `access/`  | "Where can I legally be?" — cadastral, BMA                                                                                                                | FWP green |
| `manage/`  | Wallet & sign-in, TipMont, offline maps, settings                                                                                                         | graphite  |
| `map/`     | The universal substrate: MapView, layer panel, tap-query, `featureCards/` (popup registry — see [feature-cards.md](../../../docs/rules/feature-cards.md)) | —         |
| `field/`   | Field tools UI (waypoints, tracks, import/receive) — capture is mobile-only                                                                  | —         |
| `shared/`  | Cross-module primitives, bucketed: `layout/` `feedback/` `overlays/` `notices/` `forms/` `search/` `widgets/` `pages/` `charts/` `tipMont/`               | —         |
| `dev/`     | DEV-only pages (showcase, data diff) — route-gated behind `import.meta.env.DEV`                                                                           | —         |

Conventions:

- A component + its CSS + its test are **co-located siblings** (`Foo.tsx`,
  `Foo.css`, `Foo.test.tsx`).
- A tool needed by two modules is **cross-listed, not duplicated** — one
  canonical home + an alias route.
- `shared/` bucket cheat-sheet: page skeletons & nav → `layout/`; async/error/
  loading states → `feedback/`; modals & tooltips → `overlays/`; banners &
  toasts → `notices/`; inputs & buttons → `forms/`;
  small display primitives (cards, tiles, chips, badges) → `widgets/`; static
  routed pages → `pages/`.
