package dev.ikrar.sulo.session

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class RequestGuardTest {
    private class FakeService(var refuse: Boolean = false) : RequestGuard.Service {
        val calls = mutableListOf<String>()
        override fun start() {
            calls.add("start")
            if (refuse) throw IllegalStateException("ForegroundServiceStartNotAllowed")
        }
        override fun stopWhenIdle() { calls.add("stop") }
    }

    private var t = 1_000_000L
    private fun guard(service: FakeService, marker: MemorySlots = MemorySlots(), left: MutableList<Long> = mutableListOf()) =
        RequestGuard(service, marker, now = { t }, onLeftover = { left.add(it) })

    @Test
    fun theServiceRunsOnlyAroundARequest() {
        val service = FakeService()
        val marker = MemorySlots()
        val g = guard(service, marker)
        g.begin("batch")
        assertEquals(listOf("start"), service.calls)
        assertTrue(marker.map.containsKey("at"))
        t += 1_800
        assertEquals(1_800L, g.end())
        assertEquals(listOf("start", "stop"), service.calls)
        assertTrue(marker.map.isEmpty())
        assertEquals(0, g.inFlight)
    }

    @Test
    fun requestsThatOverlapShareOneService() {
        val service = FakeService()
        val g = guard(service)
        g.begin("batch")
        g.begin("page")
        assertEquals(0L, g.end())
        assertEquals(listOf("start"), service.calls)
        t += 500
        assertEquals(500L, g.end())
        assertEquals(listOf("start", "stop"), service.calls)
    }

    @Test
    fun aRefusedStartStillLetsTheRequestGo() {
        val service = FakeService(refuse = true)
        val marker = MemorySlots()
        val g = guard(service, marker)
        g.begin("watch")
        // The marker is there all the same: an interrupted request is still known.
        assertTrue(marker.map.containsKey("at"))
        assertEquals(1, g.inFlight)
        g.end()
        assertEquals(0, g.inFlight)
    }

    @Test
    fun aMarkerLeftByAnEndedProcessIsReportedOnce() {
        val marker = MemorySlots().apply { map["at"] = "1795125000"; map["where"] = "batch" }
        val left = mutableListOf<Long>()
        val g = guard(FakeService(), marker, left)
        g.begin("batch")
        assertEquals(listOf(1_795_125_000L), left)
        g.end()
        // A new process (a new guard) finds nothing: the request above ended normally.
        val next = mutableListOf<Long>()
        assertNull(guard(FakeService(), marker, next).adoptLeftover())
        assertTrue(next.isEmpty())
    }

    @Test
    fun theLimitIsThirtySeconds() {
        assertEquals(30_000L, RequestGuard.LIMIT_MS)
    }

    @Test
    fun endingWithNothingInFlightIsHarmless() {
        val service = FakeService()
        val g = guard(service)
        assertEquals(0L, g.end())
        assertFalse(service.calls.contains("stop"))
    }

    @Test
    fun anInterruptedSessionSaysSoWhenItEnds() {
        MemoryKey.key = null
        val slots = MemorySlots()
        val vault = SessionVault(slots, MemoryCrypto(), pause = {})
        vault.save(SikolaSession("cookie-value-123", "Sesskey0001"))
        vault.noteInterrupted(1_795_125_000L)
        vault.markExpired("confirmed:session:servicerequireslogin+session:servicerequireslogin")
        assertEquals("interrupted", vault.endedBy())
        // A fresh sign-in starts clean; a later end without a cut-off request is the usual one.
        vault.save(SikolaSession("cookie-value-456", "Sesskey0002"))
        assertNull(vault.endedBy())
        vault.markExpired("confirmed:x")
        assertNull(vault.endedBy())
    }

    @Test
    fun setCookieIsReadWithoutKeepingItsValueAnywhereElse() {
        val sent = "abc123"
        assertEquals(SikolaText.SessionCookie.Absent, SikolaText.sessionCookie(null, sent))
        assertEquals(SikolaText.SessionCookie.Absent, SikolaText.sessionCookie(listOf("other=1; path=/"), sent))
        assertEquals(SikolaText.SessionCookie.Same, SikolaText.sessionCookie(listOf("MoodleSession=abc123; path=/; secure"), sent))
        assertEquals(SikolaText.SessionCookie.Replaced("zzz999"), SikolaText.sessionCookie(listOf("MoodleSession=zzz999; path=/; secure"), sent))
        assertEquals(SikolaText.SessionCookie.Cleared, SikolaText.sessionCookie(listOf("MoodleSession=deleted; expires=Thu, 01 Jan 1970 00:00:01 GMT"), sent))
        assertEquals(SikolaText.SessionCookie.Cleared, SikolaText.sessionCookie(listOf("MoodleSession=x; Max-Age=0"), sent))
    }

    @Test
    fun aReplacedCookieIsKeptAtOnceButUsedOnlyWithAValidSession() {
        MemoryKey.key = null
        val slots = MemorySlots()
        val vault = SessionVault(slots, MemoryCrypto(), pause = {})
        val session = SikolaSession("cookie-value-123", "Sesskey0001")
        vault.save(session)
        // A valid answer that set a new cookie: it becomes the session's.
        val ok = CookieKeeper(session, vault, null, null)
        ok.seen(SikolaText.SessionCookie.Replaced("cookie-value-999"))
        assertTrue(slots.map.containsKey("candidateCookie"))
        ok.settle(sessionValid = true)
        assertEquals(SikolaSession("cookie-value-999", "Sesskey0001"), vault.load())
        assertFalse(slots.map.containsKey("candidateCookie"))
        // A "log in" answer with a new (guest) cookie: dropped, the signed-in cookie stays (emulator, 20 Nov 2026).
        val guest = CookieKeeper(vault.load()!!, vault, null, null)
        guest.seen(SikolaText.SessionCookie.Replaced("guest-cookie"))
        guest.settle(sessionValid = false)
        assertEquals(SikolaSession("cookie-value-999", "Sesskey0001"), vault.load())
        assertFalse(slots.map.containsKey("candidateCookie"))
        // Cleared is only noted: whether the session ended is still decided by asking twice.
        guest.seen(SikolaText.SessionCookie.Cleared)
        assertEquals("connected", vault.status())
    }
}
