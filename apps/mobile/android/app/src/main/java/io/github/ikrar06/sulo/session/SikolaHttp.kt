package io.github.ikrar06.sulo.session

import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

/**
 * Native requests to SIKOLA with the stored session cookie. The cookie and
 * the sesskey stay in this process: callers get status codes and Moodle's
 * error codes, never a header or a value. Nothing is logged.
 */
class SikolaHttp(private val userAgent: String) {

    data class Page(val httpStatus: Int, val redirectedToLogin: Boolean, val html: String?)

    data class BatchResult(val httpStatus: Int, val accepted: Boolean, val errorcode: String?, val timeRemaining: Long?)

    /** One GET of a signed-in page (the extension's /my/ fallback does the same). */
    fun getPage(path: String, moodleSession: String): Page {
        val conn = open("${Sikola.ORIGIN}$path", moodleSession)
        conn.instanceFollowRedirects = false
        return try {
            val status = conn.responseCode
            val location = conn.getHeaderField("Location") ?: ""
            val toLogin = status in 300..399 && location.contains("/login/")
            val html = if (status == 200) conn.inputStream.bufferedReader().use { it.readText() } else null
            Page(status, toLogin, html)
        } finally {
            conn.disconnect()
        }
    }

    /** One batch POST to service.php with nosessionupdate=true: this check never extends the session. */
    fun sessionTimeRemaining(moodleSession: String, sesskey: String): BatchResult {
        val url = "${Sikola.ORIGIN}/lib/ajax/service.php?sesskey=$sesskey&info=core_session_time_remaining&nosessionupdate=true"
        val body = JSONArray().put(JSONObject().put("index", 0).put("methodname", "core_session_time_remaining").put("args", JSONObject())).toString()
        val conn = open(url, moodleSession)
        conn.requestMethod = "POST"
        conn.doOutput = true
        conn.setRequestProperty("Content-Type", "application/json")
        return try {
            conn.outputStream.use { it.write(body.toByteArray(Charsets.UTF_8)) }
            val status = conn.responseCode
            val text = (if (status in 200..299) conn.inputStream else conn.errorStream)?.bufferedReader()?.use { it.readText() } ?: ""
            parseBatch(status, text)
        } finally {
            conn.disconnect()
        }
    }

    private fun open(url: String, moodleSession: String): HttpURLConnection {
        val conn = URL(url).openConnection() as HttpURLConnection
        conn.connectTimeout = 15_000
        conn.readTimeout = 20_000
        conn.useCaches = false
        conn.setRequestProperty("User-Agent", userAgent)
        conn.setRequestProperty("Cookie", "${Sikola.SESSION_COOKIE}=$moodleSession")
        conn.setRequestProperty("Accept", "application/json, text/html")
        return conn
    }

    companion object {
        /** Moodle answers [{error:false,data:{...}}] or an error object; only codes come back. */
        fun parseBatch(status: Int, text: String): BatchResult {
            val trimmed = text.trim()
            return runCatching {
                if (trimmed.startsWith("[")) {
                    val first = JSONArray(trimmed).getJSONObject(0)
                    if (!first.optBoolean("error", true)) {
                        val data = first.optJSONObject("data")
                        BatchResult(status, true, null, data?.optLong("timeremaining"))
                    } else {
                        BatchResult(status, false, first.optJSONObject("exception")?.optString("errorcode")?.ifEmpty { null } ?: "error", null)
                    }
                } else {
                    BatchResult(status, false, JSONObject(trimmed).optString("errorcode").ifEmpty { "error" }, null)
                }
            }.getOrElse { BatchResult(status, false, "not_json", null) }
        }
    }
}
