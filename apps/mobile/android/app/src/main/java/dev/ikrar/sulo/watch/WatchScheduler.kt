package dev.ikrar.sulo.watch

import android.content.Context
import androidx.work.Constraints
import androidx.work.Data
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkInfo
import androidx.work.WorkManager
import androidx.work.Worker
import androidx.work.WorkerParameters
import java.util.concurrent.TimeUnit

/**
 * The check chain: always exactly one pending check (unique work, REPLACE),
 * each scheduling the next one for the interval the plan gives at that
 * hour, since a periodic job cannot change its own interval. Rescheduled
 * when the app opens and after every sync the user starts (which restarts
 * the interval), and kept alive by a guard every 6 hours that only checks
 * the chain is still there: the guard never sends anything to SIKOLA.
 * WorkManager keeps pending work across a reboot on its own.
 */
object WatchScheduler {
    const val CHAIN = "sulo-watch"
    const val GUARD = "sulo-watch-guard"
    const val MODE = "mode"
    const val MODE_CHECK = "check"
    /** After the session ended during quiet hours: only the calm notice, once quiet hours end. */
    const val MODE_EXPIRED_NOTICE = "expired-notice"
    /** The app not opened for 7 days, paused during quiet hours: only the notice, once they end (no request). */
    const val MODE_PAUSED_NOTICE = "paused-notice"
    /** Debug build: one check now, the same work (gate, budget, one POST), even with the app open. */
    const val MODE_CHECK_NOW = "check-now"
    /** Debug build: send the simulated held notices as one summary (no request). */
    const val MODE_SIM_FLUSH = "sim-flush"
    const val SIM = "sulo-watch-sim"
    const val PREFIX = "prefix"

    private val network = Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()

    /** The next check in `delaySec` (REPLACE: the previous pending one is dropped). */
    fun next(context: Context, delaySec: Long, now: Long, mode: String = MODE_CHECK) {
        val request = OneTimeWorkRequestBuilder<WatchWorker>()
            .setInitialDelay(delaySec.coerceAtLeast(0), TimeUnit.SECONDS)
            .setInputData(Data.Builder().putString(MODE, mode).build())
            .apply { if (mode == MODE_CHECK || mode == MODE_CHECK_NOW) setConstraints(network) }
            .build()
        WorkManager.getInstance(context).enqueueUniqueWork(CHAIN, ExistingWorkPolicy.REPLACE, request)
        WatchStore(context).setPlannedAt(now + delaySec)
        ensureGuard(context)
    }

    /** Debug simulations run apart from the chain, so they never replace the next real check. */
    fun simulation(context: Context, delaySec: Long, prefix: String) {
        val request = OneTimeWorkRequestBuilder<WatchWorker>()
            .setInitialDelay(delaySec.coerceAtLeast(0), TimeUnit.SECONDS)
            .setInputData(Data.Builder().putString(MODE, MODE_SIM_FLUSH).putString(PREFIX, prefix).build())
            .build()
        WorkManager.getInstance(context).enqueueUniqueWork(SIM, ExistingWorkPolicy.REPLACE, request)
    }

    fun ensureGuard(context: Context) {
        val guard = PeriodicWorkRequestBuilder<WatchGuardWorker>(6, TimeUnit.HOURS).build()
        WorkManager.getInstance(context).enqueueUniquePeriodicWork(GUARD, ExistingPeriodicWorkPolicy.KEEP, guard)
    }

    /** Stops every check at once (switch off, Keluar, session ended, config off). */
    fun stop(context: Context) {
        WorkManager.getInstance(context).cancelUniqueWork(CHAIN)
        WorkManager.getInstance(context).cancelUniqueWork(GUARD)
        WatchStore(context).setPlannedAt(0)
    }

    /** The guard alone: a one-off notice waiting in the chain stays. */
    fun stopGuard(context: Context) {
        WorkManager.getInstance(context).cancelUniqueWork(GUARD)
    }

    fun chainPending(context: Context): Boolean = runCatching {
        WorkManager.getInstance(context).getWorkInfosForUniqueWork(CHAIN).get(5, TimeUnit.SECONDS).any { it.state == WorkInfo.State.ENQUEUED || it.state == WorkInfo.State.RUNNING || it.state == WorkInfo.State.BLOCKED }
    }.getOrDefault(true)
}

/** Every 6 hours: if watching is on and the chain is gone, start it again. No request. */
class WatchGuardWorker(context: Context, params: WorkerParameters) : Worker(context, params) {
    override fun doWork(): Result {
        val store = WatchStore(applicationContext)
        val plan = store.plan()
        if (plan == null || !plan.optBoolean("enabled", false)) {
            WatchScheduler.stop(applicationContext)
            return Result.success()
        }
        // Paused (the app not opened for 7 days): nothing to restart until it is opened; a notice
        // waiting for quiet hours to end stays in the chain.
        if (System.currentTimeMillis() / 1000 - plan.optLong("writtenAt", 0) >= WatchRemote.APP_PAUSE_SEC) {
            WatchScheduler.stopGuard(applicationContext)
            return Result.success()
        }
        val status = dev.ikrar.sulo.session.SessionVault(applicationContext).status()
        if (status != "connected") {
            // Ended or signed out: nothing to restart until the user signs in (the app then writes a new plan).
            // Only the guard stops, so a "Masuk lagi" notice waiting for quiet hours to end is not cancelled.
            WatchScheduler.stopGuard(applicationContext)
            return Result.success()
        }
        if (WatchGate.guardRestarts(true, status, WatchScheduler.chainPending(applicationContext))) WatchScheduler.next(applicationContext, 60, System.currentTimeMillis() / 1000)
        return Result.success()
    }
}
