package dev.ikrar.sulo.session

import dev.ikrar.sulo.watch.MemoryPrefs
import dev.ikrar.sulo.watch.WatchStore
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import kotlin.concurrent.thread

/** SIKOLA's cookies as a map, cleared on request like CookieManager. */
class MemoryCookies : CookieJar {
    val cookies = mutableMapOf("MoodleSession" to "new-account")
    var clears = 0
    override fun clearAll(done: () -> Unit) {
        cookies.clear()
        clears++
        done()
    }
}

class AccountResetTest {
    private lateinit var slots: MemorySlots
    private lateinit var vault: SessionVault
    private lateinit var watchPrefs: MemoryPrefs
    private lateinit var store: WatchStore
    private lateinit var cookies: MemoryCookies
    private var chainStops = 0
    private lateinit var reset: AccountReset

    @Before
    fun setUp() {
        MemoryKey.key = null
        slots = MemorySlots()
        vault = SessionVault(slots, MemoryCrypto())
        vault.save(SikolaSession("cookie-of-the-new-account", "Sk00000009"))
        watchPrefs = MemoryPrefs()
        store = WatchStore(watchPrefs, MemoryPrefs(), MemoryCrypto())
        store.setPlan(JSONObject().put("enabled", true).put("userId", 7))
        store.enqueue(JSONObject().put("ranAt", 1).put("radarIds", JSONArray()).put("body", "[]"))
        store.setHeld(listOf(JSONObject().put("key", "task:1:added")))
        store.recordTiming(JSONObject().put("ranAt", 1).put("ms", 900).put("bytes", 4000).put("outcome", "ok"))
        cookies = MemoryCookies()
        chainStops = 0
        reset = AccountReset(vault, store, cookies) { chainStops++ }
    }

    private fun discard(): String {
        var status = ""
        reset.discardSession { status = it }
        return status
    }

    @Test
    fun batalLeavesNoCookieNoSessionNoKey() {
        assertEquals("expired", discard())
        assertTrue(cookies.cookies.isEmpty())
        assertNull(vault.load())
        assertNull(MemoryKey.key)
        // Nothing of the session is left in the slots, only the "expired" state.
        assertFalse(slots.map.values.any { it.contains("cookie") || it.startsWith("v1:") })
        assertEquals("expired", vault.status())
    }

    @Test
    fun batalTwiceIsSafe() {
        discard()
        assertEquals("expired", discard())
        assertEquals(2, cookies.clears)
        assertNull(vault.load())
    }

    @Test
    fun pakaiAkunIniLeavesNoPlanNoQueueNoHeldNoTimings() {
        reset.watchReset()
        assertEquals(1, chainStops)
        assertNull(store.plan())
        assertEquals(0, store.queueSize())
        assertTrue(store.held().isEmpty())
        assertEquals(0, store.timings().length())
        assertTrue(store.takeQueue().first.isEmpty())
        // The session itself stays: the new account goes on.
        assertEquals("connected", vault.status())
    }

    @Test
    fun pakaiAkunIniTwiceIsSafe() {
        reset.watchReset()
        reset.watchReset()
        assertEquals(2, chainStops)
        assertNull(store.plan())
        assertEquals(0, store.queueSize())
    }

    @Test
    fun aCheckStillRunningCannotWriteAfterTheReset() {
        // The worker read the generation at its start, then the user answered.
        val gen = store.generation()
        reset.watchReset()
        store.enqueue(JSONObject().put("ranAt", 2).put("radarIds", JSONArray()).put("body", "[]"), gen)
        store.setOverlay(JSONObject().put("eventIds", JSONArray(listOf(1))), gen)
        store.setHeld(listOf(JSONObject().put("key", "task:2:added")), gen)
        assertEquals(0, store.queueSize())
        assertEquals(0, store.overlay().getJSONArray("eventIds").length())
        assertTrue(store.held().isEmpty())
        // A check that starts after the reset writes as usual.
        store.enqueue(JSONObject().put("ranAt", 3).put("radarIds", JSONArray()).put("body", "[]"), store.generation())
        assertEquals(1, store.queueSize())
    }

    @Test
    fun resetsRacingAWorkerThreadLeaveNothingFromBefore() {
        val gen = store.generation()
        val start = CountDownLatch(1)
        val worker = thread {
            start.await()
            repeat(200) { store.enqueue(JSONObject().put("ranAt", 10 + it).put("radarIds", JSONArray()).put("body", "[]"), gen) }
        }
        start.countDown()
        reset.watchReset()
        worker.join(TimeUnit.SECONDS.toMillis(10))
        // Whatever the worker wrote before the reset is gone with it; nothing it wrote after got in.
        reset.watchReset()
        repeat(5) { store.enqueue(JSONObject().put("ranAt", 999).put("radarIds", JSONArray()).put("body", "[]"), gen) }
        assertEquals(0, store.queueSize())
        assertNull(store.plan())
    }
}
