package dev.ikrar.sulo.session

import android.content.Context

/**
 * Watches the cookie SIKOLA sets: a replaced MoodleSession is saved the
 * moment the headers arrive (before the body is read), atomically, as a
 * candidate; [settle] makes it the session's cookie only when the answer
 * shows a valid session, and drops it otherwise.
 * Counts what Set-Cookie said (absent, same, replaced, cleared), never the
 * value, for the session history. A cleared cookie is only noted: whether
 * the session ended is still decided by asking twice.
 */
class CookieKeeper(var session: SikolaSession, private val vault: SessionVault, private val stats: CookieStats?, private val diag: Diag?) : SikolaHttp.CookieWatch {
    private var candidate: String? = null

    /** The cookie set in this answer, not used yet (sign-in, before anything is in the vault). */
    fun pending(): String? = candidate

    /** After the answer: a valid session promotes the candidate cookie; anything else drops it. */
    fun settle(sessionValid: Boolean) {
        val c = candidate ?: return
        candidate = null
        if (sessionValid && vault.promoteCandidate()) session = session.copy(moodleSession = c) else vault.dropCandidate()
    }

    override fun seen(cookie: SikolaText.SessionCookie) {
        stats?.count(cookie)
        when (cookie) {
            is SikolaText.SessionCookie.Replaced -> {
                candidate = cookie.value
                vault.saveCandidate(cookie.value)
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

/** Debug builds: the NAMES of the response headers and Set-Cookie cookies seen from SIKOLA (never a value). */
object HeaderNames {
    fun record(context: Context, headers: List<String>, cookies: List<String>) {
        val prefs = context.applicationContext.getSharedPreferences("sulo_header_names", Context.MODE_PRIVATE)
        synchronized(this) {
            val h = (prefs.getStringSet("headers", emptySet()).orEmpty() + headers.map { it.lowercase() }).toSortedSet()
            val c = (prefs.getStringSet("cookies", emptySet()).orEmpty() + cookies).toSortedSet()
            prefs.edit().putStringSet("headers", h).putStringSet("cookies", c).commit()
        }
    }

    fun all(context: Context): String {
        val prefs = context.applicationContext.getSharedPreferences("sulo_header_names", Context.MODE_PRIVATE)
        return "headers: ${prefs.getStringSet("headers", emptySet()).orEmpty().sorted().joinToString(",")}; cookies: ${prefs.getStringSet("cookies", emptySet()).orEmpty().sorted().joinToString(",")}"
    }
}
