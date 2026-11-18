package io.github.ikrar06.sulo.session

import android.annotation.SuppressLint
import android.app.Activity
import android.os.Bundle
import android.webkit.CookieManager
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient

/**
 * SIKOLA's own login page in a plain WebView. Sulo only watches where the
 * page goes: no evaluateJavascript, no addJavascriptInterface, no script of
 * any kind is added to the page (CLAUDE.md, mobile rule 8). The user types
 * the password into SIKOLA itself; Sulo never sees it.
 *
 * Once a signed-in SIKOLA page loads, the MoodleSession cookie is read from
 * CookieManager, encrypted into the vault, and the screen closes. The cookie
 * never travels in an Intent and never reaches JavaScript.
 */
class LoginActivity : Activity() {
    private lateinit var webView: WebView
    private var done = false

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        CookieManager.getInstance().setAcceptCookie(true)
        webView = WebView(this)
        // SIKOLA's own scripts may run (its page needs them); Sulo adds none.
        webView.settings.javaScriptEnabled = true
        webView.settings.domStorageEnabled = true
        webView.settings.allowFileAccess = false
        webView.settings.allowContentAccess = false
        webView.webViewClient = object : WebViewClient() {
            // Only SIKOLA stays in this screen; anything else is not followed.
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean =
                request.url.host != Sikola.HOST

            override fun onPageFinished(view: WebView, url: String?) {
                if (!done && Sikola.isSignedInPage(url)) capture()
            }
        }
        setContentView(webView)
        webView.loadUrl(Sikola.LOGIN_URL)
    }

    private fun capture() {
        val cookies = CookieManager.getInstance()
        cookies.flush()
        val session = SikolaText.cookieValue(cookies.getCookie(Sikola.ORIGIN), Sikola.SESSION_COOKIE) ?: return
        done = true
        SessionVault(this).apply {
            save(session)
            expired = false
        }
        // Names only, for the spike report (never values).
        getSharedPreferences(SessionVault.PREFS_DIAG, MODE_PRIVATE).edit()
            .putString("cookieNames", SikolaText.cookieNames(cookies.getCookie(Sikola.ORIGIN)).joinToString(","))
            .putString("landedPath", runCatching { java.net.URI(url ?: "").path }.getOrNull() ?: "")
            .commit()
        setResult(RESULT_OK)
        finish()
    }

    private val url: String? get() = webView.url

    override fun onDestroy() {
        webView.destroy()
        super.onDestroy()
    }
}
