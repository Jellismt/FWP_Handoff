# Native assets

> Binary asset replacement is design work; this doc tells the designer exactly which files to drop where.

## App icon (1024×1024 master)

Source artwork: FWP wordmark + Montana silhouette on FWP Blue `#002855` background. Provide as 1024×1024 PNG with no transparency.

### iOS — drop in `mobile/ios/App/App/Assets.xcassets/AppIcon.appiconset/`

Replace `AppIcon-512@2x.png` (Xcode auto-generates the rest). The `Contents.json` manifest already lists the sizes Xcode expects:

```
20x20  @1x @2x @3x
29x29  @1x @2x @3x
40x40  @1x @2x @3x
60x60  @2x @3x
1024x1024 @1x (App Store marketing)
```

Use [Bakery](https://github.com/ngs/iconbakery) or `xcodebuild` asset-catalog tools to generate the matched set from the 1024 master.

### Android — drop in `mobile/android/app/src/main/res/`

Adaptive icon: two layers — foreground (Montana silhouette) and background (FWP Blue). Place at:

```
mipmap-hdpi/ic_launcher.png          72×72
mipmap-mdpi/ic_launcher.png          48×48
mipmap-xhdpi/ic_launcher.png         96×96
mipmap-xxhdpi/ic_launcher.png       144×144
mipmap-xxxhdpi/ic_launcher.png      192×192
mipmap-anydpi-v26/ic_launcher.xml   (adaptive layers definition — already wired)
drawable/ic_launcher_foreground.xml (or .png in 432×432)
values/ic_launcher_background.xml  (color = #002855)
```

Or run `npx cordova-res android --skip-config --copy` from `mobile/` with a single 1024×1024 source PNG to auto-generate every density.

## Splash screen

Source artwork: a centered FWP wordmark on FWP Blue `#002855`. Capacitor's SplashScreen plugin scales the source to fit landscape + portrait.

### iOS — `mobile/ios/App/App/Assets.xcassets/Splash.imageset/`

Replace `splash-2732x2732.png` (the @2x master Xcode uses for storyboard fill).

### Android — `mobile/android/app/src/main/res/`

```
drawable-port-*/splash.png     (portrait, scaled per density)
drawable-land-*/splash.png     (landscape)
```

Run `npx cordova-res android --type splash --skip-config --copy` with a 2732×2732 master.

## Status bar

Already configured in `capacitor.config.ts`:
- background: FWP Blue `#002855`
- style: DARK (light icons on the dark blue surface)

No asset work needed.

## Keyboard appearance

Already configured:
- iOS: `style: dark`
- Android: native resize

No asset work needed.

## Verification

After replacing assets:

```bash
# iOS
cd mobile
npx cap sync ios
open ios/App/App.xcworkspace
# Run on simulator, watch first-launch splash + icon

# Android
npx cap sync android
open -a 'Android Studio' android/
# Run on emulator, watch first-launch splash + icon
```

If `npx cap sync` doesn't pick up changes, the issue is almost always cached `node_modules/.cache/capacitor/`; delete and retry.

## Source of truth

The single 1024×1024 PNG master + 2732×2732 splash master should be checked into `mobile/source-assets/` so a future designer or contractor has the originals.
