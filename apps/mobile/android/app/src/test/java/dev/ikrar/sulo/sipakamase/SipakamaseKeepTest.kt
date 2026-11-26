package dev.ikrar.sulo.sipakamase

import dev.ikrar.sulo.sipakamase.SipakamaseKeepRules.State
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class SipakamaseKeepTest {
    private val R = SipakamaseKeepRules
    private fun plan(intervalMin: Int = 180, next: Int = 0, used: Int = 0, date: String = "d", last: Long = 0) =
        JSONObject().put("sipakamase", JSONObject().put("keep", true).put("intervalMin", intervalMin).put("next", next).put("usedToday", used).put("date", date).put("lastAutoAt", last))

    @Test
    fun nothingWithoutThePlansPartOrWhenTheOwnerStoppedIt() {
        assertNull(R.due(R.parse(JSONObject()), true, State(), 1000, "d"))
        assertNull(R.due(R.parse(plan()), false, State(), 1000, "d"))
        // Never faster than 3 hours, whatever the plan says.
        assertNull(R.parse(plan(intervalMin = 60)))
    }

    @Test
    fun everyThreeHoursFromTheLastReadEitherSide() {
        val p = R.parse(plan(last = 10_000))
        assertNull(R.due(p, true, State(), 10_000 + 2 * 3600, "d"))
        assertEquals(0, R.due(p, true, State(), 10_000 + 3 * 3600 - 60, "d"))
        assertNull(R.due(p, true, State(lastAt = 20_000), 10_000 + 3 * 3600, "d"))
    }

    @Test
    fun rotatesAndStopsAtTenADayCountedWithTheApp() {
        val p = R.parse(plan(next = 3, used = 6))!!
        assertEquals(3, R.due(p, true, State(), 1, "d"))
        val after = R.afterRead(p, State(), 3, 1, "d", login = false)
        assertEquals(4, R.due(p, true, after.copy(lastAt = 0), 1, "d"))
        assertNull(R.due(p, true, State(date = "d", count = 4), 1, "d"))
        // A new day: both counts start again.
        assertEquals(3, R.due(p, true, State(date = "d", count = 4), 1, "e"))
        // Five fragments: the index wraps.
        assertEquals(0, R.due(R.parse(plan(next = 5)), true, State(), 1, "d"))
    }

    @Test
    fun remembersWhenItMetTheLoginPage() {
        val p = R.parse(plan())!!
        assertEquals(77L, R.afterRead(p, State(), 0, 77, "d", login = true).loginAt)
        assertEquals(5L, R.afterRead(p, State(loginAt = 5), 0, 77, "d", login = false).loginAt)
    }
}
