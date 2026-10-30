# Keep JavaScript Interface methods
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Keep native methods
-keepclasseswithmembernames class * {
    native <methods>;
}

# Vosk Speech Recognition Rules
-keep class org.vosk.** { *; }
-dontwarn org.vosk.**

# JNA (Java Native Access) Rules required for Vosk
-keep class com.sun.jna.** { *; }
-keepclassmembers class * extends com.sun.jna.** { *; }
-keepclassmembers class * implements com.sun.jna.** { *; }
-dontwarn com.sun.jna.**

# eSpeak NG TTS Engine Rules
-keep class com.reecedunn.espeak.** { *; }
-dontwarn com.reecedunn.espeak.**
