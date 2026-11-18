package dev.ikrar.sulo.watch

import android.annotation.SuppressLint
import android.content.Context
import android.os.PowerManager
import android.os.UserManager
import androidx.work.Worker
import androidx.work.WorkerParameters
import dev.ikrar.sulo.BuildConfig
import dev.ikrar.sulo.MainActivity
import dev.ikrar.sulo.session.SessionVault
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
            else WatchRun(applicationContext).run(mode)
        }
        return Result.success()
    }
}

class WatchRun(private val context: Context) {
    private val store = WatchStore(context)
    private val vault = SessionVault(context)
    private val http = SikolaHttp("Sulo/${BuildConfig.VERSION_NAME} (Android)")

    private fun nowSec() = System.currentTimeMillis() / 1000
    private fun minuteOfDay(): Int = Calendar.getInstance().let { it.get(Calendar.HOUR_OF_DAY) * 60 + it.get(Calendar.MINUTE) }
    private fun today(): String = Calendar.getInstance().let { String.format("%04d-%02d-%02d", it.get(Calendar.YEAR), it.get(Calendar.MONTH) + 1, it.get(Calendar.DAY_OF_MONTH)) }
    private fun powerSave(): Boolean = (context.getSystemService(Context.POWER_SERVICE) as? PowerManager)?.isPowerSaveMode == true
    private fun userUnlocked(): Boolean = (context.getSystemService(Context.USER_SERVICE) as? UserManager)?.isUserUnlocked != false

    fun run(mode: String) {
        val started = System.currentTimeMillis()
        val now = nowSec()
        val plan = store.plan()
        if (mode == WatchScheduler.MODE_EXPIRED_NOTICE) return expiredNotice(plan, now, chainStopped = true)

        val session = if (userUnlocked()) vault.load() else null
        val backoff = store.backoff()
        val action = WatchGate.decide(
            WatchGate.Input(
                planPresent = plan != null,
                planEnabled = plan?.optBoolean("enabled", false) == true,
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
            WatchGate.Action.EXPIRED -> return sessionEnded(plan!!, now)
            WatchGate.Action.WAIT -> return scheduleNext(plan!!, now, waitUntil = backoff?.optLong("nextAllowedAt", 0) ?: 0)
            WatchGate.Action.RUN -> Unit
        }
        plan!!
        val budget = store.budget()
        val used = if (budget?.optString("date") == today()) budget.optInt("used", 0) else 0
        val ctx = WatchCheck.Ctx(minuteOfDay(), powerSave(), used)
        if (WatchCheck.nextDelayMinutes(plan, ctx) == null) return untilReset(now)

        // The Radar turn: every radarEvery-th daytime check, the next courses in rotation.
        val day = WatchCheck.isDay(ctx.minuteOfDay, plan)
        val index = store.dayCheckIndex()
        val radar = plan.getJSONObject("radar")
        val rotation = radar.getJSONArray("courseIds").let { a -> (0 until a.length()).map { a.getLong(it) } }
        val pick = if (WatchCheck.radarDue(plan, ctx, index)) WatchCheck.pickRadar(rotation, store.radarCursor(), plan.getJSONObject("schedule").getInt("radarMax")) else WatchCheck.Pick(emptyList(), store.radarCursor())
        if (day) store.setDayCheckIndex(index + 1)

        val batch = WatchCheck.buildBatch(plan, now, pick.ids)
        val reserved = WatchCheck.reserve(budget, today(), now, batch.length(), plan)
        store.setBudget(reserved.next)
        if (!reserved.ok) return scheduleNext(plan, now)
        store.setRadarCursor(pick.cursor)

        val functions = (0 until batch.length()).map { batch.getJSONObject(it).getString("methodname") }
        if (SikolaRequest.allowedFunctions(batch.toString()) == null) return scheduleNext(plan, now)
        val reply = try {
            http.postJson(SikolaRequest.watchBatchUrl(session!!.sesskey!!, functions), session.moodleSession, batch.toString())
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
        if (SikolaRequest.loginRequired(reply.body) || (reply.status in 300..399 && reply.location?.contains("/login/") == true)) {
            record(now, started, bytes, "expired")
            vault.markExpired()
            return sessionEnded(plan, now)
        }
        if (SikolaRequest.invalidSesskey(reply.body)) {
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

        store.enqueue(JSONObject().put("ranAt", now).put("plannedAt", store.plannedAt().takeIf { it > 0 } ?: now).put("radarIds", JSONArray(pick.ids)).put("body", reply.body))
        val results = runCatching { JSONArray(reply.body) }.getOrNull()
        when (val outcome = WatchCheck.detect(plan, store.overlay(), now, results, pick.ids)) {
            WatchCheck.Outcome.Expired -> {
                record(now, started, bytes, "expired")
                vault.markExpired()
                return sessionEnded(plan, now)
            }
            WatchCheck.Outcome.Unsure -> record(now, started, bytes, "unsure")
            is WatchCheck.Outcome.Ok -> {
                store.setOverlay(outcome.overlay)
                // A stale plan (over 48 hours): the baseline cannot be trusted, so no notice; core records it all.
                if (!WatchCheck.planStale(plan, now)) announce(plan, outcome.changes, now)
                record(now, started, bytes, "ok", outcome.changes.size)
            }
        }
        scheduleNext(plan, now)
    }

    @SuppressLint("MissingPermission")
    private fun announce(plan: JSONObject, changes: List<JSONObject>, now: Long) {
        val result = WatchCheck.notices(plan, changes, store.held(), now, minuteOfDay())
        store.setHeld(result.hold)
        val channel = plan.getJSONObject("templates").getString("channel")
        result.send.forEach { WatchNotifier.show(context, channel, it) }
    }

    private fun scheduleNext(plan: JSONObject, now: Long, waitUntil: Long = 0) {
        val budget = store.budget()
        val used = if (budget?.optString("date") == today()) budget.optInt("used", 0) else 0
        val minutes = WatchCheck.nextDelayMinutes(plan, WatchCheck.Ctx(minuteOfDay(), powerSave(), used)) ?: return untilReset(now)
        WatchScheduler.next(context, maxOf(minutes * 60L, waitUntil - now), now)
    }

    /** The hard daily limit: nothing until a few minutes past local midnight. */
    private fun untilReset(now: Long) {
        val c = Calendar.getInstance().apply { add(Calendar.DAY_OF_YEAR, 1); set(Calendar.HOUR_OF_DAY, 0); set(Calendar.MINUTE, 5); set(Calendar.SECOND, 0) }
        WatchScheduler.next(context, c.timeInMillis / 1000 - now, now)
    }

    /** The session ended: stop the chain, and one calm notice at most once a day, never in quiet hours. */
    private fun sessionEnded(plan: JSONObject, now: Long) {
        val lastOk = store.timings().let { t -> (t.length() - 1 downTo 0).map { t.getJSONObject(it) }.firstOrNull { it.optString("outcome") == "ok" }?.optLong("ranAt", 0) ?: 0 }
        store.recordSessionEnd(JSONObject().put("at", now).put("sinceLastOkSec", if (lastOk > 0) now - lastOk else JSONObject.NULL).put("heldBack", lastOk > 0 && now - lastOk > 2 * 3600))
        WatchScheduler.stop(context)
        expiredNotice(plan, now, chainStopped = true)
    }

    @SuppressLint("MissingPermission")
    private fun expiredNotice(plan: JSONObject?, now: Long, chainStopped: Boolean) {
        if (plan == null || vault.status() != "expired") return
        if (now - store.lastExpiredNoticeAt() < EXPIRED_NOTICE_GAP_SEC) return
        val quiet = plan.getJSONObject("quiet")
        if (WatchCheck.inQuiet(minuteOfDay(), quiet)) {
            // Later, when quiet hours end: a one-off that sends nothing to SIKOLA.
            val end = quiet.getInt("endMin")
            val c = Calendar.getInstance().apply { set(Calendar.HOUR_OF_DAY, end / 60); set(Calendar.MINUTE, end % 60); set(Calendar.SECOND, 0); if (timeInMillis <= System.currentTimeMillis()) add(Calendar.DAY_OF_YEAR, 1) }
            if (chainStopped) WatchScheduler.next(context, c.timeInMillis / 1000 - now, now, WatchScheduler.MODE_EXPIRED_NOTICE)
            return
        }
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

    companion object {
        const val EXPIRED_NOTICE_GAP_SEC = 24L * 3600
    }
}
