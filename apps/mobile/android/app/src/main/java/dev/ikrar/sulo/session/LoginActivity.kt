package dev.ikrar.sulo.session

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
 * On the first signed-in SIKOLA page, the MoodleSession cookie is read from
 * CookieManager and handed to the vault through [Captured]; the screen then
 * closes. The cookie never travels in an Intent and never reaches JavaScript.
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
        Captured.moodleSession = session
        setResult(RESULT_OK)
        finish()
    }

    override fun onDestroy() {
        webView.destroy()
        super.onDestroy()
    }
}

/** Hand-over from the login screen to the plugin inside this process; emptied as soon as it is read. */
internal object Captured {
    @Volatile var moodleSession: String? = null

    fun take(): String? = moodleSession.also { moodleSession = null }
}
