package dev.ikrar.sulo.watch

import org.json.JSONArray
import org.json.JSONObject

/**
 * One background check's decisions, as pure functions: the Kotlin side of
 * packages/core/src/watch/check.ts. Every rule and text comes from the plan
 * core wrote (watch/plan.ts); nothing here is decided on its own. Both
 * sides are tested on the same vectors (packages/core/src/watch/vectors.json),
 * so CI fails when they disagree. No android.* here; no logging anywhere.
 */
object WatchCheck {
    const val PLAN_STALE_SEC = 48L * 3600

    /** The app's numericId (apps/mobile/src/platform/notifications.ts): Java's string hash, absolute, mod 2e9. */
    fun numericId(id: String): Int {
        var h = 0
        for (c in id) h = 31 * h + c.code
        return (Math.abs(h.toLong()) % 2_000_000_000L).toInt()
    }

    // ---- When ----

    private fun schedule(plan: JSONObject) = plan.getJSONObject("schedule")
    private fun budget(plan: JSONObject) = plan.getJSONObject("budget")

    fun isDay(minuteOfDay: Int, plan: JSONObject): Boolean {
        val s = schedule(plan)
        return minuteOfDay >= s.getInt("dayStartMin") && minuteOfDay < s.getInt("nightStartMin")
    }

    /** The same window rule as core's quiet hours (reminders/zoned.ts inWindow). */
    fun inQuiet(minuteOfDay: Int, quiet: JSONObject): Boolean {
        if (!quiet.optBoolean("enabled", false)) return false
        val start = quiet.getInt("startMin")
        val end = quiet.getInt("endMin")
        if (start == end) return false
        return if (start < end) minuteOfDay in start until end else minuteOfDay >= start || minuteOfDay < end
    }

    data class Ctx(val minuteOfDay: Int, val powerSave: Boolean, val usedToday: Int, val callsToday: Int)

    // A plan written before the watch stop existed falls back to the same numbers.
    private fun stopPosts(b: JSONObject) = minOf(b.optInt("watchStopPosts", 100), b.getInt("hardPosts"))
    private fun stopCalls(b: JSONObject) = minOf(b.optInt("watchStopCalls", 700), b.getInt("callLimit"))

    /** Watching is done for the day: the rest of the budget is the reserve for active use. */
    fun watchStopped(plan: JSONObject, usedToday: Int, callsToday: Int): Boolean {
        val b = budget(plan)
        return usedToday >= stopPosts(b) || callsToday >= stopCalls(b)
    }

    /** Radar gives way first: it rides along only when the whole batch still ends at or below the watch stop. */
    fun radarFits(plan: JSONObject, callsToday: Int, baseCalls: Int, radarCalls: Int): Boolean = callsToday + baseCalls + radarCalls <= stopCalls(budget(plan))

    /** Minutes to the next check, or null once watching stopped for the day (nothing until the daily reset). */
    fun nextDelayMinutes(plan: JSONObject, ctx: Ctx): Int? {
        val b = budget(plan)
        val s = schedule(plan)
        if (watchStopped(plan, ctx.usedToday, ctx.callsToday)) return null
        if (ctx.powerSave || !isDay(ctx.minuteOfDay, plan)) return s.getInt("nightIntervalMin")
        return if (ctx.usedToday >= b.getInt("softPosts")) s.getInt("softDayIntervalMin") else s.getInt("dayIntervalMin")
    }

    fun radarDue(plan: JSONObject, ctx: Ctx, dayCheckIndex: Int): Boolean {
        if (ctx.powerSave || !isDay(ctx.minuteOfDay, plan) || ctx.usedToday >= budget(plan).getInt("softPosts")) return false
        val every = schedule(plan).getInt("radarEvery")
        return dayCheckIndex % every == every - 1
    }

    data class Pick(val ids: List<Long>, val cursor: Int)

    fun pickRadar(courseIds: List<Long>, cursor: Int, max: Int): Pick {
        if (courseIds.isEmpty() || max <= 0) return Pick(emptyList(), 0)
        val n = minOf(max, courseIds.size)
        val start = ((cursor % courseIds.size) + courseIds.size) % courseIds.size
        return Pick((0 until n).map { courseIds[(start + it) % courseIds.size] }, (start + n) % courseIds.size)
    }

    fun planStale(plan: JSONObject, now: Long): Boolean = now - plan.getLong("writtenAt") > PLAN_STALE_SEC

    // ---- Budget and backoff (the same JSON as core's global:budget and global:backoff) ----

    data class Reserved(val ok: Boolean, val next: JSONObject)

    /** Like core's reserveRequest (moodle/budget.ts) with source "watch". */
    fun reserve(state: JSONObject?, today: String, now: Long, calls: Int, plan: JSONObject): Reserved {
        val b = budget(plan)
        val current = if (state != null && state.optString("date") == today) JSONObject(state.toString()) else JSONObject().put("date", today).put("used", 0)
        val used = current.getInt("used")
        // The watch stop, never the hard limit: the reserve stays for active use.
        if (used >= stopPosts(b)) return Reserved(false, current)
        if (calls > 0 && current.optInt("calls", 0) + calls > stopCalls(b)) return Reserved(false, current)
        if (current.has("pausedUntil") && now < current.getLong("pausedUntil")) return Reserved(false, current)
        val recent = JSONArray()
        current.optJSONArray("recent")?.let { r -> for (i in 0 until r.length()) if (now - r.getLong(i) < b.getLong("loopWindowSec")) recent.put(r.getLong(i)) }
        if (recent.length() >= b.getInt("loopPosts")) return Reserved(false, current.put("recent", recent).put("pausedUntil", now + b.getLong("loopPauseSec")))
        val bySource = current.optJSONObject("bySource")?.let { JSONObject(it.toString()) } ?: JSONObject()
        bySource.put("watch", bySource.optInt("watch", 0) + 1)
        val next = JSONObject()
            .put("date", current.getString("date"))
            .put("used", used + 1)
            .put("bySource", bySource)
            .put("withCourseList", current.optInt("withCourseList", 0))
        if (calls > 0 || current.has("calls")) next.put("calls", current.optInt("calls", 0) + calls)
        next.put("recent", recent.put(now))
        return Reserved(true, next)
    }

    private val BACKOFF_STEPS_H = intArrayOf(3, 6, 12, 24)
    private const val BACKOFF_MAX_H = 24

    fun backingOff(state: JSONObject?, now: Long): Boolean = state != null && state.optInt("failures", 0) > 0 && now < state.optLong("nextAllowedAt", 0)

    /** Like core's afterFailure (moodle/backoff.ts). */
    fun afterFailure(prev: JSONObject?, now: Long, retryAfterSec: Long?, random: Double): JSONObject {
        val failures = (prev?.optInt("failures", 0) ?: 0) + 1
        val step = (BACKOFF_STEPS_H.getOrNull(failures - 1) ?: BACKOFF_MAX_H) * 3600L
        val r = random.coerceIn(0.0, 1.0)
        val computed = Math.round(step * (0.5 + 0.5 * r))
        val honored = minOf(maxOf(computed, retryAfterSec ?: 0L), BACKOFF_MAX_H * 3600L)
        return JSONObject().put("failures", failures).put("nextAllowedAt", now + honored)
    }

    // ---- The batch ----

    fun buildBatch(plan: JSONObject, now: Long, radarIds: List<Long>): JSONArray {
        val out = JSONArray()
        val calls = plan.getJSONArray("calls")
        for (i in 0 until calls.length()) {
            val c = calls.getJSONObject(i)
            val args = JSONObject(c.getJSONObject("args").toString())
            c.optJSONObject("nowOffsets")?.let { offs -> offs.keys().forEach { k -> args.put(k, now + offs.getLong(k)) } }
            out.put(JSONObject().put("index", out.length()).put("methodname", c.getString("methodname")).put("args", args))
        }
        val radar = plan.getJSONObject("radar")
        for (id in radarIds) out.put(JSONObject().put("index", out.length()).put("methodname", radar.getString("methodname")).put("args", JSONObject().put(radar.getString("argKey"), id)))
        return out
    }

    // ---- Reading the answer ----

    sealed class Outcome {
        object Expired : Outcome()
        object Unsure : Outcome()
        data class Ok(val changes: List<JSONObject>, val overlay: JSONObject) : Outcome()
    }

    fun emptyOverlay(): JSONObject = JSONObject().put("eventIds", JSONArray()).put("dueKeys", JSONArray()).put("notificationLastId", JSONObject.NULL).put("cms", JSONObject())

    /** An integer as JSON gives it (JavaScript's Number.isInteger). */
    private fun intOf(v: Any?): Long? = when (v) {
        is Int -> v.toLong()
        is Long -> v
        is Number -> v.toDouble().let { d -> if (d.isFinite() && d == Math.floor(d) && Math.abs(d) <= 9.007199254740991E15) d.toLong() else null }
        else -> null
    }

    private val CM_URL = Regex("^https?://[^/]+/mod/[^?#]*\\?(?:[^#]*&)?id=(\\d+)(?:[&#]|$)")

    private fun cmIdFromUrl(url: Any?): Long? {
        if (url !is String) return null
        val id = CM_URL.find(url)?.groupValues?.get(1)?.toLongOrNull() ?: return null
        return if (id > 0) id else null
    }

    private fun courseFromCustomdata(raw: Any?): Long? {
        if (raw !is String || raw.isEmpty()) return null
        return runCatching {
            val d = JSONObject(raw)
            val v = d.opt("courseid")
            val n = when (v) {
                is String -> if (Regex("^\\d+$").matches(v)) v.toLong() else null
                else -> intOf(v)
            }
            if (n != null && n > 0) n else null
        }.getOrNull()
    }

    private fun sessionEnded(r: Any?): Boolean {
        if (r !is JSONObject || r.opt("error") != true) return false
        val code = r.optJSONObject("exception")?.opt("errorcode")
        return code == "servicerequireslogin" || code == "requireloginerror"
    }

    private fun longs(a: JSONArray?): MutableList<Long> = if (a == null) mutableListOf() else (0 until a.length()).map { a.getLong(it) }.toMutableList()
    private fun strings(a: JSONArray?): MutableList<String> = if (a == null) mutableListOf() else (0 until a.length()).map { a.getString(it) }.toMutableList()

    private fun detected(kind: String, key: String, courseId: Long?): JSONObject = JSONObject().put("kind", kind).put("key", key).put("courseId", courseId ?: JSONObject.NULL)

    /** Compares one answer with the plan's baseline and the overlay; anything unexpected is Unsure. */
    fun detect(plan: JSONObject, overlay: JSONObject, now: Long, results: Any?, radarIds: List<Long>): Outcome {
        val callCount = plan.getJSONArray("calls").length()
        if (results !is JSONArray || results.length() != callCount + radarIds.size) return Outcome.Unsure
        if (sessionEnded(results.opt(0))) return Outcome.Expired
        for (i in 0 until results.length()) {
            val r = results.opt(i)
            if (r !is JSONObject || r.opt("error") != false) return Outcome.Unsure
        }
        val data = (0 until results.length()).map { results.getJSONObject(it).opt("data") }

        val session = data[0]
        if (session !is JSONObject || intOf(session.opt("userid")) != plan.getLong("userId")) return Outcome.Unsure

        val baseline = plan.getJSONObject("baseline")
        val changes = mutableListOf<JSONObject>()
        val eventIds = longs(overlay.optJSONArray("eventIds"))
        val dueKeys = strings(overlay.optJSONArray("dueKeys"))
        var noteLast: Long? = if (overlay.isNull("notificationLastId")) null else overlay.getLong("notificationLastId")
        val cms = linkedMapOf<String, MutableList<Long>>()
        overlay.optJSONObject("cms")?.let { o -> o.keys().forEach { k -> cms[k] = longs(o.getJSONArray(k)) } }

        // Calendar: new tasks and changed due dates.
        val calendar = data[1]
        val events = (calendar as? JSONObject)?.opt("events") as? JSONArray ?: return Outcome.Unsure
        val known = linkedMapOf<Long, JSONObject>()
        val baseTasks = baseline.getJSONArray("tasks")
        for (i in 0 until baseTasks.length()) baseTasks.getJSONObject(i).let { known[it.getLong("eventId")] = it }
        val announced = longs(baseline.getJSONArray("announcedCms")).toSet()
        val newTaskCms = mutableSetOf<Long>()
        val tasksReady = baseline.getBoolean("tasksReady")
        val far = plan.getLong("farTaskSec")
        for (i in 0 until events.length()) {
            val e = events.opt(i) as? JSONObject ?: return Outcome.Unsure
            val id = intOf(e.opt("id")) ?: return Outcome.Unsure
            val timesort = intOf(e.opt("timesort")) ?: return Outcome.Unsure
            val course = e.opt("course") as? JSONObject ?: return Outcome.Unsure
            val courseId = intOf(course.opt("id")) ?: return Outcome.Unsure
            val rawName = e.opt("name") as? String ?: return Outcome.Unsure
            val activity = e.opt("activityname")
            val name = (if (activity is String && activity.trim().isNotEmpty()) activity.trim() else rawName).trim()
            val cmId = cmIdFromUrl(e.opt("url")) ?: (e.opt("action") as? JSONObject)?.let { cmIdFromUrl(it.opt("url")) }
            val dueAt: Long? = if (timesort > 0) timesort else null
            if (!tasksReady) continue
            val before = known[id]
            if (before == null) {
                if (id in eventIds) continue
                eventIds.add(id)
                if (cmId != null) newTaskCms.add(cmId)
                if (dueAt != null && dueAt - now > far) continue
                if (cmId != null && cmId in announced) continue
                changes.add(detected("task_added", "task:$id:added", courseId).put("eventId", id).put("cmId", cmId ?: JSONObject.NULL).put("name", name))
            } else {
                val beforeDue: Long? = if (before.isNull("dueAt")) null else before.getLong("dueAt")
                if (beforeDue != dueAt) {
                    val key = "task:$id:due:${dueAt ?: "none"}"
                    if (key in dueKeys) continue
                    dueKeys.add(key)
                    changes.add(detected("due_changed", key, courseId).put("eventId", id).put("name", name))
                }
            }
        }

        // Popup notifications: grades and forum by component/eventtype, never by subject.
        val notes = (data[2] as? JSONObject)?.opt("notifications") as? JSONArray ?: return Outcome.Unsure
        val baseLast: Long? = if (baseline.isNull("notificationLastId")) null else baseline.getLong("notificationLastId")
        if (baseLast != null) {
            val last = maxOf(baseLast, noteLast ?: -1L)
            val fresh = mutableListOf<JSONObject>()
            for (i in 0 until notes.length()) {
                val n = notes.opt(i) as? JSONObject ?: return Outcome.Unsure
                val nid = intOf(n.opt("id")) ?: return Outcome.Unsure
                if (n.opt("component") !is String || n.opt("eventtype") !is String) return Outcome.Unsure
                if (nid > last) fresh.add(n)
            }
            fresh.sortBy { intOf(it.opt("id")) }
            val rules = plan.getJSONArray("notificationRules")
            for (n in fresh) {
                val nid = intOf(n.opt("id"))!!
                var kind = "other"
                for (j in 0 until rules.length()) {
                    val r = rules.getJSONObject(j)
                    if (r.getString("component") == n.getString("component") && (r.isNull("eventtype") || r.getString("eventtype") == n.getString("eventtype"))) {
                        kind = r.getString("kind")
                        break
                    }
                }
                noteLast = maxOf(noteLast ?: -1L, nid)
                if (kind == "other") continue
                changes.add(detected(kind, "note:$nid", courseFromCustomdata(n.opt("customdata"))).put("notificationId", nid))
            }
        }

        // Course structures: new visible activities against the known ones.
        val courseCms = baseline.getJSONObject("courseCms")
        val taskModules = strings(plan.getJSONArray("taskModules")).toSet()
        val baselineTaskCms = (0 until baseTasks.length()).mapNotNull { baseTasks.getJSONObject(it).let { t -> if (t.isNull("cmId")) null else t.getLong("cmId") } }.toSet()
        for ((i, courseId) in radarIds.withIndex()) {
            val raw = data[callCount + i] as? String ?: return Outcome.Unsure
            val state = runCatching { JSONObject(raw) }.getOrNull() ?: return Outcome.Unsure
            val list = state.opt("cm") as? JSONArray ?: return Outcome.Unsure
            val base = courseCms.optJSONArray(courseId.toString()) ?: continue
            val key = courseId.toString()
            val seen = (longs(base) + (cms[key] ?: emptyList())).toMutableSet()
            for (j in 0 until list.length()) {
                val cm = list.opt(j) as? JSONObject ?: return Outcome.Unsure
                val cmId = intOf(cm.opt("id")) ?: return Outcome.Unsure
                val module = cm.opt("module") as? String ?: return Outcome.Unsure
                val name = cm.opt("name") as? String ?: return Outcome.Unsure
                if (cmId in seen) continue
                cms.getOrPut(key) { mutableListOf() }.add(cmId)
                seen.add(cmId)
                val visible = cm.opt("visible") != false && cm.opt("uservisible") != false
                if (module == "label" || !visible) continue
                if (cmId in newTaskCms || cmId in baselineTaskCms) continue
                val kind = if (module in taskModules) "task_activity" else "material"
                changes.add(detected(kind, "cm:$courseId:$cmId:added", courseId).put("cmId", cmId).put("name", name))
            }
        }

        val next = JSONObject()
            .put("eventIds", JSONArray(eventIds))
            .put("dueKeys", JSONArray(dueKeys))
            .put("notificationLastId", noteLast ?: JSONObject.NULL)
            .put("cms", JSONObject().apply { cms.forEach { (k, v) -> put(k, JSONArray(v)) } })
        val notify = plan.getJSONObject("notify")
        return Outcome.Ok(changes.filter { allowed(notify, it.getString("kind")) }, next)
    }

    private fun allowed(notify: JSONObject, kind: String): Boolean = when (kind) {
        "task_added", "material", "task_activity" -> notify.getBoolean("materials")
        "due_changed" -> notify.getBoolean("deadlines")
        "grade_feedback" -> notify.getBoolean("grades")
        "forum" -> notify.getBoolean("forum")
        else -> false
    }

    // ---- Notifications ----

    data class Notice(val id: String, val numericId: Int, val title: String, val body: String)
    data class Notices(val send: List<Notice>, val hold: List<JSONObject>)

    private val PLACEHOLDER = Regex("\\{(name|course|n|courses)\\}")
    private const val NAME_MAX = 60

    private fun shorten(s: String) = if (s.length > NAME_MAX) s.substring(0, NAME_MAX - 1).trimEnd() + "…" else s

    private fun fill(t: JSONObject, values: Map<String, String>): Pair<String, String> {
        fun sub(s: String) = PLACEHOLDER.replace(s) { values[it.groupValues[1]] ?: "" }
        return sub(t.getString("title")).trim() to sub(t.getString("body")).trim()
    }

    private fun single(templates: JSONObject, c: JSONObject, course: String): Pair<String, String> = when (c.getString("kind")) {
        "task_added", "task_activity" -> fill(templates.getJSONObject("taskAdded"), mapOf("name" to shorten(c.getString("name")), "course" to course))
        "due_changed" -> fill(templates.getJSONObject("dueChanged"), mapOf("name" to shorten(c.getString("name")), "course" to course))
        "grade_feedback" -> fill(templates.getJSONObject("grade"), mapOf("course" to course))
        "forum" -> fill(templates.getJSONObject("forum"), mapOf("course" to course))
        else -> fill(templates.getJSONObject("material"), mapOf("name" to shorten(c.getString("name")), "course" to course))
    }

    private fun courseKey(c: JSONObject): Long? = if (c.isNull("courseId")) null else c.getLong("courseId")

    /** One notification per course, or one summary when held or more than maxCourseNotices courses; nothing during quiet hours. */
    fun notices(plan: JSONObject, changes: List<JSONObject>, held: List<JSONObject>, now: Long, minuteOfDay: Int): Notices {
        val all = held + changes
        if (all.isEmpty()) return Notices(emptyList(), emptyList())
        if (inQuiet(minuteOfDay, plan.getJSONObject("quiet"))) return Notices(emptyList(), all)
        val groups = linkedMapOf<Long?, MutableList<JSONObject>>()
        for (c in all) groups.getOrPut(courseKey(c)) { mutableListOf() }.add(c)
        val templates = plan.getJSONObject("templates")
        val names = plan.getJSONObject("courseNames")
        fun courseName(id: Long?) = if (id == null) templates.getString("otherCourse") else names.optString(id.toString(), templates.getString("otherCourse"))
        if (held.isNotEmpty() || groups.size > plan.getInt("maxCourseNotices")) {
            val (title, body) = fill(templates.getJSONObject("summary"), mapOf("n" to all.size.toString(), "courses" to groups.size.toString()))
            val id = "changes_summary|chs:$now"
            return Notices(listOf(Notice(id, numericId(id), title, body)), emptyList())
        }
        val send = groups.map { (courseId, cs) ->
            val course = courseName(courseId)
            val (title, body) = if (cs.size == 1) single(templates, cs[0], course) else fill(templates.getJSONObject("mixed"), mapOf("n" to cs.size.toString(), "course" to course))
            val tag = courseId?.toString() ?: "x"
            val id = if (cs.size == 1) "changes|${cs[0].getString("key")}" else "changes|course:$tag|chg:$tag:$now"
            Notice(id, numericId(id), title, body)
        }
        return Notices(send, emptyList())
    }
}
