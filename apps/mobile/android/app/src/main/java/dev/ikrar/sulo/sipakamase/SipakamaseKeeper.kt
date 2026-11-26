package dev.ikrar.sulo.sipakamase

import android.content.Context
import org.json.JSONObject

/**
 * Sipakamase's keeper in the background (1.1.0), riding the SIKOLA watch
 * check that already wakes the phone: no wake of its own. One GET to the
 * next of the five fragments when one is due (the app's plan says whether
 * anything is waited for, the worker's own config read says whether the
 * owner lets it keep), every 3 hours or slower, at most 10 a day counted
 * together with the app's own. The answer's cookie is saved; its page is
 * read only to tell a login page apart and then dropped: nothing of it is
 * kept (the app reads the fragments itself when it is opened).
 */
object SipakamaseKeepRules {
    const val DAILY_MAX = 10
    const val SLACK_SEC = 5 * 60L

    /** The app's part of the watch plan (core watch/plan.ts `sipakamase`); absent: nothing to keep. */
    data class PlanPart(val intervalMin: Int, val next: Int, val usedToday: Int, val date: String, val lastAutoAt: Long)

    /** okAt: the last read that came back signed in (200, not the login page), for the app's session log. */
    data class State(val lastAt: Long = 0, val date: String = "", val count: Int = 0, val next: Int = 0, val planNext: Int = -1, val loginAt: Long = 0, val okAt: Long = 0)

    fun parse(plan: JSONObject?): PlanPart? {
        val o = plan?.optJSONObject("sipakamase") ?: return null
        if (!o.optBoolean("keep", false)) return null
        val interval = o.optInt("intervalMin", 0)
        if (interval < 180) return null
        return PlanPart(interval, o.optInt("next", 0), o.optInt("usedToday", 0), o.optString("date", ""), o.optLong("lastAutoAt", 0))
    }

    /** The index into Sipakamase.READ_PATHS of the read due now, or null. */
    fun due(part: PlanPart?, configKeep: Boolean, state: State, now: Long, today: String): Int? {
        if (part == null || !configKeep) return null
        val used = (if (state.date == today) state.count else 0) + (if (part.date == today) part.usedToday else 0)
        if (used >= DAILY_MAX) return null
        val last = maxOf(state.lastAt, part.lastAutoAt)
        if (last > 0 && now - last < part.intervalMin * 60L - SLACK_SEC) return null
        val next = if (part.next != state.planNext) part.next else state.next
        return Math.floorMod(next, Sipakamase.READ_PATHS.size)
    }

    /** After a read was sent, whatever its answer. */
    fun afterRead(part: PlanPart, state: State, index: Int, now: Long, today: String, login: Boolean, ok: Boolean = false): State = state.copy(
        lastAt = now,
        date = today,
        count = (if (state.date == today) state.count else 0) + 1,
        next = index + 1,
        planNext = part.next,
        loginAt = if (login) now else state.loginAt,
        okAt = if (ok) now else state.okAt,
    )
}

class SipakamaseKeeper(private val context: Context) {
    private val prefs = context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    fun state(): SipakamaseKeepRules.State = SipakamaseKeepRules.State(
        prefs.getLong("lastAt", 0), prefs.getString("date", "") ?: "", prefs.getInt("count", 0), prefs.getInt("next", 0), prefs.getInt("planNext", -1), prefs.getLong("loginAt", 0), prefs.getLong("okAt", 0),
    )

    private fun save(s: SipakamaseKeepRules.State) {
        prefs.edit().putLong("lastAt", s.lastAt).putString("date", s.date).putInt("count", s.count).putInt("next", s.next).putInt("planNext", s.planNext).putLong("loginAt", s.loginAt).putLong("okAt", s.okAt).commit()
    }

    /** One keeper step; returns an outcome code for the session history (never content). */
    fun step(plan: JSONObject?, configKeep: Boolean, now: Long, today: String, userAgent: String): String {
        val part = SipakamaseKeepRules.parse(plan)
        val state = state()
        val index = SipakamaseKeepRules.due(part, configKeep, state, now, today) ?: return "not_due"
        val vault = SipakamaseVault.session(context)
        val session = vault.load() ?: return "no_session"
        val path = Sipakamase.READ_PATHS[index]
        val reply = try {
            SipakamaseHttp(userAgent).get(path, session.moodleSession) { fresh -> vault.save(dev.ikrar.sulo.session.SikolaSession(fresh, null), note = false) }
        } catch (e: Exception) {
            save(SipakamaseKeepRules.afterRead(part!!, state, index, now, today, login = false))
            return "network"
        }
        val login = reply.status in 300..399 || reply.status == 401 || reply.status == 403 || (reply.status == 200 && Sipakamase.isLoginPage(reply.body))
        val ok = reply.status == 200 && !login
        save(SipakamaseKeepRules.afterRead(part!!, state, index, now, today, login, ok))
        return if (login) "login" else if (ok) "ok" else "status_${reply.status}"
    }

    fun clear() {
        prefs.edit().clear().commit()
    }

    companion object {
        const val PREFS = "sulo_sipakamase_keep"
    }
}
