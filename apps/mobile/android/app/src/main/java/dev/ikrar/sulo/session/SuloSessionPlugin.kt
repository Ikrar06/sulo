package dev.ikrar.sulo.session

import android.app.KeyguardManager
import android.content.Context
import android.content.Intent
import android.hardware.biometrics.BiometricManager
import android.hardware.biometrics.BiometricPrompt
import android.os.Build
import android.os.CancellationSignal
import android.webkit.CookieManager
import android.webkit.WebStorage
import androidx.activity.result.ActivityResult
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.ActivityCallback
import com.getcapacitor.annotation.CapacitorPlugin
import dev.ikrar.sulo.BuildConfig
import java.util.concurrent.Executors

/**
 * SuloSession: SIKOLA login, the session, requests to SIKOLA, and the
 * optional app lock. JavaScript gets statuses and Moodle's JSON only: the
 * MoodleSession cookie and the sesskey stay native, encrypted at rest, and
 * are never logged (scripts/check-native-logs.mjs forbids logging here).
 * Budget, queue and sync rules stay in @sulo/core, which calls request()
 * through the mobile HttpClient adaptor.
 */
@CapacitorPlugin(name = "SuloSession")
class SuloSessionPlugin : Plugin() {
    private val io = Executors.newSingleThreadExecutor()
    private val vault by lazy { SessionVault(context) }
    private val http by lazy { SikolaHttp("Sulo/${BuildConfig.VERSION_NAME} (Android)") }

    // ---------- Session ----------

    @PluginMethod
    fun login(call: PluginCall) {
        startActivityForResult(call, Intent(context, LoginActivity::class.java), "onLoginResult")
    }

    @ActivityCallback
    private fun onLoginResult(call: PluginCall?, result: ActivityResult) {
        call ?: return
        val session = Captured.take()
        if (session == null) {
            call.resolve(JSObject().put("status", "cancelled"))
            return
        }
        io.execute {
            // Signing in is the user's own activity: one GET /my/ for the sesskey, kept with the cookie.
            val sesskey = runCatching { http.get("${Sikola.ORIGIN}/my/", session) }.getOrNull()
                ?.takeIf { it.status == 200 }?.let { SikolaText.sesskey(it.body) }
            vault.save(SikolaSession(session, sesskey))
            call.resolve(JSObject().put("status", "connected"))
        }
    }

    @PluginMethod
    fun status(call: PluginCall) {
        call.resolve(JSObject().put("status", vault.status()))
    }

    /**
     * One batch to service.php. body: the JSON array the core client built;
     * userInitiated decides nosessionupdate (SikolaRequest.noSessionUpdate).
     * Answers { httpStatus, body } with Moodle's JSON, or { sessionStatus }
     * when there is no usable session.
     */
    @PluginMethod
    fun request(call: PluginCall) {
        val body = call.getString("body") ?: return call.reject("body missing")
        val userInitiated = call.getBoolean("userInitiated") ?: false
        val functions = SikolaRequest.allowedFunctions(body) ?: return call.reject("not allowlisted")
        io.execute {
            val session = vault.load()
            if (session == null) {
                call.resolve(JSObject().put("sessionStatus", vault.status()))
                return@execute
            }
            try {
                var current = session
                // A sesskey only comes from the user's own activity (sign-in or a sync they started).
                if (current.sesskey == null) {
                    if (!userInitiated) return@execute call.resolve(JSObject().put("sessionStatus", "connected").put("needsUser", true))
                    current = refreshSesskey(current) ?: return@execute call.resolve(JSObject().put("sessionStatus", vault.status()))
                }
                var reply = http.postJson(SikolaRequest.batchUrl(current.sesskey!!, functions, userInitiated), current.moodleSession, body)
                if (SikolaRequest.invalidSesskey(reply.body) && userInitiated) {
                    current = refreshSesskey(current.copy(sesskey = null)) ?: return@execute call.resolve(JSObject().put("sessionStatus", vault.status()))
                    reply = http.postJson(SikolaRequest.batchUrl(current.sesskey!!, functions, true), current.moodleSession, body)
                }
                if (SikolaRequest.loginRequired(reply.body) || reply.location?.contains("/login/") == true) vault.markExpired()
                call.resolve(JSObject().put("httpStatus", reply.status).put("body", reply.body).put("sessionStatus", vault.status()))
            } catch (e: Exception) {
                // The kind of failure only, never a message that could carry the URL.
                call.resolve(JSObject().put("networkError", e.javaClass.simpleName).put("sessionStatus", vault.status()))
            }
        }
    }

    /** GET /my/ for a fresh sesskey; marks the session expired when SIKOLA sends us to its login. */
    private fun refreshSesskey(session: SikolaSession): SikolaSession? {
        val page = http.get("${Sikola.ORIGIN}/my/", session.moodleSession)
        if (page.status in 300..399 && page.location?.contains("/login/") == true) {
            vault.markExpired()
            return null
        }
        val sesskey = SikolaText.sesskey(page.body) ?: return null
        return session.copy(sesskey = sesskey).also { vault.save(it) }
    }

    /** "Keluar": SIKOLA's cookies and web storage in this app, the vault and its Keystore key. */
    @PluginMethod
    fun logout(call: PluginCall) {
        CookieManager.getInstance().removeAllCookies {
            CookieManager.getInstance().flush()
            WebStorage.getInstance().deleteAllData()
            io.execute {
                vault.wipe()
                call.resolve(JSObject().put("status", "none"))
            }
        }
    }

    // ---------- App lock (optional, off by default; the setting lives in the app) ----------

    /** Whether the phone has a screen lock (PIN, pattern, password or biometrics). */
    @PluginMethod
    fun lockAvailable(call: PluginCall) {
        val keyguard = context.getSystemService(Context.KEYGUARD_SERVICE) as KeyguardManager
        call.resolve(JSObject().put("available", keyguard.isDeviceSecure))
    }

    /** Asks for the phone's own biometrics or screen lock. Android 11+: BiometricPrompt; older: the system credential screen. */
    @PluginMethod
    fun unlock(call: PluginCall) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            val prompt = BiometricPrompt.Builder(context)
                .setTitle("Buka Sulo")
                .setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_WEAK or BiometricManager.Authenticators.DEVICE_CREDENTIAL)
                .build()
            prompt.authenticate(CancellationSignal(), context.mainExecutor, object : BiometricPrompt.AuthenticationCallback() {
                override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                    call.resolve(JSObject().put("unlocked", true))
                }

                override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                    call.resolve(JSObject().put("unlocked", false))
                }
            })
        } else {
            val keyguard = context.getSystemService(Context.KEYGUARD_SERVICE) as KeyguardManager
            @Suppress("DEPRECATION")
            val intent = keyguard.createConfirmDeviceCredentialIntent("Buka Sulo", null)
            if (intent == null) call.resolve(JSObject().put("unlocked", true)) else startActivityForResult(call, intent, "onUnlockResult")
        }
    }

    @ActivityCallback
    private fun onUnlockResult(call: PluginCall?, result: ActivityResult) {
        call?.resolve(JSObject().put("unlocked", result.resultCode == android.app.Activity.RESULT_OK))
    }
}
