package dev.ikrar.sulo.session

import org.json.JSONArray
import org.json.JSONObject

/** Pure rules for requests to SIKOLA (no android.* here; unit-tested). */
object SikolaRequest {
    /** The same five read-only functions as the extension (packages/core/src/moodle/calls.ts). */
    val ALLOWED = setOf(
        "core_session_time_remaining",
        "core_calendar_get_action_events_by_timesort",
        "core_courseformat_get_state",
        "message_popup_get_popup_notifications",
        "core_course_get_enrolled_courses_by_timeline_classification",
    )

    /**
     * nosessionupdate: false only for a sync the user started (opening the
     * app, pull to refresh, "Perbarui"), which is real activity. Everything
     * else leaves the session alone. Never a request just to keep it alive.
     */
    fun noSessionUpdate(userInitiated: Boolean): Boolean = !userInitiated

    /** The function names of a batch body, or null when it is not a valid, allowlisted batch. */
    fun allowedFunctions(body: String): List<String>? = runCatching {
        val array = JSONArray(body)
        if (array.length() == 0) return null
        (0 until array.length()).map { i ->
            val name = array.getJSONObject(i).getString("methodname")
            if (name !in ALLOWED) return null
            name
        }
    }.getOrNull()

    fun batchUrl(sesskey: String, functions: List<String>, userInitiated: Boolean): String {
        val info = functions.joinToString(",")
        val tail = if (noSessionUpdate(userInitiated)) "&nosessionupdate=true" else ""
        return "${Sikola.ORIGIN}/lib/ajax/service.php?sesskey=$sesskey&info=$info$tail"
    }

    /** Moodle's "please log in again": the session is over. */
    fun loginRequired(body: String): Boolean = errorcodes(body).any { it == "servicerequireslogin" || it == "requireloginerror" }

    fun invalidSesskey(body: String): Boolean = "invalidsesskey" in errorcodes(body)

    /**
     * Moodle's error codes, from where Moodle puts them only: the top-level
     * object's errorcode, or exception.errorcode of a result with error=true.
     * Text inside course data never counts (a task named "servicerequireslogin"
     * must not end the session).
     */
    fun errorcodes(body: String): List<String> = runCatching {
        val text = body.trim()
        when {
            text.startsWith("[") -> {
                val array = JSONArray(text)
                (0 until array.length()).mapNotNull { i ->
                    val item = array.optJSONObject(i) ?: return@mapNotNull null
                    if (item.optBoolean("error", false)) item.optJSONObject("exception")?.optString("errorcode")?.ifEmpty { null } else null
                }
            }
            text.startsWith("{") -> listOfNotNull(JSONObject(text).optString("errorcode").ifEmpty { null })
            else -> emptyList()
        }
    }.getOrDefault(emptyList())
}
