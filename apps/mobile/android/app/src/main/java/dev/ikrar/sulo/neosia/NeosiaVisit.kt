package dev.ikrar.sulo.neosia

import android.annotation.SuppressLint
import android.app.Activity
import android.view.View
import android.view.ViewGroup
import android.webkit.CookieManager
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.webkit.ScriptHandler
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature

/**
 * "Perbarui NEOSIA otomatis" (1.1.0, the user's choice, off by default):
 * when the app is opened and a visit is due, NEOSIA's Beranda loads in a
 * WebView nobody sees (1 x 1, transparent, not touchable), with the same
 * capture script and the same rules as the NEOSIA screen ([NeosiaActivity]):
 * the script only for NEOSIA's origin, taken away before any login page,
 * no addJavascriptInterface, no evaluateJavascript. NEOSIA's own app makes
 * its own requests; Sulo sends none. The WebView is dropped once data came
 * in (after a short settle), at NEOSIA's login, or after 30 seconds.
 * Main thread only.
 */
class NeosiaVisit(private val activity: Activity, private val done: (String) -> Unit) {
    private var webView: WebView? = null
    private var script: ScriptHandler? = null
    private var listening = false
    private var finished = false
    private val queue by lazy { CaptureQueue.of(activity) }

    @SuppressLint("SetJavaScriptEnabled")
    fun start() {
        if (!WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT) || !WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) return finish("unsupported")
        val source = runCatching { activity.assets.open("public/neosia-main.js").bufferedReader().use { it.readText() } }.getOrNull() ?: return finish("unsupported")
        CookieManager.getInstance().setAcceptCookie(true)
        val view = WebView(activity)
        webView = view
        view.settings.javaScriptEnabled = true
        view.settings.domStorageEnabled = true
        view.settings.allowFileAccess = false
        view.settings.allowContentAccess = false
        view.alpha = 0f
        view.isClickable = false
        view.isFocusable = false
        view.importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO_HIDE_DESCENDANTS
        view.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(v: WebView, request: WebResourceRequest): Boolean {
                val url = request.url.toString()
                if (!NeosiaRules.stays(url)) return request.isForMainFrame
                if (request.isForMainFrame && NeosiaRules.isLogin(url)) {
                    detach()
                    finish("needs_login")
                    return true
                }
                return false
            }

            override fun onPageStarted(v: WebView, url: String?, favicon: android.graphics.Bitmap?) {
                if (NeosiaRules.isLogin(url)) {
                    detach()
                    finish("needs_login")
                }
            }

            override fun doUpdateVisitedHistory(v: WebView, url: String?, isReload: Boolean) {
                if (NeosiaRules.isLogin(url)) {
                    detach()
                    finish("needs_login")
                }
            }
        }
        val origins = setOf(NeosiaRules.ORIGIN)
        WebViewCompat.addWebMessageListener(view, NeosiaRules.PORT, origins) { v, message, sourceOrigin, isMainFrame, _ ->
            val data = message.data
            if (NeosiaRules.judge(sourceOrigin.toString().trimEnd('/'), isMainFrame, v.url, data) == NeosiaRules.Verdict.ACCEPT && data != null) {
                runCatching { queue.append(data) }
                v.postDelayed({ finish("data") }, NeosiaActivity.DATA_SETTLE_MS)
            }
        }
        listening = true
        script = WebViewCompat.addDocumentStartJavaScript(view, source, origins)
        // Attached (a detached WebView may be throttled), but invisible and out of the way.
        (activity.window.decorView as? ViewGroup)?.addView(view, ViewGroup.LayoutParams(1, 1))
        view.loadUrl(NeosiaRules.url(NeosiaRules.Page.HOME))
        view.postDelayed({ finish("timeout") }, LIMIT_MS)
    }

    private fun detach() {
        val view = webView ?: return
        script?.remove()
        script = null
        if (listening) {
            WebViewCompat.removeWebMessageListener(view, NeosiaRules.PORT)
            listening = false
        }
    }

    private fun finish(result: String) {
        if (finished) return
        finished = true
        detach()
        webView?.let { v ->
            CookieManager.getInstance().flush()
            (v.parent as? ViewGroup)?.removeView(v)
            v.destroy()
        }
        webView = null
        done(result)
    }

    companion object {
        const val LIMIT_MS = 30_000L
    }
}
