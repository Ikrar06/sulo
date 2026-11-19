package dev.ikrar.sulo.watch

import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

/**
 * The worker's own config reading on the shared vectors (remoteParse,
 * remoteReadDue, remoteDecide): the same cases core's watch/remote.ts is
 * checked against in apps/extension/tests/watch-vectors.test.ts.
 */
class WatchRemoteTest {
    private val vectors: JSONObject by lazy {
        val file = generateSequence(File("").absoluteFile) { it.parentFile }.map { File(it, "packages/core/src/watch/vectors.json") }.first { it.exists() }
        JSONObject(file.readText())
    }

    private fun cases(name: String): List<JSONObject> = vectors.getJSONArray(name).let { a -> (0 until a.length()).map { a.getJSONObject(it) } }

    private fun canon(v: Any?): String = when (v) {
        null, JSONObject.NULL -> "null"
        is JSONObject -> v.keys().asSequence().sorted().joinToString(",", "{", "}") { "\"$it\":${canon(v.opt(it))}" }
        is JSONArray -> (0 until v.length()).joinToString(",", "[", "]") { canon(v.opt(it)) }
        is Boolean -> v.toString()
        is Number -> v.toDouble().let { d -> if (d == Math.floor(d) && !d.isInfinite()) d.toLong().toString() else d.toString() }
        is String -> JSONObject.quote(v)
        else -> JSONObject.quote(v.toString())
    }

    private fun readJson(r: WatchRemote.Read): JSONObject = when (r) {
        is WatchRemote.Read.Ok -> JSONObject().put("kind", "ok").put("config", WatchRemote.toJson(r.config))
        WatchRemote.Read.NotModified -> JSONObject().put("kind", "not_modified")
        WatchRemote.Read.Failed -> JSONObject().put("kind", "failed")
    }

    private fun decisionJson(d: WatchRemote.Decision): JSONObject = when (d) {
        WatchRemote.Decision.Paused -> JSONObject().put("action", "paused")
        is WatchRemote.Decision.Hold -> JSONObject().put("action", "hold").put("reason", d.reason).put("intervalMin", d.intervalMin)
        is WatchRemote.Decision.Check -> JSONObject().put("action", "check").put("schedule", JSONObject().put("dayIntervalMin", d.dayIntervalMin).put("nightIntervalMin", d.nightIntervalMin).put("softDayIntervalMin", d.softDayIntervalMin).put("radarEvery", d.radarEvery))
    }

    @Test
    fun parsesLikeTheApp() = cases("remoteParse").forEach {
        val body = if (it.isNull("body")) null else it.getString("body")
        assertEquals(it.getString("name"), canon(it.getJSONObject("out")), canon(readJson(WatchRemote.parse(it.getInt("status"), body))))
    }

    @Test
    fun readsAtMostEverySixHours() = cases("remoteReadDue").forEach {
        assertEquals(it.toString(), it.getBoolean("out"), WatchRemote.readDue(it.getLong("lastReadAt"), it.getLong("now")))
    }

    @Test
    fun decidesLikeTheReference() = cases("remoteDecide").forEach {
        val s = it.getJSONObject("state")
        val state = WatchRemote.State(s.getLong("now"), s.getLong("lastAppAt"), s.getLong("configOkAt"), WatchRemote.fromJson(s.optJSONObject("config")))
        assertEquals(it.getString("name"), canon(it.getJSONObject("out")), canon(decisionJson(WatchRemote.decide(state))))
    }

    @Test
    fun theStrictCheckRefusesWhatJsonParseRefuses() {
        // org.json alone would take these; JSON.parse does not, so neither does the worker.
        listOf("{enabled: true, minIntervalMinutes: 30}", "{'enabled': true, 'minIntervalMinutes': 30}", "{\"enabled\": true, \"minIntervalMinutes\": 30,}", "{\"enabled\": true /* c */, \"minIntervalMinutes\": 30}", "{\"enabled\": True, \"minIntervalMinutes\": 30}", "{\"enabled\": true, \"minIntervalMinutes\": 030}", "{\"enabled\": true, \"minIntervalMinutes\": 30} x")
            .forEach { assertEquals(it, WatchRemote.Read.Failed, WatchRemote.parse(200, it)) }
        assertTrue(StrictJson.valid("{\"a\": [1, -2.5e3, \"\\u00e9\\n\", null, true, false, {}]}"))
        assertFalse(StrictJson.valid("{\"a\": 1, \"a\": 2}"))
    }

    @Test
    fun theScheduleComesFromTheConfig() {
        val plan = vectors.getJSONObject("plan")
        val effective = WatchRemote.withSchedule(plan, WatchRemote.Decision.Check(50, 90, 50, 1))
        val s = effective.getJSONObject("schedule")
        assertEquals(listOf(50, 90, 50, 1), listOf(s.getInt("dayIntervalMin"), s.getInt("nightIntervalMin"), s.getInt("softDayIntervalMin"), s.getInt("radarEvery")))
        // The stored plan itself is untouched.
        assertEquals(20, plan.getJSONObject("schedule").getInt("dayIntervalMin"))
    }

    @Test
    fun onlyTheOfficialFileInARelease() {
        assertEquals(PublicConfig.OFFICIAL_URL, PublicConfig.urlFor("https://raw.githubusercontent.com/Ikrar06/sulo-data/test/config.json", debug = false))
        assertEquals("https://raw.githubusercontent.com/Ikrar06/sulo-data/test/config.json", PublicConfig.urlFor("https://raw.githubusercontent.com/Ikrar06/sulo-data/test/config.json", debug = true))
        assertEquals(PublicConfig.OFFICIAL_URL, PublicConfig.urlFor("https://example.com/config.json", debug = true))
        assertEquals(PublicConfig.OFFICIAL_URL, PublicConfig.urlFor(null, debug = true))
    }
}
