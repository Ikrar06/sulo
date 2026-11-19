package dev.ikrar.sulo.neosia

import android.annotation.SuppressLint
import android.app.Activity
import android.graphics.Bitmap
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.text.TextUtils
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.view.WindowInsets
import android.webkit.CookieManager
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.ImageButton
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import androidx.webkit.ScriptHandler
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import dev.ikrar.sulo.BuildConfig
import dev.ikrar.sulo.R
import dev.ikrar.sulo.ui.Palette

/**
 * NEOSIA's own pages in a WebView of their own (M8d), apart from the app's
 * WebView, the same pattern as the SIKOLA login screen: a native bar with a
 * lock, the host the page is really on, and a close button; no address can be
 * typed. It opens only from a tap in the app, on one of NeosiaRules.Page.
 *
 * Sulo sends nothing to NEOSIA. For a page that is not the login page, the
 * capture script (assets/public/neosia-main.js, built from the same core code
 * as the extension's) is added at document start for NEOSIA's origin only,
 * and the WebMessageListener `SuloNeosia` receives its projected messages.
 * Neither is added for the login page; both are taken away before the screen
 * goes to a login page. No addJavascriptInterface, no evaluateJavascript.
 *
 * B0 trial: what arrives is counted (endpoint id, size) in NeosiaTrial and
 * dropped; nothing is stored. Debug builds also count NEOSIA's requests as
 * they pass (host and path only), without changing them, to compare with
 * Chrome.
 */
class NeosiaActivity : Activity() {
    private lateinit var webView: WebView
    private lateinit var host: TextView
    private var script: ScriptHandler? = null
    private var listening = false
    private var lastUrl: String? = null

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val page = NeosiaRules.page(intent.getStringExtra(EXTRA_PAGE))
        if (page == null) {
            finish()
            return
        }
        if (Build.VERSION.SDK_INT >= 34) {
            overrideActivityTransition(OVERRIDE_TRANSITION_OPEN, R.anim.sulo_slide_up, R.anim.sulo_stay)
            overrideActivityTransition(OVERRIDE_TRANSITION_CLOSE, R.anim.sulo_stay, R.anim.sulo_slide_down)
        }
        val c = Palette.of(this)
        CookieManager.getInstance().setAcceptCookie(true)
        webView = WebView(this)
        // NEOSIA's own scripts run (its app needs them, and its sign-in keeps state in the page's storage); Sulo adds only the capture.
        webView.settings.javaScriptEnabled = true
        webView.settings.domStorageEnabled = true
        webView.settings.allowFileAccess = false
        webView.settings.allowContentAccess = false
        if (BuildConfig.DEBUG) WebView.setWebContentsDebuggingEnabled(true)
        NeosiaTrial.docStart = WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)
        NeosiaTrial.listener = WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)
        webView.webViewClient = client()

        val root = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setBackgroundColor(c.screen) }
        root.addView(bar(c), LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(56)))
        root.addView(View(this).apply { setBackgroundColor(c.line) }, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, 1))
        root.addView(webView, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, 0, 1f))
        root.setOnApplyWindowInsetsListener { v, insets ->
            val bars = if (Build.VERSION.SDK_INT >= 30) insets.getInsets(WindowInsets.Type.systemBars() or WindowInsets.Type.ime()) else null
            @Suppress("DEPRECATION")
            v.setPadding(0, bars?.top ?: insets.systemWindowInsetTop, 0, bars?.bottom ?: insets.systemWindowInsetBottom)
            insets
        }
        setContentView(root)
        if (Build.VERSION.SDK_INT >= 33) onBackInvokedDispatcher.registerOnBackInvokedCallback(android.window.OnBackInvokedDispatcher.PRIORITY_DEFAULT) { back() }

        // The script and the bridge only for a page that is not the login page, before it loads.
        if (NeosiaRules.scriptFor(page)) attach()
        webView.loadUrl(NeosiaRules.url(page))
    }

    /** Adds the capture script and the bridge for NEOSIA's origin (when this WebView has both features). */
    private fun attach() {
        if (NeosiaTrial.docStart != true || NeosiaTrial.listener != true) return
        val source = runCatching { assets.open("public/neosia-main.js").bufferedReader().use { it.readText() } }.getOrNull() ?: return
        val origins = setOf(NeosiaRules.ORIGIN)
        WebViewCompat.addWebMessageListener(webView, NeosiaRules.PORT, origins) { view, message, sourceOrigin, isMainFrame, _ ->
            val data = message.data
            val verdict = NeosiaRules.judge(sourceOrigin.toString().trimEnd('/'), isMainFrame, view.url, data)
            if (verdict == NeosiaRules.Verdict.ACCEPT && data != null) NeosiaTrial.capture(NeosiaRules.label(data), data.toByteArray(Charsets.UTF_8).size)
            else NeosiaTrial.reject(verdict.name)
        }
        listening = true
        script = WebViewCompat.addDocumentStartJavaScript(webView, source, origins)
    }

    /** Takes the script and the bridge away: they never reach a login page that loads after this. */
    private fun detach() {
        script?.remove()
        script = null
        if (listening) {
            WebViewCompat.removeWebMessageListener(webView, NeosiaRules.PORT)
            listening = false
        }
    }

    private fun client() = object : WebViewClient() {
        // NEOSIA's own pages only; before a login page, the script goes.
        override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
            val url = request.url.toString()
            if (!NeosiaRules.stays(url)) return request.isForMainFrame
            if (request.isForMainFrame && NeosiaRules.isLogin(url)) detach()
            return false
        }

        override fun onPageStarted(view: WebView, url: String?, favicon: Bitmap?) {
            Uri.parse(url ?: "").host?.let { host.text = it }
            if (NeosiaRules.isLogin(url) && script != null) {
                // A login page began while the script was still registered (a redirect that skipped the check above).
                NeosiaTrial.scriptOnLogin()
                detach()
            }
            NeosiaRules.scrub(url)?.let { NeosiaTrial.page(it) }
        }

        // The app moving between pages without a new document (history.pushState).
        override fun doUpdateVisitedHistory(view: WebView, url: String?, isReload: Boolean) {
            val wasLogin = NeosiaRules.isLogin(lastUrl)
            val nowLogin = NeosiaRules.isLogin(url)
            if (nowLogin && !wasLogin) {
                NeosiaTrial.spaToLogin()
                detach()
            }
            if (wasLogin && !nowLogin) NeosiaTrial.spaFromLogin()
            lastUrl = url
            NeosiaRules.scrub(url)?.let { NeosiaTrial.page(it) }
        }

        // Debug builds: count NEOSIA's requests as they pass; nothing is changed (null: the WebView loads it as usual).
        override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? {
            if (BuildConfig.DEBUG) NeosiaRules.scrub(request.url.toString())?.let { NeosiaTrial.request("${request.method} $it") }
            return null
        }
    }

    private fun back() {
        if (webView.canGoBack()) webView.goBack() else finish()
    }

    private fun bar(c: Palette): LinearLayout = LinearLayout(this).apply {
        orientation = LinearLayout.HORIZONTAL
        gravity = Gravity.CENTER_VERTICAL
        setBackgroundColor(c.card)
        setPadding(dp(16), 0, dp(4), 0)
        addView(ImageView(context).apply { setImageResource(R.drawable.sulo_ic_lock); setColorFilter(c.muted); importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO }, LinearLayout.LayoutParams(dp(16), dp(16)))
        host = TextView(context).apply {
            text = NeosiaRules.HOST
            setTextColor(c.text)
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 15f)
            maxLines = 1
            ellipsize = TextUtils.TruncateAt.START
            setPadding(dp(8), 0, dp(8), 0)
        }
        addView(host, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
        addView(ImageButton(context).apply {
            setImageResource(R.drawable.sulo_ic_close)
            setColorFilter(c.text)
            background = null
            contentDescription = intent.getStringExtra(EXTRA_CLOSE) ?: "Close"
            setOnClickListener { finish() }
        }, LinearLayout.LayoutParams(dp(48), dp(48)))
    }

    override fun onPause() {
        // The NEOSIA sign-in outlives the app being closed: cookies to disk now.
        CookieManager.getInstance().flush()
        super.onPause()
    }

    @Deprecated("Superseded by the dispatcher above where the system uses it")
    override fun onBackPressed() = back()

    override fun finish() {
        super.finish()
        @Suppress("DEPRECATION")
        if (Build.VERSION.SDK_INT < 34) overridePendingTransition(R.anim.sulo_stay, R.anim.sulo_slide_down)
    }

    override fun onDestroy() {
        if (::webView.isInitialized) {
            detach()
            webView.destroy()
        }
        super.onDestroy()
    }

    private fun dp(v: Int): Int = (v * resources.displayMetrics.density).toInt()

    companion object {
        const val EXTRA_PAGE = "sulo.neosia.page"
        const val EXTRA_CLOSE = "sulo.close"
    }
}
