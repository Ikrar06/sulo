package dev.ikrar.sulo.neosia

import java.net.URI

/**
 * The NEOSIA screen's rules (M8d), pure so the JVM tests can hold them
 * (NeosiaRulesTest): which pages Sulo opens, which of them get the capture
 * script (never the login page), where the WebView may go, and which bridge
 * messages are taken.
 *
 * Sulo makes no request to NEOSIA (CLAUDE.md, mobile rule 4): it only opens
 * NEOSIA's own pages from a tap, and reads what those pages already asked for.
 */
object NeosiaRules {
    const val ORIGIN = "https://neosia.unhas.ac.id"
    const val HOST = "neosia.unhas.ac.id"
    const val API_HOST = "api.neosia.unhas.ac.id"
    /** The WebMessageListener object the page script posts to. */
    const val PORT = "SuloNeosia"
    /** The same limit as the extension (core neosia/allowlist.ts MAX_MESSAGE_CHARS): 256 KiB. */
    const val MAX_MESSAGE_BYTES = 262_144
    const val CAPTURE_TYPE = "sulo:capture:v1"

    /** The pages Sulo opens (core links.ts); only these, from a tap. The login page never gets the script. */
    enum class Page(val path: String, val script: Boolean) {
        LOGIN("/login", false),
        HOME("/", true),
        KHS("/kartu-hasil-studi", true),
        KRS("/kartu-rencana-studi", true),
        TRANSKRIP("/transkrip-nilai", true),
        MATAKULIAH("/matakuliah", true),
    }

    fun page(id: String?): Page? = Page.entries.firstOrNull { it.name.equals(id, ignoreCase = true) }

    fun url(page: Page): String = ORIGIN + page.path

    private fun uri(url: String?): URI? = url?.let { runCatching { URI(it) }.getOrNull() }

    /** NEOSIA's login page, or anything under it. */
    fun isLogin(url: String?): Boolean {
        val u = uri(url) ?: return false
        if (u.scheme != "https" || u.host != HOST) return false
        val path = u.path ?: ""
        return path == "/login" || path.startsWith("/login/")
    }

    /** The screen shows NEOSIA's own pages only (https, its host); any other link is not followed. */
    fun stays(url: String?): Boolean {
        val u = uri(url) ?: return false
        return u.scheme == "https" && u.host == HOST
    }

    /** Whether the capture script may be added when Sulo opens this page. */
    fun scriptFor(page: Page): Boolean = page.script

    enum class Verdict { ACCEPT, OTHER_ORIGIN, NOT_MAIN_FRAME, TOO_BIG, NOT_CAPTURE, ON_LOGIN }

    /**
     * A message from the page: taken only from NEOSIA's origin, the main frame,
     * not while the page is the login page, at most 256 KiB, and a capture message.
     */
    fun judge(origin: String?, mainFrame: Boolean, pageUrl: String?, data: String?): Verdict {
        if (origin != ORIGIN) return Verdict.OTHER_ORIGIN
        if (!mainFrame) return Verdict.NOT_MAIN_FRAME
        if (isLogin(pageUrl)) return Verdict.ON_LOGIN
        if (data == null) return Verdict.NOT_CAPTURE
        if (data.toByteArray(Charsets.UTF_8).size > MAX_MESSAGE_BYTES) return Verdict.TOO_BIG
        if (!data.startsWith("{") || !data.contains("\"$CAPTURE_TYPE\"")) return Verdict.NOT_CAPTURE
        return Verdict.ACCEPT
    }

    private val ENDPOINT = Regex("\"endpoint\"\\s*:\\s*\"([A-Za-z0-9_./-]{1,80})\"")
    private val STATUS = Regex("\"status\"\\s*:\\s*\"(ok|unknown_shape)\"")

    /** The trial's label for an accepted message: its endpoint id and status, nothing of its data. */
    fun label(data: String): String {
        val endpoint = ENDPOINT.find(data)?.groupValues?.get(1) ?: "?"
        val status = STATUS.find(data)?.groupValues?.get(1) ?: "?"
        return "$endpoint ($status)"
    }

    /** The debug request counter's key: NEOSIA's hosts only, the path with numbers replaced, no query. */
    fun scrub(url: String?): String? {
        val u = uri(url) ?: return null
        val host = u.host ?: return null
        if (host != HOST && host != API_HOST) return null
        return host + (u.path ?: "").replace(Regex("\\d+"), ":n")
    }
}
