# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# If your project uses WebView with JS, uncomment the following
# and specify the fully qualified class name to the JavaScript interface
# class:
#-keepclassmembers class fqcn.of.javascript.interface.for.webview {
#   public *;
#}

# Uncomment this to preserve the line number information for
# debugging stack traces.
#-keepattributes SourceFile,LineNumberTable

# If you keep the line number information, uncomment this to
# hide the original source file name.
#-renamesourcefileattribute SourceFile

# ─── Q.23.P1.4 — keep rules for Capacitor 6 + WebView bridge ─────────
# Q.23 enabled `minifyEnabled true` for release builds. R8 / ProGuard
# strip unused symbols, but Capacitor's JS↔native bridge relies on
# reflection — without these keep rules the WebView gets a fully-shrunk
# binary and the JS calls into `Capacitor.Plugins.*` no-op silently.

# Keep all Capacitor core + plugin classes (annotated + reflected).
-keep public class com.getcapacitor.** { *; }
-keep public class * extends com.getcapacitor.Plugin

# Keep every plugin class registered via @CapacitorPlugin.
-keep @com.getcapacitor.annotation.CapacitorPlugin public class * {
    @com.getcapacitor.annotation.PermissionCallback <methods>;
    @com.getcapacitor.PluginMethod public <methods>;
}

# Keep all plugin method invocations (signatures matter at runtime).
-keepclassmembers class * {
    @com.getcapacitor.PluginMethod public *;
    @com.getcapacitor.annotation.PermissionCallback *;
    @com.getcapacitor.annotation.ActivityCallback *;
}

# WebView JS-interface bridge — Capacitor injects MessageHandler.
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# AndroidX + Material — keep public API used reflectively by themes.
-keep public class androidx.appcompat.app.AppCompatActivity { *; }
-keep public class androidx.coordinatorlayout.** { *; }

# Suppress R8 warnings for missing OkHttp / Conscrypt provider
# variants — these warn during shrink even though no code path
# reaches them on the Capacitor stack.
-dontwarn org.conscrypt.**
-dontwarn org.bouncycastle.**
-dontwarn org.openjsse.**

