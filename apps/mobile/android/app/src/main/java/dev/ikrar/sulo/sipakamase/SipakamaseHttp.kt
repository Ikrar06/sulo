package dev.ikrar.sulo.sipakamase

import dev.ikrar.sulo.session.SikolaText
import java.net.HttpURLConnection
import java.net.URL

/**
 * GET only, to the five read paths only, with the vault's `session` cookie
 * and the Sulo User-Agent; redirects are never followed (a redirect means
 * the login page). The replaced cookie Sipakamase sets on every answer is
 * handed to [onCookie] as soon as the headers arrive. Nothing is logged;
 * the cookie never leaves this process.
 */
class SipakamaseHttp(private val userAgent: String, private val origin: String = Sipakamase.ORIGIN) {
    data class Reply(val status: Int, val location: String?, val body: String, val cookieAttrs: Sipakamase.CookieAttrs? = null)

    fun get(path: String, cookie: String, onCookie: (String) -> Unit): Reply {
        require(Sipakamase.isReadPath(path)) { "not a Sipakamase read path" }
        if (java.net.CookieHandler.getDefault() != null) java.net.CookieHandler.setDefault(null)
        val conn = URL("$origin$path").openConnection() as HttpURLConnection
        conn.instanceFollowRedirects = false
        conn.connectTimeout = 15_000
        conn.readTimeout = 30_000
        conn.useCaches = false
        conn.requestMethod = "GET"
        conn.setRequestProperty("User-Agent", userAgent)
        conn.setRequestProperty("Cookie", "${Sipakamase.SESSION_COOKIE}=$cookie")
        return try {
            val status = conn.responseCode
            val setCookies = conn.headerFields["Set-Cookie"] ?: conn.headerFields["set-cookie"]
            val seen = SikolaText.sessionCookie(setCookies, cookie, Sipakamase.SESSION_COOKIE)
            if (seen is SikolaText.SessionCookie.Replaced && status in 200..299) runCatching { onCookie(seen.value) }
            val stream = if (status in 200..299) conn.inputStream else conn.errorStream
            val body = stream?.bufferedReader()?.use { r ->
                // A fragment is a few kilobytes; never read more than this.
                val buf = CharArray(MAX_BODY)
                var n = 0
                while (n < MAX_BODY) {
                    val k = r.read(buf, n, MAX_BODY - n)
                    if (k < 0) break
                    n += k
                }
                String(buf, 0, n)
            } ?: ""
            Reply(status, conn.getHeaderField("Location"), body, Sipakamase.cookieAttrs(setCookies))
        } finally {
            conn.disconnect()
        }
    }

    companion object {
        const val MAX_BODY = 512 * 1024
    }
}
