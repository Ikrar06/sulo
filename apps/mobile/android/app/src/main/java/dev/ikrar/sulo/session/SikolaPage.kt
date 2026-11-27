package dev.ikrar.sulo.session

/**
 * HTML pages from SIKOLA (pure rules, no android.* here; unit-tested).
 * Only the attendance pages may be fetched for JavaScript, with id, mode
 * and view as the only parameters, all numbers; and an assignment's student
 * view ("Lihat nilai", 1.1.0) with its id and nothing else. /my/ is read natively for
 * the sesskey and never handed over. Before a page goes to JavaScript its
 * head, scripts, styles and forms are removed, and so is every sesskey.
 */
object SikolaPage {
    const val ATTENDANCE_PATH = "/mod/attendance/view.php"
    const val ASSIGN_PATH = "/mod/assign/view.php"
    private val ATTENDANCE_KEYS = setOf("id", "mode", "view")
    private val ASSIGN_KEYS = setOf("id")
    private val NUMBER = Regex("^[0-9]{1,10}$")

    /** The full URL for an allowlisted page path ("/mod/attendance/view.php?id=1&mode=1"), or null. */
    fun allowedUrl(path: String): String? {
        if (path.length > 200 || path.contains('#') || path.contains('%') || path.contains('\\')) return null
        val parts = path.split('?')
        if (parts.size != 2) return null
        val allowed = when (parts[0]) {
            ATTENDANCE_PATH -> ATTENDANCE_KEYS
            ASSIGN_PATH -> ASSIGN_KEYS
            else -> return null
        }
        val pairs = parts[1].split('&').map { it.split('=') }
        if (pairs.any { it.size != 2 }) return null
        val keys = pairs.map { it[0] }
        if (keys.toSet().size != keys.size || !allowed.containsAll(keys) || "id" !in keys) return null
        if (pairs.any { !NUMBER.matches(it[1]) }) return null
        return "${Sikola.ORIGIN}$path"
    }

    private val REMOVE = listOf(
        Regex("<head\\b[\\s\\S]*?</head>", RegexOption.IGNORE_CASE),
        Regex("<script\\b[\\s\\S]*?</script>", RegexOption.IGNORE_CASE),
        Regex("<style\\b[\\s\\S]*?</style>", RegexOption.IGNORE_CASE),
        Regex("<noscript\\b[\\s\\S]*?</noscript>", RegexOption.IGNORE_CASE),
        Regex("<template\\b[\\s\\S]*?</template>", RegexOption.IGNORE_CASE),
        Regex("<form\\b[\\s\\S]*?</form>", RegexOption.IGNORE_CASE),
        Regex("<(input|textarea|select|button)\\b[^>]*>", RegexOption.IGNORE_CASE),
        Regex("<!--[\\s\\S]*?-->"),
    )

    /** "sesskey" then = or : in any spelling Moodle uses: plain, quoted, or HTML-escaped (&quot; &#34; &#61; &#x3D; ...). */
    private val SESSKEY = Regex(
        "(sesskey(?:[\"']|&quot;|&#0*34;|&#x0*22;|&#0*39;|&#x0*27;|&apos;)?\\s*(?:[=:]|&#0*61;|&#x0*3d;|&#0*58;|&#x0*3a;|&equals;|&colon;|%3d|%3a)\\s*(?:[\"']|&quot;|&#0*34;|&#x0*22;|&#0*39;|&#x0*27;|&apos;)?)[A-Za-z0-9]+",
        RegexOption.IGNORE_CASE,
    )

    /**
     * What JavaScript may see of a page: no head, scripts, styles, forms or
     * inputs, and no sesskey. Three layers: the elements that carry one are
     * removed; every literal value in `secrets` (the vault's sesskey and the
     * one this page carries) is removed wherever it appears, plainly or as
     * HTML character references; and any "sesskey=..." left is blanked.
     */
    fun forJs(html: String, secrets: Collection<String> = emptyList()): String {
        val keys = (secrets + listOfNotNull(SikolaText.sesskey(html))).filter { it.length >= 8 }.toSet()
        var out = html
        for (re in REMOVE) out = re.replace(out, "")
        for (key in keys) {
            out = out.replace(key, "removed")
            out = out.replace(key.map { "&#${it.code};" }.joinToString(""), "removed")
            out = Regex(key.map { "&#x0*${Integer.toHexString(it.code)};" }.joinToString(""), RegexOption.IGNORE_CASE).replace(out, "removed")
        }
        return SESSKEY.replace(out) { "${it.groupValues[1]}removed" }
    }
}
