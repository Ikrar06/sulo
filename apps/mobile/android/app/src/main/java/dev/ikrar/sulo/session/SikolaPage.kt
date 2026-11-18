package dev.ikrar.sulo.session

/**
 * HTML pages from SIKOLA (pure rules, no android.* here; unit-tested).
 * Only the attendance pages may be fetched for JavaScript, with id, mode
 * and view as the only parameters, all numbers. /my/ is read natively for
 * the sesskey and never handed over. Before a page goes to JavaScript its
 * head, scripts, styles and forms are removed, and so is every sesskey.
 */
object SikolaPage {
    const val ATTENDANCE_PATH = "/mod/attendance/view.php"
    private val ATTENDANCE_KEYS = setOf("id", "mode", "view")
    private val NUMBER = Regex("^[0-9]{1,10}$")

    /** The full URL for an allowlisted page path ("/mod/attendance/view.php?id=1&mode=1"), or null. */
    fun allowedUrl(path: String): String? {
        if (path.length > 200 || path.contains('#') || path.contains('%') || path.contains('\\')) return null
        val parts = path.split('?')
        if (parts.size != 2 || parts[0] != ATTENDANCE_PATH) return null
        val pairs = parts[1].split('&').map { it.split('=') }
        if (pairs.any { it.size != 2 }) return null
        val keys = pairs.map { it[0] }
        if (keys.toSet().size != keys.size || !ATTENDANCE_KEYS.containsAll(keys) || "id" !in keys) return null
        if (pairs.any { !NUMBER.matches(it[1]) }) return null
        return "${Sikola.ORIGIN}$path"
    }

    private val REMOVE = listOf(
        Regex("<head\\b[\\s\\S]*?</head>", RegexOption.IGNORE_CASE),
        Regex("<script\\b[\\s\\S]*?</script>", RegexOption.IGNORE_CASE),
        Regex("<style\\b[\\s\\S]*?</style>", RegexOption.IGNORE_CASE),
        Regex("<noscript\\b[\\s\\S]*?</noscript>", RegexOption.IGNORE_CASE),
        Regex("<form\\b[\\s\\S]*?</form>", RegexOption.IGNORE_CASE),
        Regex("<!--[\\s\\S]*?-->"),
    )
    private val SESSKEY = Regex("(sesskey[\"']?\\s*[=:]\\s*[\"']?)[A-Za-z0-9]+", RegexOption.IGNORE_CASE)

    /** What JavaScript may see of a page: no head, scripts, styles, forms or sesskey. */
    fun forJs(html: String): String {
        var out = html
        for (re in REMOVE) out = re.replace(out, "")
        return SESSKEY.replace(out) { "${it.groupValues[1]}removed" }
    }
}
