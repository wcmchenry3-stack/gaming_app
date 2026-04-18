# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# react-native-reanimated
-keep class com.swmansion.reanimated.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }

# Expo modules — auto-linking uses reflection to instantiate module classes
-keep class expo.modules.** { *; }

# Sentry — native crash handler and ANR detection rely on reflection
-keep class io.sentry.** { *; }
-dontwarn io.sentry.**

# Preserve source file names and line numbers for readable Sentry crash reports
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile
