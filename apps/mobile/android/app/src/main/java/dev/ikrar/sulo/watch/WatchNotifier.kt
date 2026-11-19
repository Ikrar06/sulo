package dev.ikrar.sulo.watch

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import dev.ikrar.sulo.MainActivity

/**
 * Shows the worker's notices. Titles and bodies come from the plan's
 * templates (core); this only posts them. A tap opens the app, which reads
 * the notice id (WatchStore.takePendingOpen) and opens the task or Kabar
 * terbaru, the same ids as core's own notifications (reminders/run.ts).
 */
object WatchNotifier {
    const val CHANNEL = "sulo_kabar"
    const val EXTRA_OPEN = "dev.ikrar.sulo.watch.OPEN"

    fun show(context: Context, channelName: String, notice: WatchCheck.Notice) {
        val manager = NotificationManagerCompat.from(context)
        if (!manager.areNotificationsEnabled()) return
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val system = context.getSystemService(NotificationManager::class.java)
            if (system?.getNotificationChannel(CHANNEL) == null) system?.createNotificationChannel(NotificationChannel(CHANNEL, channelName, NotificationManager.IMPORTANCE_DEFAULT))
        }
        val open = Intent(context, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP).putExtra(EXTRA_OPEN, notice.id)
        val tap = PendingIntent.getActivity(context, notice.numericId, open, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val notification = NotificationCompat.Builder(context, CHANNEL)
            .setSmallIcon(context.applicationInfo.icon)
            .setContentTitle(notice.title)
            .apply { if (notice.body.isNotEmpty()) setContentText(notice.body).setStyle(NotificationCompat.BigTextStyle().bigText(notice.body)) }
            .setContentIntent(tap)
            .setAutoCancel(true)
            .setOnlyAlertOnce(true)
            .build()
        runCatching { manager.notify(notice.numericId, notification) }
    }
}
