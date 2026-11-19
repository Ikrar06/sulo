package dev.ikrar.sulo.watch

import android.content.Context
import android.webkit.WebView
import com.getcapacitor.CapConfig

/**
 * Whether Android System WebView is new enough for the app (capacitor.config.ts
 * minWebViewVersion; Capacitor shows public/perlu-pembaruan.html otherwise).
 * Below it the app's code never runs, so the worker must not either: no
 * request to SIKOLA and no check scheduled until the WebView is updated.
 * Same reading as Capacitor's Bridge.isMinimumWebViewInstalled.
 */
object WebViewGate {
    fun supported(context: Context): Boolean = runCatching {
        val info = WebView.getCurrentWebViewPackage() ?: return false
        val config = CapConfig.loadDefault(context)
        supportedVersion(info.versionName, info.packageName, config.minWebViewVersion, config.minHuaweiWebViewVersion)
    }.getOrDefault(false)

    /** Pure: the first number in the version name against the minimum (Huawei's WebView has its own). */
    fun supportedVersion(versionName: String?, packageName: String?, min: Int, minHuawei: Int): Boolean {
        val major = versionName?.let { Regex("(\\d+)").find(it)?.value?.toIntOrNull() } ?: return false
        return major >= if (packageName == "com.huawei.webview") minHuawei else min
    }
}
