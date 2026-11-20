package dev.ikrar.sulo.neosia

import android.content.Intent
import android.webkit.WebView
import androidx.activity.result.ActivityResult
import com.getcapacitor.annotation.ActivityCallback
import androidx.webkit.WebViewFeature
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import dev.ikrar.sulo.BuildConfig

/**
 * SuloNeosia (M8d B0): opens a NEOSIA page from a tap, and reads the trial's
 * counters. Debug builds only for now (the trial); the release build answers
 * every call with an error and opens nothing.
 */
@CapacitorPlugin(name = "SuloNeosia")
class SuloNeosiaPlugin : Plugin() {
    /** Opens one of NeosiaRules.Page in the NEOSIA screen. Called only from a tap in the app. */
    private val store by lazy { NeosiaStore.of(context) }
    private val queue by lazy { CaptureQueue.of(context) }
    private val io = java.util.concurrent.Executors.newSingleThreadExecutor()

    @PluginMethod
    fun open(call: PluginCall) {
        // Release builds too since M8d B2 (only from a tap in the app; the WebView features are checked first).
        val page = NeosiaRules.page(call.getString("page")) ?: return call.reject("unknown page")
        val intent = Intent(context, NeosiaActivity::class.java)
            .putExtra(NeosiaActivity.EXTRA_PAGE, page.name)
            .putExtra(NeosiaActivity.EXTRA_CLOSE, call.getString("close") ?: "Tutup")
            // B0 "Bandingkan request": the same page without the script, closing itself.
            .putExtra(NeosiaActivity.EXTRA_SCRIPT, if (BuildConfig.DEBUG) call.getBoolean("script") ?: true else true)
            .putExtra(NeosiaActivity.EXTRA_AUTO_CLOSE_MS, (call.getInt("autoCloseMs") ?: 0).coerceIn(0, 30_000).toLong())
        startActivityForResult(call, intent, "neosiaClosed")
    }

    /** How the NEOSIA screen ended: signed_in (left the login page), needs_login (a page with the script reached the login page), or closed. */
    @ActivityCallback
    private fun neosiaClosed(call: PluginCall?, result: ActivityResult) {
        val how = when (result.resultCode) {
            NeosiaActivity.RESULT_SIGNED_IN -> "signed_in"
            NeosiaActivity.RESULT_NEEDS_LOGIN -> "needs_login"
            else -> "closed"
        }
        call?.resolve(JSObject().put("result", how))
    }

    /** Whether this WebView can capture at all (both features); without them NEOSIA is not offered. */
    @PluginMethod
    fun support(call: PluginCall) {
        val pkg = WebView.getCurrentWebViewPackage()
        call.resolve(
            JSObject()
                .put("docStart", WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT))
                .put("listener", WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER))
                .put("webViewPackage", pkg?.packageName ?: JSObject.NULL),
        )
    }

    /** The captures waiting since the NEOSIA screen was open (projected; core's gate runs next). The queue is empty after. */
    @PluginMethod
    fun takeCaptures(call: PluginCall) {
        io.execute { call.resolve(JSObject().put("messages", JSArray(queue.take()))) }
    }

    /** core's NEOSIA store for one SIKOLA account (src/platform/neosia-store.ts): encrypted values, endpoint-id keys. */
    @PluginMethod
    fun storeGet(call: PluginCall) {
        val user = call.getLong("user") ?: return call.reject("user missing")
        val key = call.getString("key") ?: return call.reject("key missing")
        io.execute { call.resolve(JSObject().put("value", store.get(user, key) ?: JSObject.NULL)) }
    }

    @PluginMethod
    fun storeSet(call: PluginCall) {
        val user = call.getLong("user") ?: return call.reject("user missing")
        val key = call.getString("key") ?: return call.reject("key missing")
        val value = call.getString("value") ?: return call.reject("value missing")
        io.execute {
            store.set(user, key, value)
            call.resolve()
        }
    }

    @PluginMethod
    fun storeRemove(call: PluginCall) {
        val user = call.getLong("user") ?: return call.reject("user missing")
        val keys = call.getArray("keys")?.toList<String>() ?: return call.reject("keys missing")
        io.execute {
            store.remove(user, keys)
            call.resolve()
        }
    }

    @PluginMethod
    fun storeKeys(call: PluginCall) {
        val user = call.getLong("user") ?: return call.reject("user missing")
        val prefix = call.getString("prefix") ?: ""
        io.execute { call.resolve(JSObject().put("keys", JSArray(store.keys(user, prefix)))) }
    }

    /** A new SIKOLA account: the previous account's NEOSIA data goes (or every account's with no user). */
    @PluginMethod
    fun wipe(call: PluginCall) {
        val user = call.getLong("user")
        io.execute {
            if (user != null) store.wipe(user) else store.wipeAll()
            queue.take()
            call.resolve()
        }
    }

    /** The trial's counters (labels and numbers only), the WebView's version and its features. */
    @PluginMethod
    fun trialStats(call: PluginCall) {
        if (!BuildConfig.DEBUG) return call.reject("not available")
        val snap = NeosiaTrial.snapshot()
        val out = JSObject()
        for ((k, v) in snap) {
            when (v) {
                is Map<*, *> -> out.put(k, JSObject().apply { v.forEach { (a, b) -> put(a.toString(), b as Int) } })
                is List<*> -> out.put(k, JSArray(v))
                null -> out.put(k, JSObject.NULL)
                else -> out.put(k, v)
            }
        }
        val pkg = WebView.getCurrentWebViewPackage()
        out.put("webView", "${pkg?.packageName ?: "?"} ${pkg?.versionName ?: "?"}")
        out.put("docStartSupported", WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT))
        out.put("listenerSupported", WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER))
        call.resolve(out)
    }

    @PluginMethod
    fun resetTrial(call: PluginCall) {
        if (!BuildConfig.DEBUG) return call.reject("not available")
        NeosiaTrial.reset()
        call.resolve()
    }
}
