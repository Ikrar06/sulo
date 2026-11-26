package dev.ikrar.sulo.session

import android.annotation.SuppressLint
import android.app.Activity
import android.content.Context
import android.graphics.drawable.GradientDrawable
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.Build
import android.os.Bundle
import android.text.TextUtils
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.view.WindowInsets
import android.webkit.CookieManager
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.ImageButton
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import dev.ikrar.sulo.R
import dev.ikrar.sulo.sipakamase.Sipakamase
import dev.ikrar.sulo.ui.Palette

/**
 * SIKOLA's own login page in a plain WebView. Sulo only watches where the
 * page goes: no evaluateJavascript, no addJavascriptInterface, no script of
 * any kind is added to the page (one of Sulo's hard rules for the phone). The user types
 * the password into SIKOLA itself; Sulo never sees it.
 *
 * A native bar above the page (M8c.2): a lock, the host the page is really
 * on (read from the WebView, never typed), and a close button. No address
 * can be entered. Without a connection the page is replaced by one calm line
 * and "Coba lagi". The screen rises in 240 ms and goes down in 200 ms. The
 * words come from the app (core's dictionary) through the Intent.
 *
 * On the first signed-in SIKOLA page, the MoodleSession cookie is read from
 * CookieManager and handed to the vault through [Captured]; the screen then
 * closes. The cookie never travels in an Intent and never reaches JavaScript.
 */
class LoginActivity : Activity() {
    /** The site this screen signs in to: SIKOLA, or Sipakamase (1.1.0, EXTRA_SITE). Same screen, same rules. */
    private data class Site(val host: String, val origin: String, val entry: String, val cookie: String, val signedIn: (String?) -> Boolean)

    private val site by lazy {
        if (intent.getStringExtra(EXTRA_SITE) == SITE_SIPAKAMASE) {
            Site(Sipakamase.HOST, Sipakamase.ORIGIN, Sipakamase.ENTRY_URL, Sipakamase.SESSION_COOKIE, Sipakamase::isSignedInPage)
        } else {
            Site(Sikola.HOST, Sikola.ORIGIN, Sikola.LOGIN_URL, Sikola.SESSION_COOKIE, Sikola::isSignedInPage)
        }
    }

    private lateinit var webView: WebView
    private lateinit var host: TextView
    private lateinit var offline: LinearLayout
    private var done = false
    private var offlineShown = false

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (Build.VERSION.SDK_INT >= 34) {
            overrideActivityTransition(OVERRIDE_TRANSITION_OPEN, R.anim.sulo_slide_up, R.anim.sulo_stay)
            overrideActivityTransition(OVERRIDE_TRANSITION_CLOSE, R.anim.sulo_stay, R.anim.sulo_slide_down)
        }
        val c = Palette.of(this)
        CookieManager.getInstance().setAcceptCookie(true)
        webView = WebView(this)
        // SIKOLA's own scripts may run (its page needs them); Sulo adds none.
        webView.settings.javaScriptEnabled = true
        webView.settings.domStorageEnabled = true
        webView.settings.allowFileAccess = false
        webView.settings.allowContentAccess = false
        webView.webViewClient = object : WebViewClient() {
            // Only the site stays in this screen; anything else is not followed.
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean =
                request.url.host != site.host

            override fun onPageStarted(view: WebView, url: String?, favicon: android.graphics.Bitmap?) {
                android.net.Uri.parse(url ?: "").host?.let { host.text = it }
            }

            override fun onPageFinished(view: WebView, url: String?) {
                if (!done && site.signedIn(url)) capture()
            }

            override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) {
                if (request.isForMainFrame) showOffline(true)
            }
        }

        val root = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setBackgroundColor(c.screen) }
        root.addView(bar(c), LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(56)))
        root.addView(View(this).apply { setBackgroundColor(c.line) }, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, 1))
        offline = offlineRow(c)
        root.addView(offline, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, 0, 1f))
        root.addView(webView, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, 0, 1f))
        // Edge to edge: the bar clears the status bar, the page the gesture bar.
        root.setOnApplyWindowInsetsListener { v, insets ->
            val bars = if (Build.VERSION.SDK_INT >= 30) insets.getInsets(WindowInsets.Type.systemBars() or WindowInsets.Type.ime()) else null
            @Suppress("DEPRECATION")
            v.setPadding(0, bars?.top ?: insets.systemWindowInsetTop, 0, bars?.bottom ?: insets.systemWindowInsetBottom)
            insets
        }
        setContentView(root)
        c.applyTo(this, root)
        // Back: one page back inside SIKOLA, else close. Android 13+ (and 16, where onBackPressed is no longer called) through the dispatcher.
        if (Build.VERSION.SDK_INT >= 33) onBackInvokedDispatcher.registerOnBackInvokedCallback(android.window.OnBackInvokedDispatcher.PRIORITY_DEFAULT) { back() }
        if (online()) load() else showOffline(true)
    }

    override fun onPause() {
        // The SIKOLA page's own cookies to disk now, as soon as the screen leaves.
        CookieManager.getInstance().flush()
        super.onPause()
    }

    private fun back() {
        if (!offlineShown && webView.canGoBack()) webView.goBack() else close()
    }

    private fun load() {
        showOffline(false)
        webView.loadUrl(site.entry)
    }

    private fun bar(c: Palette): LinearLayout = LinearLayout(this).apply {
        orientation = LinearLayout.HORIZONTAL
        gravity = Gravity.CENTER_VERTICAL
        setBackgroundColor(c.card)
        setPadding(dp(16), 0, dp(4), 0)
        addView(ImageView(context).apply { setImageResource(R.drawable.sulo_ic_lock); setColorFilter(c.muted); importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO }, LinearLayout.LayoutParams(dp(16), dp(16)))
        host = TextView(context).apply {
            text = site.host
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
            setOnClickListener { close() }
        }, LinearLayout.LayoutParams(dp(48), dp(48)))
    }

    private fun offlineRow(c: Palette): LinearLayout = LinearLayout(this).apply {
        orientation = LinearLayout.VERTICAL
        gravity = Gravity.CENTER
        visibility = View.GONE
        setPadding(dp(24), 0, dp(24), 0)
        addView(TextView(context).apply {
            text = intent.getStringExtra(EXTRA_OFFLINE) ?: "No connection."
            setTextColor(c.text)
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 15f)
            gravity = Gravity.CENTER
        })
        addView(TextView(context).apply {
            text = intent.getStringExtra(EXTRA_RETRY) ?: "Try again"
            setTextColor(c.text)
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 15f)
            gravity = Gravity.CENTER
            minHeight = dp(44)
            setPadding(dp(20), 0, dp(20), 0)
            background = GradientDrawable().apply { cornerRadius = dp(22).toFloat(); setColor(c.inset) }
            isClickable = true
            isFocusable = true
            setOnClickListener { if (online()) load() }
        }, LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply { topMargin = dp(16) })
    }

    private fun showOffline(show: Boolean) {
        offlineShown = show
        offline.visibility = if (show) View.VISIBLE else View.GONE
        webView.visibility = if (show) View.GONE else View.VISIBLE
    }

    private fun online(): Boolean {
        val cm = getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager ?: return true
        val caps = cm.getNetworkCapabilities(cm.activeNetwork) ?: return false
        return caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
    }

    private fun capture() {
        val cookies = CookieManager.getInstance()
        cookies.flush()
        val session = SikolaText.cookieValue(cookies.getCookie(site.origin), site.cookie) ?: return
        done = true
        if (site.host == Sipakamase.HOST) Captured.sipakamase = session else Captured.moodleSession = session
        setResult(RESULT_OK)
        finish()
    }

    /** Closed without signing in: the app says so calmly (offline when the page never came). */
    private fun close() {
        setResult(if (offlineShown) RESULT_OFFLINE else RESULT_CANCELED)
        finish()
    }

    // Where the system still delivers Back the old way (before Android 16 without the opt-in).
    @Deprecated("Superseded by the dispatcher above where the system uses it")
    override fun onBackPressed() = back()

    override fun finish() {
        super.finish()
        @Suppress("DEPRECATION")
        if (Build.VERSION.SDK_INT < 34) overridePendingTransition(R.anim.sulo_stay, R.anim.sulo_slide_down)
    }

    override fun onDestroy() {
        webView.destroy()
        super.onDestroy()
    }

    private fun dp(v: Int): Int = (v * resources.displayMetrics.density).toInt()

    companion object {
        const val EXTRA_CLOSE = "sulo.close"
        const val EXTRA_OFFLINE = "sulo.offline"
        const val EXTRA_RETRY = "sulo.retry"
        const val RESULT_OFFLINE = RESULT_FIRST_USER + 1
        const val EXTRA_SITE = "sulo.site"
        const val SITE_SIPAKAMASE = "sipakamase"
    }
}

/** Hand-over from the login screen to the plugin inside this process; emptied as soon as it is read. */
internal object Captured {
    @Volatile var moodleSession: String? = null
    @Volatile var sipakamase: String? = null

    fun take(): String? = moodleSession.also { moodleSession = null }
    fun takeSipakamase(): String? = sipakamase.also { sipakamase = null }
}
