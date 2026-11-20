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
    private companion object {
        /** How long a request waits for the background check to finish with SIKOLA. */
        const val LOCK_WAIT_MS = 60_000L
        const val DEFERRED = "sulo_deferred"
    }

    private val io = Executors.newSingleThreadExecutor()
    private val vault by lazy { SessionVault.of(context) }
    private val http by lazy {
        SikolaHttp("Sulo/${BuildConfig.VERSION_NAME} (Android)", strict = BuildConfig.DEBUG, onHandlerCleared = { Diag.of(context).note("cookie_handler_cleared") }).apply {
            // Debug builds: which header and cookie NAMES SIKOLA answers with (for the load-balancer question).
            if (BuildConfig.DEBUG) namesSeen = { headers, cookies -> HeaderNames.record(context, headers, cookies) }
        }
    }

    // ---------- Haptics ----------

    /**
     * A light or a firm tick through the view's own haptic feedback: no
     * permission, and Android's touch-feedback setting decides whether it is felt.
     */
    @PluginMethod
    fun haptic(call: PluginCall) {
        val firm = call.getString("kind") == "firm"
        val constant = when {
            firm && android.os.Build.VERSION.SDK_INT >= 30 -> android.view.HapticFeedbackConstants.CONFIRM
            firm -> android.view.HapticFeedbackConstants.LONG_PRESS
            else -> android.view.HapticFeedbackConstants.CLOCK_TICK
        }
        activity.runOnUiThread { bridge.webView.performHapticFeedback(constant) }
        call.resolve()
    }

    // ---------- Device (performance tier) ----------

    /**
     * What the phone says about itself, for the app's performance tier
     * (core perf/tier.ts): Android's low-RAM flag, total RAM, CPU cores and
     * the WebView's version. Needs no permission. Read once when the app
     * opens; the app keeps it in memory only and never stores or sends it.
     */
    @PluginMethod
    fun deviceInfo(call: PluginCall) {
        val result = JSObject()
        runCatching {
            val am = context.getSystemService(Context.ACTIVITY_SERVICE) as android.app.ActivityManager
            val mem = android.app.ActivityManager.MemoryInfo().also { am.getMemoryInfo(it) }
            result.put("lowRamDevice", am.isLowRamDevice)
            result.put("totalRamMb", mem.totalMem / (1024 * 1024))
        }
        result.put("cpuCores", Runtime.getRuntime().availableProcessors())
        runCatching { android.webkit.WebView.getCurrentWebViewPackage()?.versionName }.getOrNull()?.let { result.put("webView", it) }
        call.resolve(result)
    }

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
            SikolaLock.hold(context, LOCK_WAIT_MS) {
                val kept = keeper(SikolaSession(session, null))
                val sesskey = runCatching { http.get("${Sikola.ORIGIN}/my/", session, kept) }.getOrNull()
                    ?.takeIf { it.status == 200 }?.let { SikolaText.sesskey(it.body) }
                // Nothing is in the vault yet: a cookie set by /my/ counts only with a signed-in page.
                val cookie = kept.pending()?.takeIf { sesskey != null } ?: session
                vault.save(SikolaSession(cookie, sesskey))
            }
            // The new session's cookie to disk now (owner's rule: flush after signing in).
            runCatching { CookieManager.getInstance().flush() }
            call.resolve(JSObject().put("status", "connected"))
        }
    }

    /** Debug builds: the session's event log (times and event codes only, see Diag). */
    @PluginMethod
    fun diagLog(call: PluginCall) {
        if (!BuildConfig.DEBUG) return call.reject("not available")
        call.resolve(
            JSObject()
                .put("events", com.getcapacitor.JSArray(Diag.of(context).entries().toString()))
                .put("cookies", JSObject().apply { CookieStats.of(context).summary().forEach { (k, v) -> put(k, v.toIntOrNull() ?: 0) } })
                .put("headerNames", HeaderNames.all(context)),
        )
    }

    @PluginMethod
    fun status(call: PluginCall) {
        call.resolve(JSObject().put("status", vault.status()))
    }


    private fun keeper(session: SikolaSession) = CookieKeeper(session, vault, CookieStats.of(context), Diag.of(context))

    /**
     * The app is going away (between onPause and onStop, or gone): no request
     * starts now. The sync waits for the next open (owner's rule, 20 Nov 2026).
     */
    private fun deferIfClosing(call: PluginCall): Boolean {
        if (dev.ikrar.sulo.MainActivity.inForeground) return false
        context.getSharedPreferences(DEFERRED, Context.MODE_PRIVATE).edit().putBoolean("sync", true).commit()
        Diag.of(context).note("request_deferred")
        call.resolve(JSObject().put("deferred", true).put("sessionStatus", vault.status()))
        return true
    }

    /**
     * The session is over for sure: core asked SIKOLA twice (the second time a
     * few seconds later, core_session_time_remaining alone) and both answers
     * said "log in". The only way a session ends apart from Keluar and Batal.
     */
    @PluginMethod
    fun endSession(call: PluginCall) {
        val reason = (call.getString("reason") ?: "").replace(Regex("[^a-z0-9_:.>+-]"), "").take(60)
        io.execute {
            SikolaLock.hold(context, LOCK_WAIT_MS) { vault.markExpired("confirmed:$reason") }
            call.resolve(JSObject().put("status", vault.status()))
        }
    }

    /** Whether background watching thought the session ended (the app then syncs, and core asks twice). */
    @PluginMethod
    fun suspect(call: PluginCall) {
        val prefs = context.getSharedPreferences(DEFERRED, Context.MODE_PRIVATE)
        val deferred = prefs.getBoolean("sync", false)
        if (deferred) prefs.edit().remove("sync").commit()
        call.resolve(JSObject().put("suspect", vault.status() == "connected" && vault.suspectCount() > 0).put("deferred", deferred))
    }

    /** The app has drawn its first frame: the launch screen may go (MainActivity). */
    @PluginMethod
    fun ready(call: PluginCall) {
        dev.ikrar.sulo.MainActivity.webReady = true
        call.resolve()
    }

    /** One event code from the app for the session history (Diag keeps codes only). */
    @PluginMethod
    fun note(call: PluginCall) {
        call.getString("e")?.let { Diag.of(context).noteFromApp(it) }
        call.resolve()
    }

    /**
     * One batch to service.php. body: the JSON array the core client built;
     * userInitiated decides nosessionupdate (SikolaRequest.noSessionUpdate).
     * Answers { httpStatus, body } with Moodle's JSON (a 303 when SIKOLA sent
     * us to its login), or { sessionStatus } when there is no session, or
     * { networkError } for a passing failure. It never ends the session:
     * core asks once more and decides (endSession).
     */
    @PluginMethod
    fun request(call: PluginCall) {
        val body = call.getString("body") ?: return call.reject("body missing")
        val userInitiated = call.getBoolean("userInitiated") ?: false
        // A new connection, closed after: core's second ask before a session ends.
        val fresh = call.getBoolean("fresh") ?: false
        val functions = SikolaRequest.allowedFunctions(body) ?: return call.reject("not allowlisted")
        if (deferIfClosing(call)) return
        io.execute {
            val answered = SikolaLock.hold(context, LOCK_WAIT_MS) { batch(call, body, functions, userInitiated, fresh) }
            if (answered == null) call.resolve(JSObject().put("networkError", "Busy").put("sessionStatus", vault.status()))
        }
    }

    private fun batch(call: PluginCall, body: String, functions: List<String>, userInitiated: Boolean, fresh: Boolean) {
        val session = when (val read = vault.read()) {
            is SessionVault.Read.Ok -> read.session
            // Not readable right now (the Keystore not ready): a passing failure, the session stays.
            is SessionVault.Read.Unavailable -> return call.resolve(JSObject().put("networkError", "VaultUnavailable").put("sessionStatus", vault.status()))
            SessionVault.Read.Empty -> return call.resolve(JSObject().put("sessionStatus", vault.status()))
        }
        try {
            var current = session
            // A sesskey only comes from the user's own activity (sign-in or a sync they started).
            if (current.sesskey == null) {
                if (!userInitiated) return call.resolve(JSObject().put("sessionStatus", "connected").put("needsUser", true))
                current = when (val r = refreshSesskey(current)) {
                    is Refresh.Ok -> r.session
                    Refresh.ToLogin -> return toLogin(call, "my")
                    Refresh.None -> return call.resolve(JSObject().put("networkError", "NoSesskey").put("sessionStatus", vault.status()))
                }
            }
            val kept = keeper(current)
            var reply = http.postJson(SikolaRequest.batchUrl(current.sesskey!!, functions, userInitiated), current.moodleSession, body, kept, fresh)
            kept.settle(SikolaRequest.sessionAnswered(reply.body, functions))
            current = kept.session
            if (SikolaRequest.invalidSesskey(reply.body, functions) && userInitiated) {
                current = when (val r = refreshSesskey(current.copy(sesskey = null))) {
                    is Refresh.Ok -> r.session
                    Refresh.ToLogin -> return toLogin(call, "my")
                    Refresh.None -> return call.resolve(JSObject().put("networkError", "NoSesskey").put("sessionStatus", vault.status()))
                }
                val again = keeper(current)
                reply = http.postJson(SikolaRequest.batchUrl(current.sesskey!!, functions, true), current.moodleSession, body, again, fresh)
                again.settle(SikolaRequest.sessionAnswered(reply.body, functions))
            }
            if (reply.status in 300..399 && reply.location?.contains("/login/") == true) return toLogin(call, "batch")
            if (SikolaRequest.loginRequired(reply.body, functions)) {
                // SIKOLA said "log in" once; core asks again before anything ends.
                Diag.of(context).note("sikola_login_signal:batch:${SikolaRequest.sessionCodes(reply.body, functions).firstOrNull() ?: "?"}")
            } else if (SikolaRequest.sessionAnswered(reply.body, functions)) {
                vault.clearSuspect()
            }
            call.resolve(JSObject().put("httpStatus", reply.status).put("body", reply.body).put("sessionStatus", vault.status()))
        } catch (e: Exception) {
            // The kind of failure only, never a message that could carry the URL.
            call.resolve(JSObject().put("networkError", e.javaClass.simpleName).put("sessionStatus", vault.status()))
        }
    }

    /** SIKOLA sent us to its login: a 303 for core, which asks once more before anything ends. */
    private fun toLogin(call: PluginCall, where: String) {
        Diag.of(context).note("sikola_login_signal:redirect:$where")
        call.resolve(JSObject().put("httpStatus", 303).put("body", "").put("toLogin", true).put("sessionStatus", vault.status()))
    }

    /**
     * One allowlisted SIKOLA page (SikolaPage: attendance only, id/mode/view),
     * only for something the user started. Answers { httpStatus, html } with
     * the page stripped for JavaScript (no head, scripts, forms or sesskey);
     * a redirect comes back as its status, with toLogin when it goes to
     * SIKOLA's login (core asks again). Never ends the session itself.
     */
    @PluginMethod
    fun page(call: PluginCall) {
        val path = call.getString("path") ?: return call.reject("path missing")
        val url = SikolaPage.allowedUrl(path) ?: return call.reject("not allowlisted")
        if (call.getBoolean("userInitiated") != true) return call.reject("user only")
        if (deferIfClosing(call)) return
        io.execute {
            val answered = SikolaLock.hold(context, LOCK_WAIT_MS) { fetchPage(call, url) }
            if (answered == null) call.resolve(JSObject().put("networkError", "Busy").put("sessionStatus", vault.status()))
        }
    }

    private fun fetchPage(call: PluginCall, url: String) {
        val session = when (val read = vault.read()) {
            is SessionVault.Read.Ok -> read.session
            // Not readable right now: a passing failure, never "signed out".
            is SessionVault.Read.Unavailable -> return call.resolve(JSObject().put("networkError", "VaultUnavailable").put("sessionStatus", vault.status()))
            SessionVault.Read.Empty -> return call.resolve(JSObject().put("sessionStatus", vault.status()))
        }
        try {
            val pageKeeper = keeper(session)
            val reply = http.get(url, session.moodleSession, pageKeeper)
            // A page cannot show the session is valid by itself: a new cookie from it is never used.
            pageKeeper.settle(false)
            if (reply.status in 300..399) {
                val login = reply.location?.contains("/login/") == true
                Diag.of(context).note(if (login) "sikola_login_signal:redirect:page" else "sikola_page_redirect")
                return call.resolve(JSObject().put("httpStatus", reply.status).put("html", "").put("toLogin", login).put("sessionStatus", vault.status()))
            }
            call.resolve(JSObject().put("httpStatus", reply.status).put("html", SikolaPage.forJs(reply.body, listOfNotNull(session.sesskey))).put("sessionStatus", vault.status()))
        } catch (e: Exception) {
            call.resolve(JSObject().put("networkError", e.javaClass.simpleName).put("sessionStatus", vault.status()))
        }
    }

    private sealed class Refresh {
        data class Ok(val session: SikolaSession) : Refresh()
        object ToLogin : Refresh()
        object None : Refresh()
    }

    /** GET /my/ for a fresh sesskey. A redirect to SIKOLA's login is reported, never acted on here. */
    private fun refreshSesskey(session: SikolaSession): Refresh {
        val kept = keeper(session)
        val page = http.get("${Sikola.ORIGIN}/my/", session.moodleSession, kept)
        // A signed-in /my/ carries a sesskey; only then is a new cookie the session's.
        kept.settle(page.status == 200 && SikolaText.sesskey(page.body) != null)
        if (page.status in 300..399 && page.location?.contains("/login/") == true) return Refresh.ToLogin
        val sesskey = SikolaText.sesskey(page.body) ?: return Refresh.None
        return Refresh.Ok(kept.session.copy(sesskey = sesskey).also { vault.save(it) })
    }

    /** "Keluar": SIKOLA's cookies and web storage in this app, the vault and its Keystore key. */
    @PluginMethod
    fun logout(call: PluginCall) {
        SignOut(
            webData(),
            vault,
            listOf(
                { Diag.of(context).clear() },
                // Keluar also ends background watching: no check, no queue, no plan.
                { dev.ikrar.sulo.watch.WatchScheduler.stop(context) },
                { dev.ikrar.sulo.watch.WatchStore(context).clear() },
            ),
        ).run { call.resolve(JSObject().put("status", "none")) }
    }

    /** The WebViews' data: cookies, web storage (NEOSIA's localStorage) and the HTTP cache. */
    private fun webData() = object : CookieJar {
        override fun clearAll(done: () -> Unit) {
            CookieManager.getInstance().removeAllCookies {
                CookieManager.getInstance().flush()
                WebStorage.getInstance().deleteAllData()
                // The cache is shared by every WebView of the app; clearing it needs one, on the main thread.
                activity.runOnUiThread {
                    runCatching { android.webkit.WebView(context).apply { clearCache(true); destroy() } }
                    io.execute(done)
                }
            }
        }
    }

    /**
     * "Batal" on the different-account screen: the session just signed in is
     * thrown away (SIKOLA's cookies, web storage, the vault and its key) and
     * the state reads "expired", so the app shows the previous account's
     * data with its calm "Masuk lagi" line. Nothing of that data is touched.
     */
    @PluginMethod
    fun discardSession(call: PluginCall) {
        accountReset().discardSession { status -> call.resolve(JSObject().put("status", status)) }
    }

    /**
     * "Pakai akun ini": background watching starts from nothing for the new
     * account: no check scheduled, no plan, no queued answer, no held notice,
     * no timings. The session stays.
     */
    @PluginMethod
    fun watchReset(call: PluginCall) {
        io.execute {
            accountReset().watchReset()
            call.resolve()
        }
    }

    private fun accountReset() = AccountReset(vault, dev.ikrar.sulo.watch.WatchStore(context), webData()) { dev.ikrar.sulo.watch.WatchScheduler.stop(context) }

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

    /**
     * pnpm mobile:test-restart: writes the same session again and again for
     * `ms` (decrypt, encrypt, atomic write), so the process can be ended in
     * the middle of a vault write. No request; the session is unchanged.
     */
    @PluginMethod
    fun devVaultChurn(call: PluginCall) {
        if (!BuildConfig.DEBUG) return call.reject("debug only")
        val until = System.currentTimeMillis() + (call.getInt("ms") ?: 3000).coerceIn(0, 20_000)
        io.execute {
            var writes = 0
            SikolaLock.hold(context, LOCK_WAIT_MS) {
                val session = vault.load() ?: return@hold
                while (System.currentTimeMillis() < until) {
                    vault.save(session, note = false)
                    writes++
                }
            }
            call.resolve(JSObject().put("writes", writes))
        }
    }

    /**
     * Debug builds: whether the vault's MoodleSession is the one in the WebView's
     * CookieManager ("same", "different", "none_in_webview", "no_vault"), and how
     * many MoodleSession entries the WebView holds for SIKOLA. Never a value.
     */
    @PluginMethod
    fun devCookieCompare(call: PluginCall) {
        if (!BuildConfig.DEBUG) return call.reject("debug only")
        io.execute {
            val vaultCookie = vault.load()?.moodleSession
            val jar = CookieManager.getInstance().getCookie(Sikola.ORIGIN).orEmpty()
            val inWebView = jar.split(';').map { it.trim() }.filter { it.startsWith("${Sikola.SESSION_COOKIE}=") }.map { it.substringAfter('=') }
            val verdict = when {
                vaultCookie == null -> "no_vault"
                inWebView.isEmpty() -> "none_in_webview"
                inWebView.contains(vaultCookie) -> "same"
                else -> "different"
            }
            call.resolve(JSObject().put("verdict", verdict).put("webViewCount", inWebView.size).put("webViewCookieNames", com.getcapacitor.JSArray(jar.split(';').map { it.trim().substringBefore('=') }.filter { it.isNotEmpty() })))
        }
    }

    /** Debug builds: the owner's one-off test budget for `date` (today); one background check may use it. */
    @PluginMethod
    fun devTestBudget(call: PluginCall) {
        if (!BuildConfig.DEBUG) return call.reject("debug only")
        val date = call.getString("date") ?: return call.reject("date missing")
        dev.ikrar.sulo.watch.TestBudget.set(context, date)
        Diag.of(context).note("test_budget_on")
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
