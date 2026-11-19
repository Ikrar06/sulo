package dev.ikrar.sulo.session

import android.content.Context

/**
 * Keeps the vault on the cookie SIKOLA last set: a replaced MoodleSession is
 * saved the moment the headers arrive (before the body is read), atomically.
 * Counts what Set-Cookie said (absent, same, replaced, cleared), never the
 * value, for the session history. A cleared cookie is only noted: whether
 * the session ended is still decided by asking twice.
 */
class CookieKeeper(var session: SikolaSession, private val vault: SessionVault, private val stats: CookieStats?, private val diag: Diag?) : SikolaHttp.CookieWatch {
    override fun seen(cookie: SikolaText.SessionCookie) {
        stats?.count(cookie)
        when (cookie) {
            is SikolaText.SessionCookie.Replaced -> {
                session = session.copy(moodleSession = cookie.value)
                vault.save(session, note = false)
                diag?.note("sikola_cookie_replaced")
            }
            SikolaText.SessionCookie.Cleared -> diag?.note("sikola_cookie_cleared")
            else -> Unit
        }
    }
}

/** How often SIKOLA's answers carried a MoodleSession Set-Cookie (counts only). */
class CookieStats(private val slots: Slots) {
    fun count(cookie: SikolaText.SessionCookie) = synchronized(LOCK) {
        val key = when (cookie) {
            SikolaText.SessionCookie.Absent -> "absent"
            SikolaText.SessionCookie.Same -> "same"
            SikolaText.SessionCookie.Cleared -> "cleared"
            is SikolaText.SessionCookie.Replaced -> "replaced"
        }
        val all = slots.all().orEmpty()
        slots.putAll(mapOf(key to ((all[key]?.toIntOrNull() ?: 0) + 1).toString()))
    }

    fun summary(): Map<String, String> = slots.all().orEmpty()

    companion object {
        private val LOCK = Any()
        fun of(context: Context) = CookieStats(PrefsSlots(context.applicationContext.getSharedPreferences("sulo_cookie_stats", Context.MODE_PRIVATE)))
    }
}

/** How long the request service lived per guarded stretch (ms), the last 50. */
object GuardTimes {
    fun record(context: Context, ms: Long) {
        if (ms <= 0) return
        val prefs = context.applicationContext.getSharedPreferences("sulo_guard_times", Context.MODE_PRIVATE)
        synchronized(this) {
            val list = (prefs.getString("ms", "") ?: "").split(',').filter { it.isNotEmpty() }.takeLast(49) + ms.toString()
            prefs.edit().putString("ms", list.joinToString(",")).commit()
        }
    }

    fun all(context: Context): String = context.applicationContext.getSharedPreferences("sulo_guard_times", Context.MODE_PRIVATE).getString("ms", "") ?: ""
}
