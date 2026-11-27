package dev.ikrar.sulo.calendar

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Test

/** The same cases as the iPhone's (ios/SuloTests/main.swift, CalendarEventInput). */
class CalendarEventTest {
    private val taskUrl = "https://sikola-v2.unhas.ac.id/mod/assign/view.php?id=123"

    @Test
    fun acceptsATaskAndKeepsItsLink() {
        val e = CalendarEvent.from("Laporan (Mekanika Fluida)", 1_800_000_000.0 - 1800, 1_800_000_000.0, "Tugas Mekanika Fluida di SIKOLA.\n$taskUrl", taskUrl)
        assertNotNull(e)
        assertEquals(taskUrl, e!!.url)
        assertEquals(1_800_000_000_000L, e.endMs)
    }

    @Test
    fun refusesWhatIsNotAnEvent() {
        assertNull(CalendarEvent.from("  ", 1.0, 2.0, "", null))
        assertNull(CalendarEvent.from("a", 10.0, 5.0, "", null))
        assertNull(CalendarEvent.from("a", 10.0, 10.0 + 2 * 86_400, "", null))
        assertNull(CalendarEvent.from("a", null, 5.0, "", null))
        assertNull(CalendarEvent.from("x".repeat(401), 1.0, 2.0, "", null))
    }

    @Test
    fun keepsOnlyATaskPageOnSikola() {
        assertNull(CalendarEvent.taskLink("$taskUrl&sesskey=abc"))
        assertNull(CalendarEvent.taskLink("http://sikola-v2.unhas.ac.id/mod/assign/view.php?id=1"))
        assertNull(CalendarEvent.taskLink("https://evil.test/mod/assign/view.php?id=1"))
        assertNull(CalendarEvent.taskLink("https://sikola-v2.unhas.ac.id/login/index.php?id=1"))
        assertNull(CalendarEvent.from("a", 1.0, 2.0, "", "javascript:alert(1)")!!.url)
    }
}
