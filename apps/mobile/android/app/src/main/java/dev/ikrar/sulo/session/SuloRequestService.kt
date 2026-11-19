package dev.ikrar.sulo.session

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import dev.ikrar.sulo.R

/**
 * Lives only while a request to SIKOLA is in flight (RequestGuard): a
 * foreground service, so swiping Sulo away from Recents does not end the
 * process mid-request (SIKOLA ends the session when that happens).
 *
 * - Android 14 and newer: type shortService (no extra permission).
 *   Android 10 to 13: dataSync. Android 8 and 9: a plain foreground service.
 * - Its notification uses its own low channel ("Memperbarui": no sound, no
 *   vibration, no badge) and Android 12's default deferral, so a request of
 *   a few seconds never shows it. Gone as soon as the service stops.
 * - A hard limit of 30 seconds: then open requests are ended cleanly and the
 *   service stops.
 * - Swiped away (onTaskRemoved): nothing is cancelled; the request finishes,
 *   is stored, and the service stops after.
 * - It never stops before it has called startForeground (stopping earlier
 *   crashes the app on Android 8+): RequestGuard only asks it to stop when idle.
 */
class SuloRequestService : Service() {
    private val main = Handler(Looper.getMainLooper())
    private val limit = Runnable {
        Diag.of(this).note("fgs_limit_reached")
        InFlight.cancelAll()
        stopNow()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        current = this
        try {
            showForeground()
        } catch (e: Exception) {
            // Not allowed now: the request still goes out; this service just ends.
            Diag.of(this).note("fgs_start_failed:${e.javaClass.simpleName}")
            stopSelf()
            return START_NOT_STICKY
        }
        main.removeCallbacks(limit)
        main.postDelayed(limit, RequestGuard.LIMIT_MS)
        // The last request may already be done (a very short one): stop now that it is shown.
        if (RequestGuard.shared(this).inFlight == 0) stopNow()
        return START_NOT_STICKY
    }

    /** Android 14+: the system's own end for a shortService (about 3 minutes; ours stops at 30 seconds). */
    override fun onTimeout(startId: Int) {
        Diag.of(this).note("fgs_system_timeout")
        InFlight.cancelAll()
        stopNow()
    }

    override fun onTaskRemoved(rootIntent: Intent?) {
        // Swiped away from Recents: let the request finish and be stored; the guard stops the service after.
        Diag.of(this).note("fgs_task_removed")
    }

    override fun onDestroy() {
        main.removeCallbacks(limit)
        if (current === this) current = null
        super.onDestroy()
    }

    private fun stopNow() {
        main.removeCallbacks(limit)
        if (Build.VERSION.SDK_INT >= 24) stopForeground(STOP_FOREGROUND_REMOVE) else @Suppress("DEPRECATION") stopForeground(true)
        stopSelf()
    }

    private fun showForeground() {
        val notification = notification(this)
        when {
            Build.VERSION.SDK_INT >= 34 -> startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_SHORT_SERVICE)
            Build.VERSION.SDK_INT >= 29 -> startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC)
            else -> startForeground(NOTIFICATION_ID, notification)
        }
    }

    /** Starts and stops the service for RequestGuard. */
    class Starter(private val context: Context) : RequestGuard.Service {
        override fun start() {
            ContextCompat.startForegroundService(context, Intent(context, SuloRequestService::class.java))
        }

        override fun stopWhenIdle() {
            // Not shown yet: onStartCommand stops it right after showing (it sees no request in flight).
            main().post { current?.let { if (RequestGuard.shared(it).inFlight == 0) it.stopNow() } }
        }

        private fun main() = Handler(Looper.getMainLooper())
    }

    companion object {
        const val CHANNEL = "sulo_updating"
        private const val NOTIFICATION_ID = 7301
        private const val LABELS = "sulo_labels"

        @Volatile private var current: SuloRequestService? = null

        /** The words come from the app (its language); these are only the first-run defaults. */
        fun setLabels(context: Context, text: String, channel: String) {
            context.getSharedPreferences(LABELS, Context.MODE_PRIVATE).edit().putString("text", text).putString("channel", channel).commit()
        }

        fun notification(context: Context): Notification {
            val labels = context.getSharedPreferences(LABELS, Context.MODE_PRIVATE)
            val text = labels.getString("text", null) ?: "Memperbarui dari SIKOLA"
            if (Build.VERSION.SDK_INT >= 26) {
                val nm = context.getSystemService(NotificationManager::class.java)
                val name = labels.getString("channel", null) ?: "Memperbarui"
                val channel = NotificationChannel(CHANNEL, name, NotificationManager.IMPORTANCE_LOW).apply {
                    setShowBadge(false)
                    enableVibration(false)
                    setSound(null, null)
                }
                nm.createNotificationChannel(channel)
            }
            return NotificationCompat.Builder(context, CHANNEL)
                .setSmallIcon(R.drawable.ic_stat_sulo)
                .setContentTitle(text)
                .setOngoing(true)
                .setSilent(true)
                .setShowWhen(false)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setCategory(NotificationCompat.CATEGORY_PROGRESS)
                // Android 12+: deferred about 10 seconds, so a short request never shows it.
                .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_DEFAULT)
                .build()
        }
    }
}
