package dev.ikrar.sulo.watch

import dev.ikrar.sulo.BuildConfig
import java.net.HttpURLConnection
import java.net.URL

/**
 * The one request the watch worker makes besides SIKOLA: config.json from
 * Sulo's public data repository, at most once per 6 hours (WatchRemote).
 * Plain GET with the Sulo user agent and, when the last good file had one,
 * If-None-Match. No cookie, no other header, no parameter: nothing about the
 * user. No redirect is followed, the body is capped, nothing is logged.
 */
object PublicConfig {
    const val OFFICIAL_URL = "https://ikrar06.github.io/sulo-data/config.json"
    /** Debug builds only: the dev screen's test config, from the same repository. */
    private const val TEST_PREFIX = "https://raw.githubusercontent.com/Ikrar06/sulo-data/"
    private const val MAX_BYTES = 64 * 1024

    data class Reply(val status: Int, val body: String?, val etag: String?)

    /** The plan's URL only in a debug build and only from Sulo's own repository; otherwise the official file. */
    fun urlFor(planUrl: String?, debug: Boolean = BuildConfig.DEBUG): String =
        if (debug && planUrl != null && planUrl.startsWith(TEST_PREFIX) && !planUrl.contains("@") && !planUrl.contains("..")) planUrl else OFFICIAL_URL

    /** status 0: the network failed (a failed read). */
    fun fetch(url: String, etag: String?, userAgent: String): Reply {
        require(url == OFFICIAL_URL || url.startsWith(TEST_PREFIX)) { "Sulo data only" }
        return try {
            val conn = URL(url).openConnection() as HttpURLConnection
            conn.instanceFollowRedirects = false
            conn.connectTimeout = 15_000
            conn.readTimeout = 20_000
            conn.useCaches = false
            conn.setRequestProperty("User-Agent", userAgent)
            if (etag != null) conn.setRequestProperty("If-None-Match", etag)
            try {
                val status = conn.responseCode
                val body = if (status == 200) conn.inputStream.use { input ->
                    val bytes = input.readNBytesCompat(MAX_BYTES + 1)
                    if (bytes.size > MAX_BYTES) null else String(bytes, Charsets.UTF_8)
                } else null
                Reply(status, body, conn.getHeaderField("ETag"))
            } finally {
                conn.disconnect()
            }
        } catch (e: Exception) {
            Reply(0, null, null)
        }
    }

    private fun java.io.InputStream.readNBytesCompat(limit: Int): ByteArray {
        val out = java.io.ByteArrayOutputStream()
        val buf = ByteArray(8192)
        while (out.size() < limit) {
            val n = read(buf, 0, minOf(buf.size, limit - out.size()))
            if (n < 0) break
            out.write(buf, 0, n)
        }
        return out.toByteArray()
    }
}
