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

    fun get(url: String, moodleSession: String): Reply = exchange(url, moodleSession, null)

    fun postJson(url: String, moodleSession: String, body: String): Reply = exchange(url, moodleSession, body)

    private fun exchange(url: String, moodleSession: String, body: String?): Reply {
        require(url.startsWith("${Sikola.ORIGIN}/")) { "SIKOLA only" }
        val conn = URL(url).openConnection() as HttpURLConnection
        conn.instanceFollowRedirects = false
        conn.connectTimeout = 15_000
        conn.readTimeout = 30_000
        conn.useCaches = false
        conn.setRequestProperty("User-Agent", userAgent)
        conn.setRequestProperty("Cookie", "${Sikola.SESSION_COOKIE}=$moodleSession")
        return try {
            if (body != null) {
                conn.requestMethod = "POST"
                conn.doOutput = true
                conn.setRequestProperty("Content-Type", "application/json")
                conn.outputStream.use { it.write(body.toByteArray(Charsets.UTF_8)) }
            }
            val status = conn.responseCode
            val stream = if (status in 200..299) conn.inputStream else conn.errorStream
            Reply(status, conn.getHeaderField("Location"), stream?.bufferedReader()?.use { it.readText() } ?: "", conn.getHeaderField("Retry-After"))
        } finally {
            conn.disconnect()
        }
    }
}
