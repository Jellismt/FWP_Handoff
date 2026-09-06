# `mobile/assets/` — @capacitor/assets source masters

This is the source directory consumed by `@capacitor/assets`, which generates
every iOS and Android icon and splash density from the masters here. The
generated densities are committed, so a normal build needs nothing from this
directory; regenerate only when a master changes.

## Files

| File | Size | Purpose |
|---|---|---|
| `icon.png` | 1024×1024 | App icon master (no transparency) |
| `splash.png` | 2732×2732 | Launch splash, light |
| `splash-dark.png` | 2732×2732 | Launch splash, dark (brand stays FWP Blue in both modes) |

## ⚠️ Brand wordmark — finalize before store submission

The current splash is the **ENGAGE / MONTANA wordmark** on the FWP-Blue spine:
FWP Blue `#002855` ground, "ENGAGE" (FWP Blue) inside the FWP Yellow `#FFC72C`
arrow chip, "MONTANA" (FWP Yellow) centered on the line below — the stacked form
of the AppHeader wordmark. `icon.png` is still the "ENGAGE MT" text placeholder.
Both mean the app boots with brand chrome, not the default Capacitor logo. **Consider adding the Montana
silhouette per [`mobile/NATIVE-ASSETS.md`](../NATIVE-ASSETS.md) before store
submission.** Drop-in replacements at the same paths + sizes; no code change.

## Regenerate the native densities

`@capacitor/assets` is not a declared dependency — it is a one-off tool, run
through `npx` when a master actually changes:

```bash
cd mobile
npx @capacitor/assets generate --ios --android
npx cap sync           # copy generated assets into ios/ + android/
```

This regenerate step is part of the store-release flow — see
[`docs/mobile/store-release.md`](../../docs/mobile/store-release.md).

## How the masters were produced (for reference)

`splash.png` / `splash-dark.png` — the ENGAGE arrow chip + MONTANA below (chip
polygon sized to wrap the measured "ENGAGE" width; both texts centred):

```bash
# polygon coords come from the measured ENGAGE bbox at pointsize 240 (Arial-Bold)
magick -size 2732x2732 xc:'#002855' \
  -fill '#FFC72C' -draw "polygon 735,1022 1997,1022 2117,1180 1997,1338 735,1338" \
  -font Arial-Bold -gravity center -kerning 14 \
  -fill '#002855' -pointsize 240 -annotate +0-186 'ENGAGE' \
  -fill '#FFC72C' -pointsize 250 -kerning 16 -annotate +0+194 'MONTANA' splash.png

# icon.png (still the text placeholder):
magick -size 1024x1024 xc:'#002855' -gravity center \
  -fill '#FFC72C' -pointsize 150 -annotate +0-60 'ENGAGE' \
  -fill white   -pointsize 260 -annotate +0+130 'MT' icon.png
```
