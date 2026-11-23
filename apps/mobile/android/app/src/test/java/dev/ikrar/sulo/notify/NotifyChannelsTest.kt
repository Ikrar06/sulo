package dev.ikrar.sulo.notify

import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

/**
 * The shared vectors (packages/core/src/notify/channel-vectors.json): the
 * same file core's reference is checked against
 * (apps/extension/tests/notify-channels.test.ts). A difference fails CI on
 * both sides.
 */
class NotifyChannelsTest {
    private val vectors: JSONObject by lazy {
        // Gradle runs unit tests from the app module (apps/mobile/android/app).
        val file = generateSequence(File("").absoluteFile) { it.parentFile }.map { File(it, "packages/core/src/notify/channel-vectors.json") }.first { it.exists() }
        JSONObject(file.readText())
    }

    private fun cases(name: String): List<JSONObject> = vectors.getJSONArray(name).let { a -> (0 until a.length()).map { a.getJSONObject(it) } }
    private fun strings(a: JSONArray) = (0 until a.length()).map { a.getString(it) }

    @Test
    fun kindOfEveryId() {
        val all = cases("kinds")
        assertTrue(all.size >= 10)
        all.forEach { assertEquals(it.getString("id"), it.getString("out"), NotifyChannels.kindOf(it.getString("id"))) }
    }

    @Test
    fun changesOnThePhone() {
        val all = cases("changes")
        assertTrue(all.size >= 8)
        all.forEach { c ->
            val out = NotifyChannels.changes(strings(c.getJSONArray("existing")), c.getJSONObject("plan"))
            val want = c.getJSONObject("out")
            assertEquals(c.toString(), strings(want.getJSONArray("create")), out.create.map { it.getString("id") })
            assertEquals(c.toString(), strings(want.getJSONArray("remove")), out.remove)
        }
    }

    /** Every plan core can make sends each kind of notification to a channel, and to one the plan creates (the reserved kind aside). */
    @Test
    fun everyPlanNamesAChannelForEveryKind() {
        cases("plans").forEach { p ->
            val plan = p.getJSONObject("out")
            val created = plan.getJSONArray("channels").let { a -> (0 until a.length()).map { a.getJSONObject(it).getString("id") } }
            cases("kinds").forEach { k ->
                val id = NotifyChannels.channelFor(plan, k.getString("id"))
                assertTrue("${p.getString("sound")} ${k.getString("id")}", !id.isNullOrEmpty())
                if (k.getString("out") != "release") assertTrue("${p.getString("sound")} ${k.getString("id")} -> $id", id!! in created)
            }
        }
    }

    @Test
    fun aPlanWithoutChannelsChangesNothing() {
        val out = NotifyChannels.changes(listOf("sulo_kabar", "default", "other"), JSONObject())
        assertEquals(emptyList<JSONObject>(), out.create)
        // An empty plan names no channel, so everything of Sulo's would go: callers never apply one (WatchNotifier checks first).
        assertEquals(listOf("default", "sulo_kabar"), out.remove)
        assertEquals(null, NotifyChannels.channelFor(JSONObject(), "task|1|x"))
    }
}
