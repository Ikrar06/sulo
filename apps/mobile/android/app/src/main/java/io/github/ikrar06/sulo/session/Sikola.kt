package io.github.ikrar06.sulo.session

import java.net.URI

/** SIKOLA's address and the pure rules SuloSession applies to it. */
object Sikola {
    const val ORIGIN = "https://sikola-v2.unhas.ac.id"
    const val HOST = "sikola-v2.unhas.ac.id"
    const val LOGIN_URL = "$ORIGIN/login/index.php"
    const val SESSION_COOKIE = "MoodleSession"

    /** A SIKOLA page that is not part of the login flow (/login/...). */
    fun isSignedInPage(url: String?): Boolean {
        val uri = url?.let { runCatching { URI(it) }.getOrNull() } ?: return false
        if (uri.scheme != "https" || uri.host != HOST) return false
        val path = uri.path ?: "/"
        return !(path == "/login" || path.startsWith("/login/"))
    }
}

/** Pure helpers, unit-tested without Android (no android.* in this file). */
object SikolaText {
    private val SESSKEY = Regex("^[A-Za-z0-9]{8,32}$")
    private val INPUT = Regex("""<input[^>]*name=["']sesskey["'][^>]*value=["']([^"']+)["']|<input[^>]*value=["']([^"']+)["'][^>]*name=["']sesskey["']""", RegexOption.IGNORE_CASE)
    private val LINK = Regex("""[?&]sesskey=([A-Za-z0-9]{8,32})""")

    /** The sesskey on a signed-in page, the same way the extension's content script finds it. */
    fun sesskey(html: String): String? {
        INPUT.findAll(html).forEach { m ->
            val v = m.groupValues[1].ifEmpty { m.groupValues[2] }
            if (SESSKEY.matches(v)) return v
        }
        return LINK.find(html)?.groupValues?.get(1)
    }

    /** "a=1; MoodleSession=x; b=2" -> the value of one cookie. */
    fun cookieValue(header: String?, name: String): String? =
        header?.split(';')?.map { it.trim() }?.firstOrNull { it.startsWith("$name=") }?.substringAfter('=')?.takeIf { it.isNotEmpty() }

    /** Cookie names only, for diagnostics (never values). */
    fun cookieNames(header: String?): List<String> =
        header?.split(';')?.mapNotNull { it.trim().substringBefore('=').takeIf { n -> n.isNotEmpty() } }?.sorted() ?: emptyList()
}
