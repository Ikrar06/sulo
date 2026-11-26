package dev.ikrar.sulo.sipakamase

import android.content.Intent
import android.webkit.CookieManager
import androidx.activity.result.ActivityResult
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.ActivityCallback
import com.getcapacitor.annotation.CapacitorPlugin
import dev.ikrar.sulo.BuildConfig
import dev.ikrar.sulo.neosia.userOf
import dev.ikrar.sulo.session.Captured
import dev.ikrar.sulo.session.LoginActivity
import dev.ikrar.sulo.session.SikolaSession
import java.util.concurrent.Executors

/**
 * SuloSipakamase (1.1.0): Sipakamase's sign-in screen (the SIKOLA one with
 * the Sipakamase site: no script on the page), one read-only GET at a time
 * to the five fragments with the vault's cookie, and core's encrypted data.
 * JavaScript never sees the cookie, and no address from a page is ever
 * requested: [get] takes one of the five constant paths only.
 */
@CapacitorPlugin(name = "SuloSipakamase")
class SuloSipakamasePlugin : Plugin() {
    private val io = Executors.newSingleThreadExecutor()
    private val http by lazy { SipakamaseHttp("Sulo/${BuildConfig.VERSION_NAME} (Android)") }
    private val vault by lazy { SipakamaseVault.session(context) }
    private val store by lazy { SipakamaseVault.data(context) }

    @PluginMethod
    fun signIn(call: PluginCall) {
        val intent = Intent(context, LoginActivity::class.java)
            .putExtra(LoginActivity.EXTRA_SITE, LoginActivity.SITE_SIPAKAMASE)
            .putExtra(LoginActivity.EXTRA_CLOSE, call.getString("close"))
            .putExtra(LoginActivity.EXTRA_OFFLINE, call.getString("offline"))
            .putExtra(LoginActivity.EXTRA_RETRY, call.getString("retry"))
        startActivityForResult(call, intent, "onSignIn")
        @Suppress("DEPRECATION")
        if (android.os.Build.VERSION.SDK_INT < 34) activity.overridePendingTransition(dev.ikrar.sulo.R.anim.sulo_slide_up, dev.ikrar.sulo.R.anim.sulo_stay)
    }

    @ActivityCallback
    private fun onSignIn(call: PluginCall?, result: ActivityResult) {
        call ?: return
        val cookie = Captured.takeSipakamase()
        if (cookie == null) {
            call.resolve(JSObject().put("result", if (result.resultCode == LoginActivity.RESULT_OFFLINE) "offline" else "closed"))
            return
        }
        io.execute {
            vault.save(SikolaSession(cookie, null))
            call.resolve(JSObject().put("result", "signed_in"))
        }
    }

    /** One fragment: its status, whether it went to a login, and its HTML (never a cookie). */
    @PluginMethod
    fun get(call: PluginCall) {
        val path = call.getString("path") ?: return call.reject("path")
        if (!Sipakamase.isReadPath(path)) return call.reject("not allowed")
        io.execute {
            val session = vault.load()
            if (session == null) {
                call.resolve(JSObject().put("noSession", true))
                return@execute
            }
            try {
                val reply = http.get(path, session.moodleSession) { fresh -> vault.save(SikolaSession(fresh, null), note = false) }
                val toLogin = reply.status in 300..399 || reply.status == 401 || reply.status == 403
                call.resolve(JSObject().put("status", reply.status).put("toLogin", toLogin).put("html", if (toLogin) "" else reply.body))
            } catch (e: Exception) {
                call.resolve(JSObject().put("networkError", true))
            }
        }
    }

    /** What the background keeper did (times and counts only). */
    @PluginMethod
    fun workerState(call: PluginCall) {
        io.execute {
            val k = SipakamaseKeeper(context).state()
            call.resolve(JSObject().put("lastAt", k.lastAt).put("date", k.date).put("count", k.count).put("loginAt", k.loginAt))
        }
    }

    @PluginMethod
    fun status(call: PluginCall) {
        io.execute { call.resolve(JSObject().put("hasSession", vault.load() != null)) }
    }

    /** Putuskan: the cookie in the vault and in the WebView, and every account's Sipakamase data. */
    @PluginMethod
    fun forget(call: PluginCall) {
        io.execute {
            SipakamaseVault.wipeAll(context)
            bridge.executeOnMainThread {
                val cm = CookieManager.getInstance()
                cm.setCookie(Sipakamase.ORIGIN, "${Sipakamase.SESSION_COOKIE}=; Max-Age=0; Path=/")
                cm.flush()
                call.resolve()
            }
        }
    }

    @PluginMethod
    fun storeGet(call: PluginCall) {
        val user = userOf(call.data.opt("user")) ?: return call.reject("user")
        val key = call.getString("key") ?: return call.reject("key")
        io.execute { call.resolve(JSObject().put("value", store.get(user, key))) }
    }

    @PluginMethod
    fun storeSet(call: PluginCall) {
        val user = userOf(call.data.opt("user")) ?: return call.reject("user")
        val key = call.getString("key") ?: return call.reject("key")
        val value = call.getString("value") ?: return call.reject("value")
        io.execute {
            store.set(user, key, value)
            call.resolve()
        }
    }

    @PluginMethod
    fun storeRemove(call: PluginCall) {
        val user = userOf(call.data.opt("user")) ?: return call.reject("user")
        val keys = call.getArray("keys")?.toList<String>().orEmpty()
        io.execute {
            store.remove(user, keys)
            call.resolve()
        }
    }

    @PluginMethod
    fun storeKeys(call: PluginCall) {
        val user = userOf(call.data.opt("user")) ?: return call.reject("user")
        val prefix = call.getString("prefix") ?: ""
        io.execute { call.resolve(JSObject().put("keys", JSArray(store.keys(user, prefix)))) }
    }
}
