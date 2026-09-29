# Capacitor + plugins: keep the JavaScript bridge classes that are
# registered via reflection (R8 strips them otherwise and the app
# crashes with "plugin not registered" errors)
-keep class com.getcapacitor.** { *; }
-keep @com.getcapacitor.annotation.CapacitorPlugin class * { *; }
-keepclasseswithmembernames class * {
    @com.getcapacitor.annotation.* <methods>;
}

# AndroidX: keep entry points referenced from XML/manifests
-keep class androidx.appcompat.app.AppCompatActivity { *; }
-keep class * extends androidx.appcompat.app.AppCompatActivity

# Preserve line numbers for readable crash reports (dev builds)
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

# WebView JavaScript interface (Capacitor bridge)
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
