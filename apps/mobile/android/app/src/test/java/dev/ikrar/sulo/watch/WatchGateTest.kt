package dev.ikrar.sulo.watch

import android.content.SharedPreferences
import dev.ikrar.sulo.session.Crypto
import dev.ikrar.sulo.session.MemoryCrypto
import dev.ikrar.sulo.session.MemoryKey
import dev.ikrar.sulo.session.SikolaRequest
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class WatchGateTest {
    private val ready = WatchGate.Input(planPresent = true, planEnabled = true, userUnlocked = true, sessionStatus = "connected", appInForeground = false, hasSesskey = true, backingOff = false)

    @Test
    fun runsOnlyWhenEverythingHolds() = assertEquals(WatchGate.Action.RUN, WatchGate.decide(ready))

    @Test
    fun theChainStopsWhenWatchingIsOffOrSignedOut() {
        // Switch off, keep-alive config off or global config off: core writes enabled=false.
        assertEquals(WatchGate.Action.STOP, WatchGate.decide(ready.copy(planEnabled = false)))
        // Keluar removes the plan and the session.
        assertEquals(WatchGate.Action.STOP, WatchGate.decide(ready.copy(planPresent = false)))
        assertEquals(WatchGate.Action.STOP, WatchGate.decide(ready.copy(sessionStatus = "none")))
    }

    @Test
    fun anEndedSessionStopsWithTheNotice() = assertEquals(WatchGate.Action.EXPIRED, WatchGate.decide(ready.copy(sessionStatus = "expired")))

    @Test
    fun aPhoneNotUnlockedSinceBootWaitsQuietly() {
        assertEquals(WatchGate.Action.WAIT, WatchGate.decide(ready.copy(userUnlocked = false)))
        // Even with an ended session: nothing is read before the first unlock.
        assertEquals(WatchGate.Action.WAIT, WatchGate.decide(ready.copy(userUnlocked = false, sessionStatus = "expired")))
    }

    @Test
    fun waitsForTheAppTheSesskeyAndTheBackoff() {
        assertEquals(WatchGate.Action.WAIT, WatchGate.decide(ready.copy(appInForeground = true)))
        assertEquals(WatchGate.Action.WAIT, WatchGate.decide(ready.copy(hasSesskey = false)))
        assertEquals(WatchGate.Action.WAIT, WatchGate.decide(ready.copy(backingOff = true)))
    }

    @Test
    fun onlyTheWatchCheckKeepsTheSessionActive() {
        val fns = listOf("core_session_time_remaining", "core_calendar_get_action_events_by_timesort", "message_popup_get_popup_notifications")
        assertFalse(SikolaRequest.watchBatchUrl("Sk00000001", fns).contains("nosessionupdate"))
        // A plain, non-user request still leaves the session alone.
        assertTrue(SikolaRequest.batchUrl("Sk00000001", fns, userInitiated = false).endsWith("&nosessionupdate=true"))
    }
}

/** SharedPreferences in memory, for the store's tests. */
class MemoryPrefs : SharedPreferences {
    val map = linkedMapOf<String, Any?>()
    override fun getAll(): MutableMap<String, *> = map
    override fun getString(key: String, defValue: String?) = map[key] as String? ?: defValue
    override fun getStringSet(key: String, defValues: MutableSet<String>?) = defValues
    override fun getInt(key: String, defValue: Int) = map[key] as Int? ?: defValue
    override fun getLong(key: String, defValue: Long) = map[key] as Long? ?: defValue
    override fun getFloat(key: String, defValue: Float) = map[key] as Float? ?: defValue
    override fun getBoolean(key: String, defValue: Boolean) = map[key] as Boolean? ?: defValue
    override fun contains(key: String) = map.containsKey(key)
    override fun registerOnSharedPreferenceChangeListener(l: SharedPreferences.OnSharedPreferenceChangeListener?) = Unit
    override fun unregisterOnSharedPreferenceChangeListener(l: SharedPreferences.OnSharedPreferenceChangeListener?) = Unit
    override fun edit(): SharedPreferences.Editor = object : SharedPreferences.Editor {
        private val pending = linkedMapOf<String, Any?>()
        private var clear = false
        override fun putString(key: String, value: String?) = apply { pending[key] = value }
        override fun putStringSet(key: String, values: MutableSet<String>?) = apply { pending[key] = values }
        override fun putInt(key: String, value: Int) = apply { pending[key] = value }
        override fun putLong(key: String, value: Long) = apply { pending[key] = value }
        override fun putFloat(key: String, value: Float) = apply { pending[key] = value }
        override fun putBoolean(key: String, value: Boolean) = apply { pending[key] = value }
        override fun remove(key: String) = apply { pending[key] = REMOVED }
        override fun clear() = apply { clear = true }
        override fun commit(): Boolean {
            if (clear) map.clear()
            pending.forEach { (k, v) -> if (v === REMOVED || v == null) map.remove(k) else map[k] = v }
            return true
        }
        override fun apply() { commit() }
    }

    private companion object {
        val REMOVED = Any()
    }
}

class WatchStoreTest {
    private fun store(crypto: Crypto = MemoryCrypto().also { MemoryKey.key = null }) = MemoryPrefs().let { p -> Triple(WatchStore(p, MemoryPrefs(), crypto), p, crypto) }

    @Test
    fun theQueueKeepsTwentyAndAsksForAFullSync() {
        val (s, prefs, _) = store()
        repeat(23) { s.enqueue(JSONObject().put("ranAt", it).put("radarIds", org.json.JSONArray()).put("body", "[]")) }
        assertEquals(20, s.queueSize())
        // Stored encrypted: no answer body in the clear.
        assertFalse(prefs.map.values.any { it.toString().contains("\"ranAt\"") })
        val (answers, full) = s.takeQueue()
        assertEquals((3 until 23).toList(), answers.map { it.getInt("ranAt") })
        assertTrue(full)
        assertEquals(0, s.queueSize())
        assertFalse(s.takeQueue().second)
    }

    @Test
    fun anUnreadableAnswerIsDroppedAndAsksForAFullSync() {
        val (s, _, _) = store()
        s.enqueue(JSONObject().put("ranAt", 1).put("body", "[]"))
        // The key changed (session ended and its key was deleted).
        MemoryKey.key = null
        val (answers, full) = s.takeQueue()
        assertTrue(answers.isEmpty())
        assertTrue(full)
    }

    @Test
    fun anewPlanResetsWhatTheWorkerLearnedAndKeluarClearsEverything() {
        val (s, prefs, _) = store()
        s.setOverlay(JSONObject().put("eventIds", org.json.JSONArray(listOf(1))))
        s.setHeld(listOf(JSONObject().put("key", "task:1:added")))
        s.setPlan(JSONObject().put("enabled", true))
        assertEquals(0, s.overlay().getJSONArray("eventIds").length())
        assertTrue(s.held().isEmpty())
        s.recordTiming(JSONObject().put("ranAt", 5).put("ms", 900).put("bytes", 4000).put("outcome", "ok"))
        s.clear()
        // Only the generation is left (it moves on, so a running check cannot write back).
        assertEquals(setOf("generation"), prefs.map.keys)
    }
}

class WatchExpiryTest {
    @Test
    fun theGuardNeverRestartsAfterTheSessionEnded() {
        assertTrue(WatchGate.guardRestarts(planEnabled = true, sessionStatus = "connected", chainPending = false))
        assertFalse(WatchGate.guardRestarts(planEnabled = true, sessionStatus = "expired", chainPending = false))
        assertFalse(WatchGate.guardRestarts(planEnabled = true, sessionStatus = "none", chainPending = false))
        assertFalse(WatchGate.guardRestarts(planEnabled = false, sessionStatus = "connected", chainPending = false))
        assertFalse(WatchGate.guardRestarts(planEnabled = true, sessionStatus = "connected", chainPending = true))
    }

    @Test
    fun masukLagiOncePerEndedSessionUntilSignedIn() {
        val prefs = MemoryPrefs()
        val store = WatchStore(prefs, MemoryPrefs(), dev.ikrar.sulo.session.MemoryCrypto())
        assertTrue(WatchGate.mayNotifyExpired(store.expiredSent(), "expired"))
        store.setExpiredSent()
        // A second check, a guard run or a day later: still not again.
        assertFalse(WatchGate.mayNotifyExpired(store.expiredSent(), "expired"))
        // A plan written while watching is off (no session) keeps the mark.
        store.setPlan(JSONObject().put("enabled", false))
        assertFalse(WatchGate.mayNotifyExpired(store.expiredSent(), "expired"))
        // Signed in again: the app writes a plan in force; a later ended session may notify once more.
        store.setPlan(JSONObject().put("enabled", true))
        assertTrue(WatchGate.mayNotifyExpired(store.expiredSent(), "expired"))
        assertFalse(WatchGate.mayNotifyExpired(false, "connected"))
    }
}
