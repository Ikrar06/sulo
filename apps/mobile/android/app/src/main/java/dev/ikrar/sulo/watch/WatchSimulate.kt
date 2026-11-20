package dev.ikrar.sulo.watch

import android.content.Context
import dev.ikrar.sulo.session.SessionVault
import org.json.JSONArray
import org.json.JSONObject
import java.util.Calendar

/**
 * Debug build only (the plugin refuses otherwise): the debug screen's
 * simulations. No request to SIKOLA: each takes the newest stored answer,
 * changes the plan's baseline on a copy, and runs the worker's own
 * detection and notices (WatchCheck), so the notification comes through
 * the real path. The title prefix comes from the app ("[uji] ").
 */
class WatchSimulate(private val context: Context) {
    private val store = WatchStore(context)

    private fun nowSec() = System.currentTimeMillis() / 1000
    private fun minuteOfDay(): Int = Calendar.getInstance().let { it.get(Calendar.HOUR_OF_DAY) * 60 + it.get(Calendar.MINUTE) }

    data class Result(val status: String, val changes: Int, val notices: Int)

    /** kind: task (one new task), due (a changed deadline), three (three news in one course), quiet (held, then one summary), expired. */
    fun run(kind: String, prefix: String): Result {
        val plan = store.plan() ?: return Result("no_plan", 0, 0)
        if (kind == "expired") return expired(plan, prefix)
        val answer = store.lastAnswer() ?: return Result("no_answer", 0, 0)
        val results = runCatching { JSONArray(answer.getString("body")) }.getOrNull() ?: return Result("unreadable", 0, 0)
        val radarIds = answer.optJSONArray("radarIds")?.let { a -> (0 until a.length()).map { a.getLong(it) } } ?: emptyList()
        val events = results.optJSONObject(1)?.optJSONObject("data")?.optJSONArray("events") ?: return Result("no_events", 0, 0)
        val copy = JSONObject(plan.toString())
        val baseline = copy.getJSONObject("baseline").put("tasksReady", true)
        val tasks = baseline.getJSONArray("tasks")
        val known = (0 until tasks.length()).map { tasks.getJSONObject(it) }
        val inAnswer = (0 until events.length()).map { events.getJSONObject(it) }.filter { e -> known.any { it.getLong("eventId") == e.getLong("id") } }
        if (inAnswer.isEmpty()) return Result("no_known_task", 0, 0)
        val pick: List<JSONObject> = when (kind) {
            "three" -> inAnswer.groupBy { it.getJSONObject("course").getLong("id") }.values.maxByOrNull { it.size }!!.take(3)
            else -> listOf(inAnswer.first())
        }
        val ids = pick.map { it.getLong("id") }.toSet()
        val kept = JSONArray()
        for (t in known) {
            val id = t.getLong("eventId")
            when {
                id !in ids -> kept.put(t)
                kind == "due" -> kept.put(JSONObject(t.toString()).put("dueAt", t.optLong("dueAt", nowSec()) - 3600))
                else -> Unit // left out: it reads as new
            }
        }
        baseline.put("tasks", kept)
        // Nothing far off or already announced stands in the way of the simulation.
        copy.put("farTaskSec", Long.MAX_VALUE / 4)
        baseline.put("announcedCms", JSONArray())
        val now = nowSec()
        val outcome = WatchCheck.detect(copy, WatchCheck.emptyOverlay(), now, results, radarIds) as? WatchCheck.Outcome.Ok ?: return Result("unsure", 0, 0)
        if (kind == "quiet") {
            // Two minutes of quiet hours: held now, one summary when they end.
            val quiet = JSONObject(copy.toString()).put("quiet", JSONObject().put("enabled", true).put("startMin", 0).put("endMin", 1439))
            val held = WatchCheck.notices(quiet, outcome.changes, emptyList(), now, minuteOfDay())
            store.setSimHeld(held.hold)
            WatchScheduler.simulation(context, 120, prefix)
            return Result("held", outcome.changes.size, 0)
        }
        val open = JSONObject(copy.toString()).put("quiet", JSONObject().put("enabled", false).put("startMin", 0).put("endMin", 0))
        val notices = WatchCheck.notices(open, outcome.changes, emptyList(), now, minuteOfDay())
        val channel = plan.getJSONObject("templates").getString("channel")
        notices.send.forEach { WatchNotifier.show(context, channel, it.copy(title = prefix + it.title)) }
        return Result("sent", outcome.changes.size, notices.send.size)
    }

    /** After the simulated quiet hours: what was held goes out as one summary. */
    fun flush(prefix: String) {
        val plan = store.plan() ?: return
        val held = store.simHeld()
        store.setSimHeld(emptyList())
        if (held.isEmpty()) return
        val open = JSONObject(plan.toString()).put("quiet", JSONObject().put("enabled", false).put("startMin", 0).put("endMin", 0))
        val notices = WatchCheck.notices(open, emptyList(), held, nowSec(), minuteOfDay())
        val channel = plan.getJSONObject("templates").getString("channel")
        notices.send.forEach { WatchNotifier.show(context, channel, it.copy(title = prefix + it.title)) }
    }

    /** The session marked ended (its blob deleted, Sulo's data kept) and the calm notice, now. */
    private fun expired(plan: JSONObject, prefix: String): Result {
        SessionVault.of(context).markExpired("dev_simulate")
        WatchScheduler.stop(context)
        val t = plan.getJSONObject("templates")
        val e = t.getJSONObject("expired")
        val id = "session|sim:${nowSec()}"
        WatchNotifier.show(context, t.getString("channel"), WatchCheck.Notice(id, WatchCheck.numericId(id), prefix + e.getString("title"), e.getString("body")))
        return Result("expired", 0, 1)
    }
}
