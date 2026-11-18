package dev.ikrar.sulo.watch

import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

/**
 * The shared vectors (packages/core/src/watch/vectors.json): the same file
 * core's reference is checked against (apps/extension/tests/watch-vectors.test.ts).
 * A difference fails CI on both sides.
 */
class WatchCheckTest {
    private val vectors: JSONObject by lazy {
        // Gradle runs unit tests from the app module (apps/mobile/android/app).
        val file = generateSequence(File("").absoluteFile) { it.parentFile }.map { File(it, "packages/core/src/watch/vectors.json") }.first { it.exists() }
        JSONObject(file.readText())
    }
    private val plan by lazy { vectors.getJSONObject("plan") }

    /** Sorted keys, integral numbers as longs: two JSON values compare by meaning, not by spelling. */
    private fun canon(v: Any?): String = when (v) {
        null, JSONObject.NULL -> "null"
        is JSONObject -> v.keys().asSequence().sorted().joinToString(",", "{", "}") { "\"$it\":${canon(v.opt(it))}" }
        is JSONArray -> (0 until v.length()).joinToString(",", "[", "]") { canon(v.opt(it)) }
        is List<*> -> v.joinToString(",", "[", "]") { canon(it) }
        is Map<*, *> -> v.entries.sortedBy { it.key.toString() }.joinToString(",", "{", "}") { "\"${it.key}\":${canon(it.value)}" }
        is Boolean -> v.toString()
        is Number -> v.toDouble().let { d -> if (d == Math.floor(d) && !d.isInfinite()) d.toLong().toString() else d.toString() }
        is String -> JSONObject.quote(v)
        else -> JSONObject.quote(v.toString())
    }

    private fun cases(name: String): List<JSONObject> = vectors.getJSONArray(name).let { a -> (0 until a.length()).map { a.getJSONObject(it) } }
    private fun longs(a: JSONArray) = (0 until a.length()).map { a.getLong(it) }
    private fun ctx(o: JSONObject) = WatchCheck.Ctx(o.getInt("minuteOfDay"), o.getBoolean("powerSave"), o.getInt("usedToday"))

    @Test
    fun numericId() = cases("numericId").forEach { assertEquals(it.getString("id"), it.getInt("out"), WatchCheck.numericId(it.getString("id"))) }

    @Test
    fun quietHours() = cases("quiet").forEach { assertEquals(it.toString(), it.getBoolean("out"), WatchCheck.inQuiet(it.getInt("minute"), it.getJSONObject("quiet"))) }

    @Test
    fun intervals() = cases("delay").forEach {
        val expected: Int? = if (it.isNull("out")) null else it.getInt("out")
        assertEquals(it.toString(), expected, WatchCheck.nextDelayMinutes(plan, ctx(it.getJSONObject("ctx"))))
    }

    @Test
    fun radarTurn() = cases("radarDue").forEach { assertEquals(it.toString(), it.getBoolean("out"), WatchCheck.radarDue(plan, ctx(it.getJSONObject("ctx")), it.getInt("index"))) }

    @Test
    fun radarRotation() = cases("pickRadar").forEach {
        val got = WatchCheck.pickRadar(longs(it.getJSONArray("courseIds")), it.getInt("cursor"), it.getInt("max"))
        assertEquals(canon(it.getJSONObject("out")), canon(mapOf("ids" to got.ids, "cursor" to got.cursor)))
    }

    @Test
    fun budget() = cases("reserve").forEach {
        val state = if (it.isNull("state")) null else it.getJSONObject("state")
        val got = WatchCheck.reserve(state, it.getString("today"), it.getLong("now"), it.getInt("calls"), plan)
        assertEquals(it.toString(), canon(it.getJSONObject("out")), canon(mapOf("ok" to got.ok, "next" to got.next)))
    }

    @Test
    fun backoff() = cases("backoff").forEach {
        val prev = if (it.isNull("prev")) null else it.getJSONObject("prev")
        val retry: Long? = if (it.isNull("retryAfter")) null else it.getLong("retryAfter")
        assertEquals(it.toString(), canon(it.getJSONObject("out")), canon(WatchCheck.afterFailure(prev, it.getLong("now"), retry, it.getDouble("random"))))
    }

    @Test
    fun batch() = cases("batch").forEach {
        assertEquals(canon(it.getJSONArray("out")), canon(WatchCheck.buildBatch(plan, it.getLong("now"), longs(it.getJSONArray("radarIds")))))
    }

    @Test
    fun detect() = cases("detect").forEach {
        val got = when (val o = WatchCheck.detect(plan, it.getJSONObject("overlay"), it.getLong("now"), it.getJSONArray("results"), longs(it.getJSONArray("radarIds")))) {
            WatchCheck.Outcome.Expired -> mapOf("status" to "expired")
            WatchCheck.Outcome.Unsure -> mapOf("status" to "unsure")
            is WatchCheck.Outcome.Ok -> mapOf("status" to "ok", "changes" to o.changes, "overlay" to o.overlay)
        }
        assertEquals(it.getString("name"), canon(it.getJSONObject("out")), canon(got))
    }

    @Test
    fun notifications() = cases("notices").forEach {
        val changes = it.getJSONArray("changes").let { a -> (0 until a.length()).map { i -> a.getJSONObject(i) } }
        val held = it.getJSONArray("held").let { a -> (0 until a.length()).map { i -> a.getJSONObject(i) } }
        val got = WatchCheck.notices(plan, changes, held, it.getLong("now"), it.getInt("minute"))
        val send = got.send.map { n -> mapOf("id" to n.id, "numericId" to n.numericId, "title" to n.title, "body" to n.body) }
        assertEquals(it.getString("name"), canon(it.getJSONObject("out")), canon(mapOf("send" to send, "hold" to got.hold)))
    }

    @Test
    fun staleness() {
        val written = plan.getLong("writtenAt")
        assertTrue(!WatchCheck.planStale(plan, written + WatchCheck.PLAN_STALE_SEC))
        assertTrue(WatchCheck.planStale(plan, written + WatchCheck.PLAN_STALE_SEC + 1))
    }
}
