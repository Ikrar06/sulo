package dev.ikrar.sulo.watch

import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import dev.ikrar.sulo.MainActivity
import dev.ikrar.sulo.notify.NotifyChannels
import org.json.JSONObject

/**
 * Shows the worker's notices. Titles and bodies come from the plan's
 * templates (core); this only posts them. A tap opens the app, which reads
 * the notice id (WatchStore.takePendingOpen) and opens the task or Kabar
 * terbaru, the same ids as core's own notifications (reminders/run.ts).
 *
 * The channel comes from the plan's channel plan (core notify/channels.ts),
 * the same one the app's own notifications use: news on the channel with
 * the chosen sound, the sign-in and paused notices on their silent ones.
 */
object WatchNotifier {
    const val EXTRA_OPEN = "dev.ikrar.sulo.watch.OPEN"

    fun show(context: Context, plan: JSONObject, notice: WatchCheck.Notice) {
        val manager = NotificationManagerCompat.from(context)
        if (!manager.areNotificationsEnabled()) return
        val channel = channelFor(context, plan, notice.id)
        val open = Intent(context, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP).putExtra(EXTRA_OPEN, notice.id)
        val tap = PendingIntent.getActivity(context, notice.numericId, open, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val notification = NotificationCompat.Builder(context, channel)
            // The mascot's silhouette, one colour (a full-colour app icon shows as a blank shape in the status bar).
            .setSmallIcon(dev.ikrar.sulo.R.drawable.ic_stat_sulo)
            .setContentTitle(notice.title)
            .apply { if (notice.body.isNotEmpty()) setContentText(notice.body).setStyle(NotificationCompat.BigTextStyle().bigText(notice.body)) }
            .setContentIntent(tap)
            .setAutoCancel(true)
            .setOnlyAlertOnce(true)
            .build()
        runCatching { manager.notify(notice.numericId, notification) }
    }

    /** The plan's channel for this notice, made sure to exist. A plan from before the channel plan keeps the old single channel until the app writes a new one. */
    private fun channelFor(context: Context, plan: JSONObject, noticeId: String): String {
        val channels = plan.optJSONObject("channels")
        val id = channels?.let { NotifyChannels.channelFor(it, noticeId) }
        if (channels != null && id != null) {
            NotifyChannels.apply(context, channels)
            return id
        }
        return NotifyChannels.oldWatchChannel(context, plan.optJSONObject("templates")?.optString("channel", "Sulo") ?: "Sulo")
    }
}
