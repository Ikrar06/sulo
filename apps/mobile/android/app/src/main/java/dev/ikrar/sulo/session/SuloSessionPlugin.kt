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
        // The bar's words come from core's dictionary (the app's language).
        val intent = Intent(context, LoginActivity::class.java)
            .putExtra(LoginActivity.EXTRA_CLOSE, call.getString("close"))
            .putExtra(LoginActivity.EXTRA_OFFLINE, call.getString("offline"))
            .putExtra(LoginActivity.EXTRA_RETRY, call.getString("retry"))
        startActivityForResult(call, intent, "onLoginResult")
        // Before Android 14 the activity cannot pick its own opening animation.
        @Suppress("DEPRECATION")
        if (android.os.Build.VERSION.SDK_INT < 34) activity.overridePendingTransition(dev.ikrar.sulo.R.anim.sulo_slide_up, dev.ikrar.sulo.R.anim.sulo_stay)
    }

    @ActivityCallback
    private fun onLoginResult(call: PluginCall?, result: ActivityResult) {
        call ?: return
        val session = Captured.take()
        if (session == null) {
            call.resolve(JSObject().put("status", if (result.resultCode == LoginActivity.RESULT_OFFLINE) "offline" else "cancelled"))
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

    /**
     * One allowlisted SIKOLA page (SikolaPage: attendance only, id/mode/view),
     * only for something the user started. Answers { httpStatus, html } with
     * the page stripped for JavaScript (no head, scripts, forms or sesskey),
     * or { sessionStatus } when there is no usable session.
     */
    @PluginMethod
    fun page(call: PluginCall) {
        val path = call.getString("path") ?: return call.reject("path missing")
        val url = SikolaPage.allowedUrl(path) ?: return call.reject("not allowlisted")
        if (call.getBoolean("userInitiated") != true) return call.reject("user only")
        io.execute {
            val session = vault.load() ?: return@execute call.resolve(JSObject().put("sessionStatus", vault.status()))
            try {
                val reply = http.get(url, session.moodleSession)
                if (reply.status in 300..399 && reply.location?.contains("/login/") == true) {
                    vault.markExpired()
                    return@execute call.resolve(JSObject().put("sessionStatus", vault.status()))
                }
                call.resolve(JSObject().put("httpStatus", reply.status).put("html", SikolaPage.forJs(reply.body, listOfNotNull(session.sesskey))).put("sessionStatus", vault.status()))
            } catch (e: Exception) {
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
                // Keluar also ends background watching: no check, no queue, no plan.
                runCatching { dev.ikrar.sulo.watch.WatchScheduler.stop(context) }
                runCatching { dev.ikrar.sulo.watch.WatchStore(context).clear() }
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
        val keyguard = context.getSystemService(Context.KEYGUARD_SERVICE) as KeyguardManager
        if (!keyguard.isDeviceSecure) {
            call.resolve(JSObject().put("unlocked", false).put("reason", "no_device_lock"))
            return
        }
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
            @Suppress("DEPRECATION")
            val intent = keyguard.createConfirmDeviceCredentialIntent("Buka Sulo", null)
            // No screen lock: never open by default; the app decides what to show.
            if (intent == null) call.resolve(JSObject().put("unlocked", false).put("reason", "no_device_lock")) else startActivityForResult(call, intent, "onUnlockResult")
        }
    }

    @ActivityCallback
    private fun onUnlockResult(call: PluginCall?, result: ActivityResult) {
        call?.resolve(JSObject().put("unlocked", result.resultCode == android.app.Activity.RESULT_OK))
    }

    /**
     * Android's own page for this app (battery, background use), so the user
     * can let Sulo run in the background. No permission asked; Sulo never
     * requests REQUEST_IGNORE_BATTERY_OPTIMIZATIONS.
     */
    @PluginMethod
    fun openAppSettings(call: PluginCall) {
        val intent = Intent(android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS, android.net.Uri.fromParts("package", context.packageName, null))
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        runCatching { context.startActivity(intent) }
        call.resolve()
    }

    // ---------- Background watching (M8c.3) ----------

    /**
     * The plan core wrote (packages/core/src/watch/plan.ts). Enabled: the next
     * check is scheduled a full interval from now (a sync the user started
     * restarts the count). Disabled: every check stops at once.
     */
    @PluginMethod
    fun watchApply(call: PluginCall) {
        val raw = call.getString("plan") ?: return call.reject("plan missing")
        io.execute {
            val plan = runCatching { org.json.JSONObject(raw) }.getOrNull() ?: return@execute call.reject("bad plan")
            val store = dev.ikrar.sulo.watch.WatchStore(context)
            store.setPlan(plan)
            val now = System.currentTimeMillis() / 1000
            if (plan.optBoolean("enabled", false)) {
                val schedule = plan.getJSONObject("schedule")
                val minute = java.util.Calendar.getInstance().let { it.get(java.util.Calendar.HOUR_OF_DAY) * 60 + it.get(java.util.Calendar.MINUTE) }
                val power = (context.getSystemService(Context.POWER_SERVICE) as? android.os.PowerManager)?.isPowerSaveMode == true
                val day = minute >= schedule.getInt("dayStartMin") && minute < schedule.getInt("nightStartMin")
                val minutes = if (power || !day) schedule.getInt("nightIntervalMin") else schedule.getInt("dayIntervalMin")
                dev.ikrar.sulo.watch.WatchScheduler.next(context, minutes * 60L, now)
            } else {
                dev.ikrar.sulo.watch.WatchScheduler.stop(context)
            }
            call.resolve()
        }
    }

    /** The queued background answers (decrypted, handed over once) and whether a full sync is asked. */
    @PluginMethod
    fun watchTake(call: PluginCall) {
        io.execute {
            val (answers, full) = dev.ikrar.sulo.watch.WatchStore(context).takeQueue()
            call.resolve(JSObject().put("answers", org.json.JSONArray(answers.map { it.toString() })).put("fullSync", full))
        }
    }

    /** For the screens: the last checks (times, durations, sizes, outcomes), session ends, the next planned check. */
    @PluginMethod
    fun watchStatus(call: PluginCall) {
        io.execute {
            val store = dev.ikrar.sulo.watch.WatchStore(context)
            call.resolve(JSObject().put("timings", store.timings().toString()).put("sessionEnds", store.sessionEnds().toString()).put("plannedAt", store.plannedAt()).put("queued", store.queueSize()))
        }
    }

    /** A tapped background notification's id, once. */
    @PluginMethod
    fun watchTakeOpen(call: PluginCall) {
        io.execute {
            val id = dev.ikrar.sulo.watch.WatchStore(context).takePendingOpen()
            call.resolve(JSObject().put("id", id ?: org.json.JSONObject.NULL))
        }
    }

    // ---------- Debug build only: the debug screen's tests (refused in a release build) ----------

    /** One background check now: the same work as the chain (gate, budget, one POST). */
    @PluginMethod
    fun watchRunNow(call: PluginCall) {
        if (!BuildConfig.DEBUG) return call.reject("debug only")
        dev.ikrar.sulo.watch.WatchScheduler.next(context, 0, System.currentTimeMillis() / 1000, dev.ikrar.sulo.watch.WatchScheduler.MODE_CHECK_NOW)
        call.resolve()
    }

    /** A simulation without any request (WatchSimulate): task, due, three, quiet, expired. */
    @PluginMethod
    fun watchSimulate(call: PluginCall) {
        if (!BuildConfig.DEBUG) return call.reject("debug only")
        val kind = call.getString("kind") ?: return call.reject("kind missing")
        val prefix = call.getString("prefix") ?: ""
        io.execute {
            val r = runCatching { dev.ikrar.sulo.watch.WatchSimulate(context).run(kind, prefix) }.getOrElse { dev.ikrar.sulo.watch.WatchSimulate.Result("error", 0, 0) }
            call.resolve(JSObject().put("status", r.status).put("changes", r.changes).put("notices", r.notices))
        }
    }
}
