package dev.ikrar.sulo.store

import android.content.Context
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

/**
 * Writes for the app's data store (src/platform/store.ts) that are on disk
 * before they count as done. @capacitor/preferences writes with apply():
 * the write reaches disk later, and a process ended in between (swiped
 * away, killed) loses it. Here the same SharedPreferences file
 * ("CapacitorStorage", so nothing moves) is written with commit(), which
 * Android does through a backup file, fsync and rename: whole or not at all.
 * Reads stay with @capacitor/preferences (same file, same in-memory copy).
 */
@CapacitorPlugin(name = "SuloStore")
class SuloStorePlugin : Plugin() {
    private fun prefs() = context.getSharedPreferences(FILE, Context.MODE_PRIVATE)

    @PluginMethod
    fun set(call: PluginCall) {
        val key = call.getString("key") ?: return call.reject("key missing")
        val value = call.getString("value") ?: return call.reject("value missing")
        if (!key.startsWith(PREFIX)) return call.reject("not ours")
        if (prefs().edit().putString(key, value).commit()) call.resolve() else call.reject("not written")
    }

    @PluginMethod
    fun remove(call: PluginCall) {
        val key = call.getString("key") ?: return call.reject("key missing")
        if (!key.startsWith(PREFIX)) return call.reject("not ours")
        if (prefs().edit().remove(key).commit()) call.resolve() else call.reject("not written")
    }

    private companion object {
        /** @capacitor/preferences' default group. */
        const val FILE = "CapacitorStorage"
        const val PREFIX = "sulo:"
    }
}
