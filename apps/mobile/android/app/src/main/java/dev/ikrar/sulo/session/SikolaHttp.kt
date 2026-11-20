package dev.ikrar.sulo.session

import java.net.HttpURLConnection
import java.net.URL

/**
 * Native requests to SIKOLA with the stored session cookie and the Sulo
 * User-Agent. The cookie and the sesskey never leave this process. Nothing
 * is logged.
 */
class SikolaHttp(private val userAgent: String) {
    data class Reply(val status: Int, val location: String?, val body: String, val retryAfter: String? = null)

    /**
     * Called as soon as the headers arrive, before the body is read, with
     * what Set-Cookie said about MoodleSession: a replaced cookie is saved
     * right then (owner's rule, 20 Nov 2026), so a process ended mid-body
     * cannot leave the vault on an old one.
     */
    fun interface CookieWatch {
        fun seen(cookie: SikolaText.SessionCookie)
    }

    /** Debug builds: told the NAMES of the response's headers and of the cookies it sets (never a value). */
    var namesSeen: ((headers: List<String>, setCookies: List<String>) -> Unit)? = null

    fun get(url: String, moodleSession: String, watch: CookieWatch? = null, fresh: Boolean = false): Reply = exchange(url, moodleSession, null, watch, fresh)

    fun postJson(url: String, moodleSession: String, body: String, watch: CookieWatch? = null, fresh: Boolean = false): Reply = exchange(url, moodleSession, body, watch, fresh)

    /** `fresh`: a new connection, closed after (the second ask before a session ends; owner's rule, 20 Nov 2026). */
    private fun exchange(url: String, moodleSession: String, body: String?, watch: CookieWatch?, fresh: Boolean): Reply {
        require(url.startsWith("${Sikola.ORIGIN}/")) { "SIKOLA only" }
        val conn = URL(url).openConnection() as HttpURLConnection
        conn.instanceFollowRedirects = false
        conn.connectTimeout = 15_000
        conn.readTimeout = 30_000
        conn.useCaches = false
        conn.setRequestProperty("User-Agent", userAgent)
        conn.setRequestProperty("Cookie", "${Sikola.SESSION_COOKIE}=$moodleSession")
        if (fresh) conn.setRequestProperty("Connection", "close")
        return try {
            if (body != null) {
                conn.requestMethod = "POST"
                conn.doOutput = true
                conn.setRequestProperty("Content-Type", "application/json")
                conn.outputStream.use { it.write(body.toByteArray(Charsets.UTF_8)) }
            }
            val status = conn.responseCode
            val setCookies = conn.headerFields["Set-Cookie"] ?: conn.headerFields["set-cookie"]
            runCatching { watch?.seen(SikolaText.sessionCookie(setCookies, moodleSession)) }
            runCatching { namesSeen?.invoke(conn.headerFields.keys.filterNotNull(), setCookies.orEmpty().map { it.substringBefore('=').trim() }) }
            val stream = if (status in 200..299) conn.inputStream else conn.errorStream
            Reply(status, conn.getHeaderField("Location"), stream?.bufferedReader()?.use { it.readText() } ?: "", conn.getHeaderField("Retry-After"))
        } finally {
            conn.disconnect()
        }
    }
}
