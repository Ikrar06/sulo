package dev.ikrar.sulo.watch

import android.annotation.SuppressLint
import android.content.Context
import android.os.PowerManager
import android.os.UserManager
import androidx.work.Worker
import androidx.work.WorkerParameters
import dev.ikrar.sulo.BuildConfig
import dev.ikrar.sulo.MainActivity
import dev.ikrar.sulo.session.CookieKeeper
import dev.ikrar.sulo.session.CookieStats
import dev.ikrar.sulo.session.Diag
import dev.ikrar.sulo.session.SessionVault
import dev.ikrar.sulo.session.SikolaLock
import dev.ikrar.sulo.session.SikolaHttp
import dev.ikrar.sulo.session.SikolaRequest
import org.json.JSONArray
import org.json.JSONObject
import java.util.Calendar

/**
 * One background check of "Pantau tugas baru" (M8c.3). Follows the plan
 * core wrote (WatchStore.plan): the gate (WatchGate), the interval and the
 * Radar turn, the shared budget and backoff, one POST batch with
 * nosessionupdate=false, then the answer: encrypted into the queue for core,
 * compared with the baseline, and announced from the plan's templates
 * (held during quiet hours). Anything not understood stays silent; core
 * records it when the app opens. Never logs; never touches the password.
 */
class WatchWorker(context: Context, params: WorkerParameters) : Worker(context, params) {
    override fun doWork(): Result {
        val mode = inputData.getString(WatchScheduler.MODE) ?: WatchScheduler.MODE_CHECK
        runCatching {
            if (mode == WatchScheduler.MODE_SIM_FLUSH) WatchSimulate(applicationContext).flush(inputData.getString(WatchScheduler.PREFIX) ?: "")
            // One holder at a time with the app's syncs; busy: the same check a little later (the chain stays).
            else SikolaLock.hold(applicationContext, LOCK_WAIT_MS) { WatchRun(applicationContext).run(mode) }
                ?: WatchScheduler.next(applicationContext, BUSY_RETRY_SEC, System.currentTimeMillis() / 1000, mode)
        }
        return Result.success()
    }

    private companion object {
        /** How long a check waits for the app to finish with SIKOLA. */
        const val LOCK_WAIT_MS = 30_000L
        const val BUSY_RETRY_SEC = 120L
    }
}

class WatchRun(private val context: Context) {
    /** The store's generation when this check started (see WatchStore.reset). */
    private var runGen = 0L
    private val store = WatchStore(context)
    private val vault = SessionVault.of(context)
    private val userAgent = "Sulo/${BuildConfig.VERSION_NAME} (Android)"
    private val http = SikolaHttp(userAgent, strict = BuildConfig.DEBUG, onHandlerCleared = { dev.ikrar.sulo.session.Diag.of(context).note("cookie_handler_cleared") })

    private fun nowSec() = System.currentTimeMillis() / 1000
    private fun minuteOfDay(): Int = Calendar.getInstance().let { it.get(Calendar.HOUR_OF_DAY) * 60 + it.get(Calendar.MINUTE) }
    private fun today(): String = Calendar.getInstance().let { String.format("%04d-%02d-%02d", it.get(Calendar.YEAR), it.get(Calendar.MONTH) + 1, it.get(Calendar.DAY_OF_MONTH)) }
    private fun powerSave(): Boolean = (context.getSystemService(Context.POWER_SERVICE) as? PowerManager)?.isPowerSaveMode == true
    private fun userUnlocked(): Boolean = (context.getSystemService(Context.USER_SERVICE) as? UserManager)?.isUserUnlocked != false

    fun run(mode: String) {
        val started = System.currentTimeMillis()
        val now = nowSec()
        // A WebView too old for the app: the app shows the update page, and nothing runs here either.
        if (!WebViewGate.supported(context)) return WatchScheduler.stop(context)
        // A reset after this point ("Pakai akun ini") makes this check's writes void.
        val gen = store.generation()
        runGen = gen
        val stored = store.plan()
        if (mode == WatchScheduler.MODE_EXPIRED_NOTICE) return expiredNotice(stored, now, chainStopped = true)
        if (mode == WatchScheduler.MODE_PAUSED_NOTICE) return if (stored != null && pausedFor(stored, now)) pausedNotice(stored, now) else Unit

        val session = if (userUnlocked()) vault.load() else null
        val backoff = store.backoff()
        val action = WatchGate.decide(
            WatchGate.Input(
                planPresent = stored != null,
                planEnabled = stored?.optBoolean("enabled", false) == true,
                userUnlocked = userUnlocked(),
                sessionStatus = vault.status(),
                // "Jalankan cek sekarang" (debug build) runs with the app open on purpose.
                appInForeground = MainActivity.inForeground && mode != WatchScheduler.MODE_CHECK_NOW,
                hasSesskey = session?.sesskey != null,
                backingOff = WatchCheck.backingOff(backoff, now),
            ),
        )
        when (action) {
            WatchGate.Action.STOP -> return WatchScheduler.stop(context)
            WatchGate.Action.EXPIRED -> return sessionEnded(stored!!, now)
            WatchGate.Action.WAIT -> return scheduleNext(stored!!, now, waitUntil = backoff?.optLong("nextAllowedAt", 0) ?: 0)
            WatchGate.Action.RUN -> Unit
        }
        // The kill switch, read by the worker itself (WatchRemote): decided before anything goes to SIKOLA.
        val plan = when (val d = remoteDecision(stored!!, now)) {
            is WatchRemote.Decision.Paused -> {
                record(now, started, 0, "paused")
                WatchScheduler.stop(context)
                return pausedNotice(stored, now)
            }
            is WatchRemote.Decision.Hold -> {
                // Off, or no fresh config: nothing to SIKOLA; wake again in 6 hours only to read the config.
                record(now, started, 0, "hold_${d.reason}")
                if (runGen == store.generation()) WatchScheduler.next(context, d.intervalMin * 60L, now)
                return
            }
            is WatchRemote.Decision.Check -> WatchRemote.withSchedule(stored, d)
        }
        val budget = store.budget()
        val ctx = dayCtx(budget)
        // Debug builds, the owner's one-off test budget (20 Nov 2026): one "Jalankan cek sekarang" may go past today's limit.
        val testOnce = BuildConfig.DEBUG && mode == WatchScheduler.MODE_CHECK_NOW && TestBudget.available(context, today())
        if (WatchCheck.nextDelayMinutes(plan, ctx) == null && !testOnce) return untilReset(now)

        // The Radar turn: every radarEvery-th daytime check, the next courses in rotation.
        val day = WatchCheck.isDay(ctx.minuteOfDay, plan)
        val index = store.dayCheckIndex()
        val radar = plan.getJSONObject("radar")
        val rotation = radar.getJSONArray("courseIds").let { a -> (0 until a.length()).map { a.getLong(it) } }
        val turn = if (WatchCheck.radarDue(plan, ctx, index)) WatchCheck.pickRadar(rotation, store.radarCursor(), plan.getJSONObject("schedule").getInt("radarMax")) else WatchCheck.Pick(emptyList(), store.radarCursor())
        // Radar gives way first when the day is filling up; its turn waits (the cursor stays).
        val pick = if (turn.ids.isNotEmpty() && !WatchCheck.radarFits(plan, ctx.callsToday, plan.getJSONArray("calls").length(), turn.ids.size)) WatchCheck.Pick(emptyList(), store.radarCursor()) else turn
        if (day) store.setDayCheckIndex(index + 1)

        val batch = WatchCheck.buildBatch(plan, now, pick.ids)
        val reserved = WatchCheck.reserve(budget, today(), now, batch.length(), plan)
        val viaTest = !reserved.ok && testOnce && TestBudget.take(context, today())
        store.setBudget(if (viaTest) reserved.next.put("used", reserved.next.optInt("used", 0) + 1) else reserved.next)
        if (!reserved.ok && !viaTest) return scheduleNext(plan, now)
        store.setRadarCursor(pick.cursor)

        val functions = (0 until batch.length()).map { batch.getJSONObject(it).getString("methodname") }
        if (SikolaRequest.allowedFunctions(batch.toString()) == null) return scheduleNext(plan, now)
        val reply = try {
            val kept = CookieKeeper(session!!, vault, CookieStats.of(context), Diag.of(context))
            http.postJson(SikolaRequest.watchBatchUrl(session.sesskey!!, functions), session.moodleSession, batch.toString(), kept)
                .also { kept.settle(SikolaRequest.sessionAnswered(it.body, functions)) }
        } catch (e: Exception) {
            record(now, started, 0, "network")
            store.setBackoff(WatchCheck.afterFailure(backoff, now, null, Math.random()))
            return scheduleNext(plan, now, waitUntil = store.backoff()?.optLong("nextAllowedAt", 0) ?: 0)
        }
        val bytes = reply.body.length
        if (reply.status == 429 || reply.status >= 500) {
            record(now, started, bytes, "http_${reply.status}")
            store.setBackoff(WatchCheck.afterFailure(backoff, now, reply.retryAfter?.trim()?.toLongOrNull(), Math.random()))
            return scheduleNext(plan, now, waitUntil = store.backoff()?.optLong("nextAllowedAt", 0) ?: 0)
        }
        if (SikolaRequest.loginRequired(reply.body, functions) || (reply.status in 300..399 && reply.location?.contains("/login/") == true)) {
            record(now, started, bytes, "suspect")
            return loginSignal(plan, now, if (reply.status in 300..399) "redirect" else SikolaRequest.sessionCodes(reply.body, functions).firstOrNull() ?: "?")
        }
        if (SikolaRequest.invalidSesskey(reply.body, functions)) {
            // Only the user's next sync may fetch a new sesskey; wait for it.
            record(now, started, bytes, "invalid_sesskey")
            vault.save(session!!.copy(sesskey = null))
            return scheduleNext(plan, now)
        }
        if (reply.status != 200) {
            record(now, started, bytes, "http_${reply.status}")
            return scheduleNext(plan, now)
        }
        if (store.backoff()?.optInt("failures", 0) ?: 0 > 0) store.setBackoff(JSONObject().put("failures", 0).put("nextAllowedAt", 0))

        store.enqueue(gen = gen, answer = JSONObject().put("ranAt", now).put("plannedAt", store.plannedAt().takeIf { it > 0 } ?: now).put("radarIds", JSONArray(pick.ids)).put("body", reply.body))
        val results = runCatching { JSONArray(reply.body) }.getOrNull()
        when (val outcome = WatchCheck.detect(plan, store.overlay(), now, results, pick.ids)) {
            WatchCheck.Outcome.Expired -> {
                record(now, started, bytes, "suspect")
                return loginSignal(plan, now, "detect")
            }
            WatchCheck.Outcome.Unsure -> record(now, started, bytes, "unsure")
            is WatchCheck.Outcome.Ok -> {
                vault.clearSuspect()
                store.setOverlay(outcome.overlay, gen)
                // A stale plan (over 48 hours): the baseline cannot be trusted, so no notice; core records it all.
                // Not after a reset: the plan this check read belongs to the previous account.
                if (!WatchCheck.planStale(plan, now) && gen == store.generation()) announce(plan, outcome.changes, now, gen)
                record(now, started, bytes, "ok", outcome.changes.size)
            }
        }
        scheduleNext(plan, now)
    }

    /**
     * Reads config.json when the last read (the worker's or the app's) is 6
     * hours old, then decides from the newest good config either side has.
     */
    private fun remoteDecision(plan: JSONObject, now: Long): WatchRemote.Decision {
        val seed = plan.optJSONObject("remote")
        val url = PublicConfig.urlFor(seed?.optString("url", "")?.takeIf { it.isNotEmpty() })
        val readAt = maxOf(store.remoteReadAt(), seed?.optLong("readAt", 0) ?: 0)
        if (WatchRemote.readDue(readAt, now)) readConfig(url, now)
        val planOk = seed?.optLong("okAt", 0) ?: 0
        val workerOk = store.remoteOkAt()
        val fromPlan = WatchRemote.fromJson(seed?.optJSONObject("config"))
        val fromWorker = WatchRemote.fromJson(store.remoteConfig())
        val config = if (workerOk >= planOk) fromWorker ?: fromPlan else fromPlan ?: fromWorker
        return WatchRemote.decide(WatchRemote.State(now, plan.optLong("writtenAt", 0), maxOf(workerOk, planOk), config))
    }

    private fun readConfig(url: String, now: Long) {
        store.setRemoteAttempt(now)
        val etag = store.remoteEtag(url)
        val reply = PublicConfig.fetch(url, etag, userAgent)
        when (val r = WatchRemote.parse(reply.status, reply.body)) {
            is WatchRemote.Read.Ok -> store.setRemoteGood(now, url, WatchRemote.toJson(r.config), reply.etag)
            // Only a 304 to our own If-None-Match confirms the file we kept.
            WatchRemote.Read.NotModified -> if (etag != null) store.setRemoteGood(now, url, null, null)
            WatchRemote.Read.Failed -> Unit
        }
    }

    private fun pausedFor(plan: JSONObject, now: Long): Boolean = now - plan.optLong("writtenAt", 0) >= WatchRemote.APP_PAUSE_SEC

    /** The app not opened for 7 days: one calm notice, never in quiet hours (then once they end). */
    @SuppressLint("MissingPermission")
    private fun pausedNotice(plan: JSONObject, now: Long) {
        if (store.pausedSent()) return
        val t = plan.getJSONObject("templates")
        val p = t.optJSONObject("paused") ?: return
        val quiet = plan.getJSONObject("quiet")
        if (WatchCheck.inQuiet(minuteOfDay(), quiet)) {
            val end = quiet.getInt("endMin")
            val c = Calendar.getInstance().apply { set(Calendar.HOUR_OF_DAY, end / 60); set(Calendar.MINUTE, end % 60); set(Calendar.SECOND, 0); if (timeInMillis <= System.currentTimeMillis()) add(Calendar.DAY_OF_YEAR, 1) }
            WatchScheduler.next(context, c.timeInMillis / 1000 - now, now, WatchScheduler.MODE_PAUSED_NOTICE)
            return
        }
        store.setPausedSent()
        val id = "watch|paused:$now"
        WatchNotifier.show(context, t.getString("channel"), WatchCheck.Notice(id, WatchCheck.numericId(id), p.getString("title"), p.getString("body")))
    }

    @SuppressLint("MissingPermission")
    private fun announce(plan: JSONObject, changes: List<JSONObject>, now: Long, gen: Long) {
        val result = WatchCheck.notices(plan, changes, store.held(), now, minuteOfDay())
        store.setHeld(result.hold, gen)
        val channel = plan.getJSONObject("templates").getString("channel")
        result.send.forEach { WatchNotifier.show(context, channel, it) }
    }

    /** Today's shared budget as the interval sees it (another day counts as zero). */
    private fun dayCtx(budget: JSONObject?): WatchCheck.Ctx {
        val sameDay = budget?.optString("date") == today()
        return WatchCheck.Ctx(minuteOfDay(), powerSave(), if (sameDay) budget!!.optInt("used", 0) else 0, if (sameDay) budget!!.optInt("calls", 0) else 0)
    }

    private fun scheduleNext(plan: JSONObject, now: Long, waitUntil: Long = 0) {
        // Reset while this check ran ("Pakai akun ini"): the chain stays stopped.
        if (runGen != store.generation()) return
        val minutes = WatchCheck.nextDelayMinutes(plan, dayCtx(store.budget())) ?: return untilReset(now)
        WatchScheduler.next(context, maxOf(minutes * 60L, waitUntil - now), now)
    }

    /** Watching stopped for the day (the watch stop or the hard limit): nothing until a few minutes past local midnight. */
    private fun untilReset(now: Long) {
        val c = Calendar.getInstance().apply { add(Calendar.DAY_OF_YEAR, 1); set(Calendar.HOUR_OF_DAY, 0); set(Calendar.MINUTE, 5); set(Calendar.SECOND, 0) }
        WatchScheduler.next(context, c.timeInMillis / 1000 - now, now)
    }

    /** The session ended: stop the chain, and one calm notice at most once a day, never in quiet hours. */
    /**
     * SIKOLA said "log in" to this check. The worker never ends the session:
     * it marks it to be confirmed (the app asks twice on its next sync). Only
     * the second such answer in a row tells the user, and stops the chain.
     */
    private fun loginSignal(plan: JSONObject, now: Long, code: String) {
        val count = vault.markSuspect("watch:$code")
        when (WatchGate.afterLoginSignal(count)) {
            WatchGate.Signal.CHECK_AGAIN -> scheduleNext(plan, now)
            WatchGate.Signal.NOTIFY_AND_STOP -> sessionEnded(plan, now)
        }
    }

    private fun sessionEnded(plan: JSONObject, now: Long) {
        val lastOk = store.timings().let { t -> (t.length() - 1 downTo 0).map { t.getJSONObject(it) }.firstOrNull { it.optString("outcome") == "ok" }?.optLong("ranAt", 0) ?: 0 }
        store.recordSessionEnd(JSONObject().put("at", now).put("sinceLastOkSec", if (lastOk > 0) now - lastOk else JSONObject.NULL).put("heldBack", lastOk > 0 && now - lastOk > 2 * 3600))
        WatchScheduler.stop(context)
        expiredNotice(plan, now, chainStopped = true)
    }

    @SuppressLint("MissingPermission")
    private fun expiredNotice(plan: JSONObject?, now: Long, chainStopped: Boolean) {
        // Once per ended session: never again until the user signs in (WatchStore.setPlan clears it).
        if (plan == null || !WatchGate.mayNotifyExpired(store.expiredSent(), vault.status(), vault.suspectCount())) return
        val quiet = plan.getJSONObject("quiet")
        if (WatchCheck.inQuiet(minuteOfDay(), quiet)) {
            // Later, when quiet hours end: a one-off that sends nothing to SIKOLA.
            val end = quiet.getInt("endMin")
            val c = Calendar.getInstance().apply { set(Calendar.HOUR_OF_DAY, end / 60); set(Calendar.MINUTE, end % 60); set(Calendar.SECOND, 0); if (timeInMillis <= System.currentTimeMillis()) add(Calendar.DAY_OF_YEAR, 1) }
            if (chainStopped) WatchScheduler.next(context, c.timeInMillis / 1000 - now, now, WatchScheduler.MODE_EXPIRED_NOTICE)
            return
        }
        store.setExpiredSent()
        store.setLastExpiredNoticeAt(now)
        val t = plan.getJSONObject("templates")
        val e = t.getJSONObject("expired")
        val id = "session|watch:$now"
        WatchNotifier.show(context, t.getString("channel"), WatchCheck.Notice(id, WatchCheck.numericId(id), e.getString("title"), e.getString("body")))
    }

    /** Times, duration, size and an outcome code only (the dev screen and the battery numbers). */
    private fun record(now: Long, startedMs: Long, bytes: Int, outcome: String, changes: Int = 0) {
        store.recordTiming(JSONObject().put("plannedAt", store.plannedAt()).put("ranAt", now).put("ms", System.currentTimeMillis() - startedMs).put("bytes", bytes).put("outcome", outcome).put("changes", changes))
    }

}
