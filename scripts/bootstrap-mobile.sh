#!/usr/bin/env bash
# @file bootstrap-mobile.sh
# @module engage-mt/scripts
# @description One-command mobile-build toolchain installer (macOS / Homebrew).
#              Installs + verifies JDK 21 (required by the Capacitor 8 plugin
#              toolchains), the Android SDK (cmdline-tools +
#              platform 34 + build-tools), CocoaPods, and fastlane, accepts
#              Android SDK licenses, and prints the shell exports needed for
#              `npm run apk`. Idempotent — safe to re-run.
# @author Jamie Ellis / Engage MT
# @created 2026-06-30
# @updated 2026-06-30
# @version 1.0.0
#
# FWP Engage MT — Montana's Official Gateway to the Outdoors
# Licensed under the MIT License.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"

echo "▶ Engage MT — mobile toolchain bootstrap"
echo ""

# --- guardrails -------------------------------------------------------------
if [ "$(uname)" != "Darwin" ]; then
  echo "⚠️  This installer targets macOS. On Linux, install JDK 21 + the Android"
  echo "    cmdline-tools manually (see docs/mobile/building.md), or ask a teammate"
  echo "    with the toolchain to run \`npm run apk\` and share the APK."
  exit 1
fi

if ! command -v brew >/dev/null 2>&1; then
  echo "❌ Homebrew not found. Install it first: https://brew.sh"
  exit 1
fi

# Homebrew shells out to the Xcode toolchain; if the license hasn't been
# accepted, every `brew install` fails with a confusing error. Catch it here
# with the exact fix (needs an interactive sudo password we can't supply for
# you).
if command -v xcodebuild >/dev/null 2>&1 && ! xcodebuild -license check >/dev/null 2>&1; then
  echo "❌ The Xcode license hasn't been accepted — Homebrew installs will fail."
  echo "   Run this once (it prompts for your password), then re-run bootstrap:"
  echo ""
  echo "     sudo xcodebuild -license accept"
  echo ""
  exit 1
fi

# JDK 21 — required by the Capacitor 8.4 plugins (e.g. @capacitor/camera
# declares a Java-21 toolchain). Gradle 8.11.1 runs on it fine.
JDK_VERSION="openjdk@21"
ANDROID_SDK_DIR="${ANDROID_HOME:-$HOME/Library/Android/sdk}"

# brew_install <formula-or-cask> <test-cmd> [--cask]
brew_install() {
  local pkg="$1" test_cmd="$2" cask="${3:-}"
  if eval "$test_cmd" >/dev/null 2>&1; then
    echo "  ✅ $pkg already present"
  else
    echo "  ▶ installing $pkg…"
    if [ "$cask" = "--cask" ]; then
      brew install --cask "$pkg"
    else
      brew install "$pkg"
    fi
  fi
}

# --- 1. JDK 17 --------------------------------------------------------------
echo "▶ Java (JDK 17)"
brew_install "$JDK_VERSION" "/opt/homebrew/opt/$JDK_VERSION/bin/java -version || java -version"
JAVA_HOME_PATH="$(brew --prefix $JDK_VERSION 2>/dev/null || echo /opt/homebrew/opt/$JDK_VERSION)"
echo ""

# --- 2. Android SDK (cmdline-tools) ----------------------------------------
echo "▶ Android SDK"
brew_install "android-commandlinetools" "command -v sdkmanager" --cask
# Homebrew puts sdkmanager on PATH; point it at our project SDK dir.
mkdir -p "$ANDROID_SDK_DIR"
if command -v sdkmanager >/dev/null 2>&1; then
  echo "  ▶ installing platform-tools, platform 36, build-tools 36.0.0…"
  yes | sdkmanager --sdk_root="$ANDROID_SDK_DIR" \
    "platform-tools" "platforms;android-36" "build-tools;36.0.0" >/dev/null
  echo "  ▶ accepting Android SDK licenses…"
  yes | sdkmanager --sdk_root="$ANDROID_SDK_DIR" --licenses >/dev/null || true
  echo "  ✅ Android SDK ready at $ANDROID_SDK_DIR"
else
  echo "  ⚠️  sdkmanager not on PATH yet — open a new shell and re-run this script."
fi
echo ""

# --- 3. CocoaPods + fastlane (iOS + store release) -------------------------
echo "▶ iOS / store-release tools"
brew_install "cocoapods" "command -v pod"
brew_install "fastlane" "command -v fastlane"
echo ""

# --- 4. shell exports -------------------------------------------------------
ZSHRC="$HOME/.zshrc"
EXPORT_BLOCK="# --- Engage MT mobile toolchain (added by bootstrap-mobile.sh) ---
export JAVA_HOME=\"$JAVA_HOME_PATH\"
export ANDROID_HOME=\"$ANDROID_SDK_DIR\"
export PATH=\"\$JAVA_HOME/bin:\$ANDROID_HOME/platform-tools:\$ANDROID_HOME/cmdline-tools/latest/bin:\$PATH\"
# --- end Engage MT mobile toolchain ---"

echo "▶ Shell environment"
if [ -f "$ZSHRC" ] && grep -q "Engage MT mobile toolchain" "$ZSHRC"; then
  echo "  ✅ ~/.zshrc already has the Engage MT toolchain exports"
else
  echo "  Add these to your shell (we did NOT edit ~/.zshrc automatically):"
  echo ""
  echo "$EXPORT_BLOCK" | sed 's/^/    /'
  echo ""
  read -r -p "  Append them to ~/.zshrc now? [y/N] " reply
  if [[ "$reply" =~ ^[Yy]$ ]]; then
    printf '\n%s\n' "$EXPORT_BLOCK" >> "$ZSHRC"
    echo "  ✅ appended to ~/.zshrc — run: source ~/.zshrc"
  else
    echo "  ↳ skipped. Add the block above manually, then: source ~/.zshrc"
  fi
fi
echo ""

# --- 5. verify --------------------------------------------------------------
echo "▶ Verifying…"
export JAVA_HOME="$JAVA_HOME_PATH"
export ANDROID_HOME="$ANDROID_SDK_DIR"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$PATH"
( cd "$REPO_ROOT/mobile" && npx cap doctor ) || true
echo ""
bash "$SCRIPT_DIR/doctor-mobile.sh" || true

echo ""
echo "✅ Bootstrap complete. Next: open a fresh shell (or source ~/.zshrc), then:"
echo "     npm run apk        # Android debug APK"
echo "     npm run ios:sim    # iOS simulator build"
