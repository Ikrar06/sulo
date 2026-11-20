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

# Sulo (M8e E2). The plugins (SuloSession, SuloNeosia, SuloStore) are kept
# by Capacitor's own consumer rules (@CapacitorPlugin, @PluginMethod), the
# background worker by WorkManager's (ListenableWorker constructors), the
# activities by the manifest. Sulo itself uses no reflection, no
# addJavascriptInterface and no JSON mapping by class.
# Line numbers stay readable in a crash report the owner pastes by hand
# (there is no crash reporting service).
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

# WorkManager stores a worker's class name in its database: a renamed worker
# would leave the watching scheduled by an older version unable to run after
# an update. Names and constructors stay.
-keep class dev.ikrar.sulo.watch.WatchWorker { public <init>(android.content.Context, androidx.work.WorkerParameters); }
-keep class dev.ikrar.sulo.watch.WatchGuardWorker { public <init>(android.content.Context, androidx.work.WorkerParameters); }
