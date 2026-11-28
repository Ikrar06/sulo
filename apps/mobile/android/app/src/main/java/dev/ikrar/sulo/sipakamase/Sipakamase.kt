package dev.ikrar.sulo.sipakamase

import java.net.URI

/**
 * Sipakamase's address and the pure rules Sulo applies to it (core
 * sipakamase/allowlist.ts, the same five paths). Unit-tested without Android.
 * The site changes data with plain GETs, so nothing here builds an address
 * from a page: the paths are constants.
 */
object Sipakamase {
    const val ORIGIN = "https://sipakamase.unhas.ac.id"
    const val HOST = "sipakamase.unhas.ac.id"
    const val SESSION_COOKIE = "session"
    /** Where the sign-in screen starts; Sipakamase sends it to its login when there is no session. */
    const val ENTRY_URL = "$ORIGIN/home"

    val READ_PATHS = listOf(
        "/caktifitasmahasiswa/content",
        "/caktifitas/content",
        "/ckonversimhs/matakuliah",
        "/cklaim/content",
        "/ckonversimhs/rekappoin",
    )

    /** One of the five exact paths: no query, no fragment, nothing appended. */
    fun isReadPath(path: String): Boolean = path in READ_PATHS

    /** The student's pages after signing in; the login page is none of them. */
    private val SIGNED_IN = listOf("/home", "/caktifitasmahasiswa", "/caktifitas", "/ckonversimhs", "/cklaim")

    fun isSignedInPage(url: String?): Boolean {
        val uri = url?.let { runCatching { URI(it) }.getOrNull() } ?: return false
        if (uri.scheme != "https" || uri.host != HOST) return false
        val path = uri.path ?: return false
        return SIGNED_IN.any { path == it || path.startsWith("$it/") }
    }

    /** A page that asks for a password is the login page: the session is gone. */
    private val PASSWORD = Regex("""<input[^>]*type\s*=\s*["']?password""", RegexOption.IGNORE_CASE)
    fun isLoginPage(html: String): Boolean = PASSWORD.containsMatchIn(html)

    /**
     * The attributes of the session cookie a response set: whether it carries Expires, and its Max-Age
     * (owner's decision of 26 Nov 2026: Sulo notes how long Sipakamase says its session lasts). Only the
     * attribute names and the Max-Age number are read, never the cookie's value. Null: no session cookie set.
     */
    data class CookieAttrs(val expires: Boolean, val maxAge: Long?)

    fun cookieAttrs(setCookies: List<String>?): CookieAttrs? {
        val header = setCookies?.firstOrNull { it.trimStart().startsWith("$SESSION_COOKIE=") } ?: return null
        val attrs = header.split(';').drop(1).map { it.trim().lowercase() }
        val maxAge = attrs.firstOrNull { it.startsWith("max-age=") }?.substringAfter('=')?.trim()?.toLongOrNull()
        return CookieAttrs(attrs.any { it.startsWith("expires=") }, maxAge)
    }
}
