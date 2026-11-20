package dev.ikrar.sulo.watch

import android.content.Context

/**
 * The owner's one-off development exception (20 Nov 2026,
 * docs/ATURAN-REQUEST.md): in debug builds, on the day the app set the flag,
 * ONE background check started from the dev screen may go past today's
 * limit. Release builds never call it (BuildConfig.DEBUG).
 */
object TestBudget {
    private const val PREFS = "sulo_test_budget"

    fun set(context: Context, date: String) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString("date", date).putBoolean("workerUsed", false).commit()
    }

    fun available(context: Context, today: String): Boolean {
        val p = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        return p.getString("date", null) == today && !p.getBoolean("workerUsed", false)
    }

    /** Takes the one worker request; false when already used or not today. */
    @Synchronized
    fun take(context: Context, today: String): Boolean {
        if (!available(context, today)) return false
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putBoolean("workerUsed", true).commit()
        return true
    }
}
