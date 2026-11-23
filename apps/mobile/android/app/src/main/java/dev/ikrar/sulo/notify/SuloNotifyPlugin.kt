package dev.ikrar.sulo.notify

import android.app.NotificationManager
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import org.json.JSONObject

/**
 * The app's way to the notification channels (src/notify-sound.ts): it
 * hands over core's channel plan, and NotifyChannels does the rest. No
 * permission is declared or asked here: making a channel needs none.
 */
@CapacitorPlugin(name = "SuloNotify")
class SuloNotifyPlugin : Plugin() {
    /** { plan: string } (core ChannelPlan as JSON) -> { created: string[], removed: string[], channels: string[] } */
    @PluginMethod
    fun applyChannels(call: PluginCall) {
        val text = call.getString("plan") ?: return call.reject("plan missing")
        val plan = runCatching { JSONObject(text) }.getOrNull() ?: return call.reject("plan unreadable")
        val done = NotifyChannels.apply(context, plan)
        val now = context.getSystemService(NotificationManager::class.java)?.notificationChannels?.map { it.id }?.sorted() ?: emptyList()
        call.resolve(
            JSObject()
                .put("created", JSArray(done.create.map { it.optString("id") }))
                .put("removed", JSArray(done.remove))
                .put("channels", JSArray(now)),
        )
    }
}
