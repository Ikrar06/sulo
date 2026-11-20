package dev.ikrar.sulo.session

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class CookieKeeperTest {
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
        // Never on disk in clear.
        assertFalse(slots.map.values.any { it.contains("cookie-value-999") })
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
