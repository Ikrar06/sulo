package io.github.ikrar06.sulo.session

import android.content.Intent
import android.webkit.CookieManager
import android.webkit.WebSettings
import android.webkit.WebStorage
import androidx.activity.result.ActivityResult
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.ActivityCallback
import com.getcapacitor.annotation.CapacitorPlugin
import io.github.ikrar06.sulo.BuildConfig
import java.util.concurrent.Executors

/**
 * SuloSession (M8b spike). JavaScript only ever receives statuses, HTTP
 * codes and Moodle error codes: the MoodleSession cookie and the sesskey
 * stay native. Nothing here logs.
 */
@CapacitorPlugin(name = "SuloSession")
class SuloSessionPlugin : Plugin() {
    private val io = Executors.newSingleThreadExecutor()
    private val vault by lazy { SessionVault(context) }
    private val suloUserAgent get() = "Sulo/${BuildConfig.VERSION_NAME} (Android)"

    @PluginMethod
    fun login(call: PluginCall) {
        startActivityForResult(call, Intent(context, LoginActivity::class.java), "onLoginResult")
    }

    @ActivityCallback
    private fun onLoginResult(call: PluginCall?, result: ActivityResult) {
        call ?: return
        call.resolve(JSObject().put("status", if (vault.has()) "connected" else "cancelled"))
    }

    @PluginMethod
    fun status(call: PluginCall) {
        call.resolve(JSObject().put("status", statusOf()))
    }

    private fun statusOf(): String = when {
        !vault.has() -> "none"
        vault.expired -> "expired"
        else -> "connected"
    }

    /**
     * The spike: one GET /my/ for the sesskey, one POST of
     * core_session_time_remaining with nosessionupdate=true and the Sulo
     * User-Agent; only when that is refused, the same once with the
     * WebView's own User-Agent, to report the difference.
     */
    @PluginMethod
    fun probe(call: PluginCall) {
        io.execute {
            val session = vault.load()
            if (session == null) {
                call.resolve(JSObject().put("status", statusOf()))
                return@execute
            }
            val out = JSObject()
            out.put("userAgent", suloUserAgent)
            val diag = context.getSharedPreferences(SessionVault.PREFS_DIAG, 0)
            out.put("cookieNames", diag.getString("cookieNames", ""))
            out.put("landedPath", diag.getString("landedPath", ""))
            val sulo = attempt(SikolaHttp(suloUserAgent), session)
            out.put("sulo", sulo.second)
            if (!sulo.first) {
                val webviewUa = WebSettings.getDefaultUserAgent(context)
                out.put("webview", attempt(SikolaHttp(webviewUa), session).second)
            }
            out.put("status", statusOf())
            call.resolve(out)
        }
    }

    /** One GET /my/ and one batch POST; true when the POST was accepted. */
    private fun attempt(http: SikolaHttp, session: String): Pair<Boolean, JSObject> {
        val r = JSObject()
        return try {
            val page = http.getPage("/my/", session)
            r.put("myHttpStatus", page.httpStatus)
            r.put("myRedirectedToLogin", page.redirectedToLogin)
            if (page.redirectedToLogin) vault.expired = true
            val sesskey = page.html?.let { SikolaText.sesskey(it) }
            r.put("sesskeyFound", sesskey != null)
            if (sesskey == null) return false to r
            val batch = http.sessionTimeRemaining(session, sesskey)
            r.put("postHttpStatus", batch.httpStatus)
            r.put("accepted", batch.accepted)
            r.put("errorcode", batch.errorcode)
            r.put("timeRemaining", batch.timeRemaining)
            if (batch.errorcode == "servicerequireslogin") vault.expired = true
            batch.accepted to r
        } catch (e: Exception) {
            // The kind of failure only (e.g. UnknownHostException), never a message that could carry a URL.
            r.put("failure", e.javaClass.simpleName)
            false to r
        }
    }

    /** "Keluar": SIKOLA's cookies in this app's WebView, its web storage, the vault and its Keystore key. */
    @PluginMethod
    fun logout(call: PluginCall) {
        CookieManager.getInstance().removeAllCookies {
            CookieManager.getInstance().flush()
            WebStorage.getInstance().deleteAllData()
            io.execute {
                vault.wipe()
                context.getSharedPreferences(SessionVault.PREFS_DIAG, 0).edit().clear().commit()
                call.resolve(JSObject().put("status", "none"))
            }
        }
    }
}
