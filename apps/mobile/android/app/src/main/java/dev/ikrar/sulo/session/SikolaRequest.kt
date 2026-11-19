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

    /**
     * The background watching check (M8c.3, owner's decision of 18 Nov
     * 2026): only while the user has "Pantau tugas baru" on and the remote
     * config allows it (the worker runs only then), it keeps the session
     * active on purpose, so it sends nosessionupdate=false like a sync the
     * user started. No other request does.
     */
    fun watchBatchUrl(sesskey: String, functions: List<String>): String = batchUrl(sesskey, functions, userInitiated = true)

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

    /**
     * Moodle's "please log in again": the session is over. Read the way core
     * reads it (packages/core/src/moodle/client.ts interpretBatch): only a
     * top-level error, or an error on core_session_time_remaining itself.
     * An error on another call is that call's own: requireloginerror on one
     * course's get_state means that course can't be opened (hidden, enrolment
     * ended), not that the user is signed out. Moodle stops the batch at the
     * first error, so the calls after it simply have no answer.
     */
    fun loginRequired(body: String, functions: List<String>): Boolean = sessionCodes(body, functions).any { it in LOGIN_CODES }

    fun invalidSesskey(body: String, functions: List<String>): Boolean = "invalidsesskey" in sessionCodes(body, functions)

    private val LOGIN_CODES = setOf("servicerequireslogin", "requireloginerror")

    /** The error codes that speak for the whole session: top-level, or core_session_time_remaining's own. */
    fun sessionCodes(body: String, functions: List<String>): List<String> {
        val text = body.trim()
        return runCatching {
            when {
                text.startsWith("{") -> listOfNotNull(JSONObject(text).optString("errorcode").ifEmpty { null })
                text.startsWith("[") -> {
                    val at = functions.indexOf("core_session_time_remaining")
                    val item = if (at >= 0) JSONArray(text).optJSONObject(at) else null
                    listOfNotNull(item?.takeIf { it.optBoolean("error", false) }?.optJSONObject("exception")?.optString("errorcode")?.ifEmpty { null })
                }
                else -> emptyList()
            }
        }.getOrDefault(emptyList())
    }
}
