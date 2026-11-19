package dev.ikrar.sulo.session

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

/**
 * What happened to the session on this phone, for diagnosing (M8d): the time
 * and a short event code only ("vault_saved", "vault_expired:watch_login",
 * "app_start"). Never a cookie, a sesskey, a token or anything SIKOLA or
 * NEOSIA sent. The last 60 events, in app-private storage, cleared on Keluar
 * with the rest of the app's data. Shown on the hidden dev screen.
 */
class Diag(private val slots: Slots, private val now: () -> Long = { System.currentTimeMillis() / 1000 }) {
    fun note(event: String) = synchronized(LOCK) {
        val safe = event.replace(Regex("[^A-Za-z0-9_:.>+-]"), "").take(80)
        val list = entries().put(JSONObject().put("at", now()).put("e", safe))
        val trimmed = JSONArray()
        for (i in maxOf(0, list.length() - MAX) until list.length()) trimmed.put(list.get(i))
        slots.put(KEY, trimmed.toString())
    }

    /** One code from the app (SuloSession.note): kept only when it is a code already. */
    fun noteFromApp(event: String) {
        if (Regex("^[a-z0-9_:.>+-]{1,80}$").matches(event)) note("app:$event")
    }

    fun clear() = synchronized(LOCK) { slots.clear() }

    fun entries(): JSONArray = slots.get(KEY)?.let { runCatching { JSONArray(it) }.getOrNull() } ?: JSONArray()

    companion object {
        const val PREFS = "sulo_diag"
        private const val KEY = "events"
        const val MAX = 120
        /** Every Diag of the process shares it (Diag.of makes a new one each time). */
        private val LOCK = Any()

        fun of(context: Context): Diag = Diag(PrefsSlots(context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)))
    }
}
