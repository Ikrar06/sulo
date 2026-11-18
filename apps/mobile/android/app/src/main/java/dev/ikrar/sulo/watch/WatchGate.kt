package dev.ikrar.sulo.watch

/**
 * Whether a background check may send anything now. Pure, so every stop is
 * tested. Order: no plan or switched off (the user, the keep-alive config,
 * the global config) stops the chain; a phone not unlocked since boot
 * waits quietly; no session stops it, an ended one stops it with the calm
 * notice; the app in the foreground does its own syncs; without a sesskey
 * only the user's next sync can get one; a backoff waits.
 */
object WatchGate {
    enum class Action { STOP, WAIT, EXPIRED, RUN }

    data class Input(
        val planPresent: Boolean,
        val planEnabled: Boolean,
        val userUnlocked: Boolean,
        val sessionStatus: String,
        val appInForeground: Boolean,
        val hasSesskey: Boolean,
        val backingOff: Boolean,
    )

    fun decide(i: Input): Action = when {
        !i.planPresent || !i.planEnabled -> Action.STOP
        !i.userUnlocked -> Action.WAIT
        i.sessionStatus == "expired" -> Action.EXPIRED
        i.sessionStatus != "connected" -> Action.STOP
        i.appInForeground -> Action.WAIT
        !i.hasSesskey -> Action.WAIT
        i.backingOff -> Action.WAIT
        else -> Action.RUN
    }

    /** The 6-hour guard restarts a missing chain only while watching is on and the session is connected (never after it ended). */
    fun guardRestarts(planEnabled: Boolean, sessionStatus: String, chainPending: Boolean): Boolean = planEnabled && sessionStatus == "connected" && !chainPending

    /** "Masuk lagi": once per ended session; the mark clears when a new plan with a connected session arrives (after sign-in). */
    fun mayNotifyExpired(alreadySent: Boolean, sessionStatus: String): Boolean = !alreadySent && sessionStatus == "expired"
}
