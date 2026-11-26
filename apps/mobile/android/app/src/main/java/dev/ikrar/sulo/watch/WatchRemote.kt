package dev.ikrar.sulo.watch

import org.json.JSONArray
import org.json.JSONObject

/**
 * The worker's own reading of the public config, so the kill switch is
 * obeyed without the app being opened. Pure; core's watch/remote.ts is the
 * reference and both are checked on the shared vectors (remoteParse,
 * remoteReadDue, remoteDecide in packages/core/src/watch/vectors.json).
 *
 * The file is validated like the app validates it (remoteConfigSchema, then
 * mobile.backgroundKeepAlive field by field, with the same limits). A
 * broken file, a schema failure or any status but 200 or 304 is a failed
 * read: never permission. org.json is lenient (unquoted keys, single
 * quotes, comments), so the text first passes a strict RFC 8259 check, the
 * same grammar JSON.parse accepts; duplicate keys are refused too.
 */
object WatchRemote {
    const val READ_GAP_SEC = 6 * 3600L
    const val MAX_AGE_SEC = 72 * 3600L
    const val APP_PAUSE_SEC = 7 * 86_400L
    const val HOLD_INTERVAL_MIN = 360
    private const val SOFT_DAY_INTERVAL_MIN = 40
    private const val MESSAGE_MAX = 500

    data class KeepAlive(val enabled: Boolean, val dayIntervalMinutes: Int, val nightIntervalMinutes: Int, val radarEvery: Int)
    /** minVersionCode: from a valid mobile.release only, 0 when none (core remote/release.ts). */
    /** sipakamaseKeep: false only when sources.sipakamase is off or its keeper stopped (core watch/remote.ts). */
    data class Config(val globalEnabled: Boolean, val keepAlive: KeepAlive, val minVersionCode: Int = 0, val sipakamaseKeep: Boolean = true)

    sealed class Read {
        data class Ok(val config: Config) : Read()
        object NotModified : Read()
        object Failed : Read()
    }

    sealed class Decision {
        object Paused : Decision()
        data class Hold(val reason: String, val intervalMin: Int = HOLD_INTERVAL_MIN) : Decision()
        data class Check(val dayIntervalMin: Int, val nightIntervalMin: Int, val softDayIntervalMin: Int, val radarEvery: Int) : Decision()
    }

    /** installedCode: this app's versionCode (BuildConfig.VERSION_CODE); null: not compared. */
    data class State(val now: Long, val lastAppAt: Long, val configOkAt: Long, val config: Config?, val installedCode: Long? = null)

    private val DEFAULT = KeepAlive(enabled = true, dayIntervalMinutes = 20, nightIntervalMinutes = 110, radarEvery = 3)
    private val DAY = 15..110
    private val NIGHT = 30..110
    private val RADAR = 1..6

    // ---- Reading one response ----

    fun parse(status: Int, body: String?): Read {
        if (status == 304) return Read.NotModified
        if (status != 200 || body == null || !StrictJson.valid(body)) return Read.Failed
        val root = runCatching { JSONObject(body) }.getOrNull() ?: return Read.Failed
        // remoteConfigSchema: enabled (boolean), minIntervalMinutes (integer >= 0), message (string, at most 500, optional).
        val enabled = root.opt("enabled") as? Boolean ?: return Read.Failed
        val min = root.opt("minIntervalMinutes")
        if (!(isInteger(min) && (min as Number).toDouble() >= 0)) return Read.Failed
        if (root.has("message")) {
            val m = root.opt("message") as? String ?: return Read.Failed
            if (m.length > MESSAGE_MAX) return Read.Failed
        }
        // The switch's path, when present, is readable (the schema's refine).
        if (!switchReadable(root)) return Read.Failed
        return Read.Ok(Config(enabled, keepAlive(root.opt("mobile")), releaseMin(root.opt("mobile")), sipakamaseKeep(root.opt("sources"))))
    }

    /** core remote/sources.ts: sources.sipakamase.enabled and .keep, each true unless a boolean false (the switch rule already refused a non-boolean). */
    private fun sipakamaseKeep(sources: Any?): Boolean {
        val s = (sources as? JSONObject)?.optJSONObject("sipakamase") ?: return true
        return s.opt("enabled") != false && s.opt("keep") != false
    }

    /** core remote/switches.ts CONFIG_SWITCHES: the same paths, the same rule. */
    private val SWITCHES = listOf(
        Triple("mobile", "backgroundKeepAlive", "enabled"),
        Triple("extension", "backgroundWatch", "enabled"),
        Triple("sources", "sipakamase", "enabled"),
        Triple("sources", "sipakamase", "keep"),
        Triple("sources", "neosia", "scheduledVisit"),
    )

    /** Every switch path, where present, is readable: its sections objects, the switch a boolean. */
    private fun switchReadable(root: JSONObject): Boolean = SWITCHES.all { (section, group, name) ->
        if (!root.has(section) || root.isNull(section)) return@all !root.has(section)
        val s = root.opt(section) as? JSONObject ?: return@all false
        if (!s.has(group)) return@all true
        val g = s.opt(group) as? JSONObject ?: return@all false
        !g.has(name) || g.opt(name) is Boolean
    }

    /** keep-alive.ts parseKeepAlive: each field its default when missing, of the wrong type or out of range. */
    private fun keepAlive(mobile: Any?): KeepAlive {
        val k = (mobile as? JSONObject)?.opt("backgroundKeepAlive") as? JSONObject ?: return DEFAULT
        return KeepAlive(
            enabled = k.opt("enabled") as? Boolean ?: DEFAULT.enabled,
            dayIntervalMinutes = inRange(k.opt("dayIntervalMinutes"), DAY, DEFAULT.dayIntervalMinutes),
            nightIntervalMinutes = inRange(k.opt("nightIntervalMinutes"), NIGHT, DEFAULT.nightIntervalMinutes),
            radarEvery = inRange(k.opt("radarEvery"), RADAR, DEFAULT.radarEvery),
        )
    }

    // ---- mobile.release (M8e E3), as core's parseRelease reads it ----

    private val RELEASE_URL = Regex("^https://github\\.com/Ikrar06/[A-Za-z0-9_-][A-Za-z0-9._-]*/releases/download/[A-Za-z0-9_-][A-Za-z0-9._-]*/[A-Za-z0-9_-][A-Za-z0-9._-]*\\.apk$")
    private val VERSION_NAME = Regex("^\\d+\\.\\d+\\.\\d+$")
    private val SHA256 = Regex("^[0-9a-fA-F]{64}$")
    private const val NOTES_MAX = 300

    private fun isCode(v: Any?): Boolean = isInteger(v) && (v as Number).toDouble() > 0 && v.toDouble() < 2_100_000_000.0

    /**
     * The minVersionCode of a valid mobile.release, else 0. The whole section
     * must be valid (versionCode, versionName x.y.z, an asset of one of the
     * owner's GitHub releases, a SHA-256, notes when present), and the
     * minimum never above versionCode; anything else is ignored.
     */
    fun releaseMin(mobile: Any?): Int {
        val r = (mobile as? JSONObject)?.opt("release") as? JSONObject ?: return 0
        val code = r.opt("versionCode")
        if (!isCode(code)) return 0
        if (!((r.opt("versionName") as? String)?.let { VERSION_NAME.matches(it) } ?: false)) return 0
        if (!((r.opt("url") as? String)?.let { RELEASE_URL.matches(it) } ?: false)) return 0
        if (!((r.opt("sha256") as? String)?.let { SHA256.matches(it) } ?: false)) return 0
        val min = if (r.has("minVersionCode")) r.opt("minVersionCode") else 0
        val minOk = (isInteger(min) && (min as Number).toDouble() == 0.0) || isCode(min)
        if (!minOk || (min as Number).toDouble() > (code as Number).toDouble()) return 0
        if (r.has("notes")) {
            val n = r.opt("notes") as? JSONObject ?: return 0
            val id = (n.opt("id") as? String)?.trim() ?: return 0
            val en = (n.opt("en") as? String)?.trim() ?: return 0
            if (id.isEmpty() || en.isEmpty() || id.length > NOTES_MAX || en.length > NOTES_MAX) return 0
        }
        return min.toInt()
    }

    /** A JSON number with no fraction (JavaScript's Number.isInteger). */
    private fun isInteger(v: Any?): Boolean = v is Number && v.toDouble().let { !it.isNaN() && !it.isInfinite() && it == Math.floor(it) }

    private fun inRange(v: Any?, range: IntRange, fallback: Int): Int =
        if (isInteger(v) && (v as Number).toDouble() >= range.first && v.toDouble() <= range.last) v.toInt() else fallback

    // ---- Deciding ----

    fun readDue(lastReadAt: Long, now: Long): Boolean = now - lastReadAt >= READ_GAP_SEC

    fun decide(s: State): Decision {
        if (s.now - s.lastAppAt >= APP_PAUSE_SEC) return Decision.Paused
        val c = s.config
        if (c == null || s.configOkAt <= 0) return Decision.Hold("no_config")
        if (s.now - s.configOkAt >= MAX_AGE_SEC) return Decision.Hold("stale_config")
        // A required update: nothing to SIKOLA until Sulo is updated (the chain still reads the config).
        if (c.minVersionCode > 0 && s.installedCode != null && s.installedCode < c.minVersionCode) return Decision.Hold("update_required")
        if (!c.globalEnabled) return Decision.Hold("global_off")
        if (!c.keepAlive.enabled) return Decision.Hold("keepalive_off")
        val k = c.keepAlive
        return Decision.Check(k.dayIntervalMinutes, k.nightIntervalMinutes, maxOf(SOFT_DAY_INTERVAL_MIN, k.dayIntervalMinutes), k.radarEvery)
    }

    /** A copy of the plan with the schedule the config gives (the intervals and the Radar rotation are used directly). */
    fun withSchedule(plan: JSONObject, check: Decision.Check): JSONObject {
        val copy = JSONObject(plan.toString())
        copy.getJSONObject("schedule")
            .put("dayIntervalMin", check.dayIntervalMin)
            .put("nightIntervalMin", check.nightIntervalMin)
            .put("softDayIntervalMin", check.softDayIntervalMin)
            .put("radarEvery", check.radarEvery)
        return copy
    }

    // ---- The config as JSON (store, plan, vectors) ----

    fun toJson(c: Config): JSONObject = JSONObject()
        .put("globalEnabled", c.globalEnabled)
        .put("keepAlive", JSONObject().put("enabled", c.keepAlive.enabled).put("dayIntervalMinutes", c.keepAlive.dayIntervalMinutes).put("nightIntervalMinutes", c.keepAlive.nightIntervalMinutes).put("radarEvery", c.keepAlive.radarEvery))
        .apply { if (c.minVersionCode > 0) put("minVersionCode", c.minVersionCode) }
        .apply { if (!c.sipakamaseKeep) put("sipakamaseKeep", false) }

    /** From the plan's or the store's JSON; anything unreadable is null (no config). */
    fun fromJson(o: JSONObject?): Config? = runCatching {
        val k = o!!.getJSONObject("keepAlive")
        Config(o.getBoolean("globalEnabled"), KeepAlive(k.getBoolean("enabled"), k.getInt("dayIntervalMinutes"), k.getInt("nightIntervalMinutes"), k.getInt("radarEvery")), o.optInt("minVersionCode", 0), o.optBoolean("sipakamaseKeep", true))
    }.getOrNull()
}

/** RFC 8259 JSON, as JSON.parse takes it (plus: duplicate keys refused). Only says whether the text is valid. */
internal object StrictJson {
    fun valid(text: String): Boolean = runCatching {
        val p = P(text)
        p.ws(); p.value(0); p.ws()
        p.i == text.length
    }.getOrDefault(false)

    private class P(val s: String) {
        var i = 0
        private fun fail(): Nothing = throw IllegalArgumentException()
        private fun peek(): Char = if (i < s.length) s[i] else fail()
        fun ws() { while (i < s.length && (s[i] == ' ' || s[i] == '\t' || s[i] == '\n' || s[i] == '\r')) i++ }
        private fun lit(word: String) { if (!s.startsWith(word, i)) fail(); i += word.length }

        fun value(depth: Int) {
            if (depth > 64) fail()
            when (peek()) {
                '{' -> obj(depth)
                '[' -> arr(depth)
                '"' -> str()
                't' -> lit("true")
                'f' -> lit("false")
                'n' -> lit("null")
                else -> num()
            }
        }

        private fun obj(depth: Int) {
            i++; ws()
            if (peek() == '}') { i++; return }
            val keys = HashSet<String>()
            while (true) {
                ws()
                if (peek() != '"') fail()
                val start = i
                str()
                if (!keys.add(s.substring(start, i))) fail()
                ws(); if (peek() != ':') fail(); i++; ws()
                value(depth + 1); ws()
                when (peek()) { ',' -> i++; '}' -> { i++; return }; else -> fail() }
            }
        }

        private fun arr(depth: Int) {
            i++; ws()
            if (peek() == ']') { i++; return }
            while (true) {
                ws(); value(depth + 1); ws()
                when (peek()) { ',' -> i++; ']' -> { i++; return }; else -> fail() }
            }
        }

        private fun str() {
            i++
            while (true) {
                val c = peek()
                when {
                    c == '"' -> { i++; return }
                    c == '\\' -> {
                        i++
                        when (peek()) {
                            '"', '\\', '/', 'b', 'f', 'n', 'r', 't' -> i++
                            'u' -> { i++; repeat(4) { if (!peek().isHex()) fail(); i++ } }
                            else -> fail()
                        }
                    }
                    c < ' ' -> fail()
                    else -> i++
                }
            }
        }

        private fun Char.isHex() = this in '0'..'9' || this in 'a'..'f' || this in 'A'..'F'
        private fun digits() { val start = i; while (i < s.length && s[i] in '0'..'9') i++; if (i == start) fail() }

        private fun num() {
            if (peek() == '-') i++
            if (peek() == '0') i++ else if (peek() in '1'..'9') digits() else fail()
            if (i < s.length && s[i] == '.') { i++; digits() }
            if (i < s.length && (s[i] == 'e' || s[i] == 'E')) { i++; if (i < s.length && (s[i] == '+' || s[i] == '-')) i++; digits() }
        }
    }
}
