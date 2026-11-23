package dev.ikrar.sulo.notify

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.ContentResolver
import android.content.Context
import android.media.AudioAttributes
import android.net.Uri
import dev.ikrar.sulo.R
import org.json.JSONObject

/**
 * The app's notification channels: the only code that creates or removes
 * one. What should exist comes as a plan from core (notify/channels.ts):
 * from the app through SuloNotifyPlugin, and to the background worker
 * inside the watch plan, so both follow one choice of sound.
 *
 * A channel's sound cannot be changed once it exists, so the chosen sound
 * is part of the channel's id (core). Another sound means new channels and
 * the old ones removed: one channel per kind, always.
 *
 * Creating or removing a channel asks the user nothing: the notification
 * permission is asked in one place only, the onboarding's reminders step.
 *
 * kindOf and changes are the same rules as core's channelKindOf and
 * channelChanges, tested on the same vectors (notify/channel-vectors.json).
 */
object NotifyChannels {
    /** Every channel whose id begins like this is Sulo's own. */
    const val PREFIX = "sulo_"

    /** Channels of earlier versions that are not Sulo's by prefix: the local notifications plugin's catch-all. */
    val LEGACY = listOf("default")

    data class Changes(val create: List<JSONObject>, val remove: List<String>)

    /** Which kind a notification is, from its id (core reminders/run.ts, and the worker's own ids). */
    fun kindOf(notificationId: String): String = when (notificationId.substringBefore('|')) {
        "changes", "changes_summary" -> "news"
        "morning" -> "morning"
        "session" -> "session"
        "watch" -> "paused"
        "release" -> "release"
        else -> "due"
    }

    /** The channel a notification goes to under a plan, or null when the plan does not say. */
    fun channelFor(plan: JSONObject, notificationId: String): String? =
        plan.optJSONObject("byKind")?.optString(kindOf(notificationId), "")?.takeIf { it.isNotEmpty() }

    /** What to do on a phone that has `existing` channels: make what is missing, remove every other channel of Sulo's. */
    fun changes(existing: List<String>, plan: JSONObject): Changes {
        val specs = plan.optJSONArray("channels")?.let { a -> (0 until a.length()).mapNotNull { a.optJSONObject(it) } } ?: emptyList()
        val wanted = specs.map { it.optString("id") }.toSet()
        val have = existing.toSet()
        return Changes(
            create = specs.filter { it.optString("id") !in have },
            remove = have.filter { it !in wanted && (it.startsWith(PREFIX) || it in LEGACY) }.sorted(),
        )
    }

    /** Brings the phone's channels to the plan. Safe to call any number of times. Returns what it changed. */
    fun apply(context: Context, plan: JSONObject): Changes {
        val manager = context.getSystemService(NotificationManager::class.java) ?: return Changes(emptyList(), emptyList())
        val todo = changes(manager.notificationChannels.map { it.id }, plan)
        // New ones first: there is never a moment with no channel for a kind.
        todo.create.forEach { manager.createNotificationChannel(channel(context, it)) }
        todo.remove.forEach { manager.deleteNotificationChannel(it) }
        // A channel that stays may have a new name (the app's language changed). Android lets a name change, nothing else.
        plan.optJSONArray("channels")?.let { a ->
            (0 until a.length()).mapNotNull { a.optJSONObject(it) }.forEach { spec ->
                val there = manager.getNotificationChannel(spec.optString("id")) ?: return@forEach
                if (there.name?.toString() != spec.optString("name")) manager.createNotificationChannel(channel(context, spec))
            }
        }
        return todo
    }

    /**
     * The worker's single channel of earlier versions, for a watch plan
     * written before the channel plan existed (the app was updated and has
     * not been opened yet). The next plan the app writes removes it.
     */
    fun oldWatchChannel(context: Context, name: String): String {
        val manager = context.getSystemService(NotificationManager::class.java)
        if (manager?.getNotificationChannel(OLD_WATCH_CHANNEL) == null) manager?.createNotificationChannel(NotificationChannel(OLD_WATCH_CHANNEL, name, NotificationManager.IMPORTANCE_DEFAULT))
        return OLD_WATCH_CHANNEL
    }

    const val OLD_WATCH_CHANNEL = "sulo_kabar"

    private fun channel(context: Context, spec: JSONObject): NotificationChannel {
        val quiet = spec.optString("importance") == "low"
        val channel = NotificationChannel(spec.getString("id"), spec.optString("name", "Sulo"), if (quiet) NotificationManager.IMPORTANCE_LOW else NotificationManager.IMPORTANCE_DEFAULT)
        val sound = if (spec.isNull("sound")) null else spec.optString("sound")
        when {
            // No sound: said outright, so the channel shows "silent" in the phone's settings.
            sound.isNullOrEmpty() -> channel.setSound(null, null)
            // The phone's own notification sound: what a new channel has by itself.
            sound == "default" -> Unit
            // By name, not by number: a channel keeps its sound for good, and a resource's number may differ in the next build.
            else -> if (rawSound(sound) != null) {
                val attributes = AudioAttributes.Builder().setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).setUsage(AudioAttributes.USAGE_NOTIFICATION).build()
                channel.setSound(Uri.parse("${ContentResolver.SCHEME_ANDROID_RESOURCE}://${context.packageName}/raw/$sound"), attributes)
            }
        }
        return channel
    }

    /**
     * The sounds in res/raw (apps/mobile/scripts/build-sounds.mjs), by name.
     * Named through R (and res/raw/keep.xml) so the release build's resource
     * shrinker keeps them. An unknown name falls back to the phone's own sound.
     */
    private fun rawSound(name: String): Int? = when (name) {
        "sulo_notif_1" -> R.raw.sulo_notif_1
        "sulo_notif_2" -> R.raw.sulo_notif_2
        "sulo_notif_3" -> R.raw.sulo_notif_3
        "sulo_notif_4" -> R.raw.sulo_notif_4
        else -> null
    }
}
