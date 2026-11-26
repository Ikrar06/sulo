package dev.ikrar.sulo

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

/**
 * Rules read from the native sources themselves (owner's rules, 20 Nov 2026):
 * Sulo's code never reads NEOSIA's cookies or token, never sends a request to
 * NEOSIA, and the NEOSIA screen never runs code in the page.
 */
class SourceRulesTest {
    private val root = File("src/main/java/dev/ikrar/sulo")
    private val files = root.walkTopDown().filter { it.isFile && it.extension in setOf("kt", "java") }.toList()
    private fun code(f: File) = f.readLines().filterNot { it.trim().startsWith("*") || it.trim().startsWith("//") || it.trim().startsWith("/**") }.joinToString("\n")

    @Test
    fun theSourcesAreThere() = assertTrue(files.size > 20)

    @Test
    fun cookiesAreOnlyEverReadForSikola() {
        val reads = files.flatMap { f -> Regex("""getCookie\(([^)]*)\)""").findAll(code(f)).map { "${f.name}: ${it.groupValues[1]}" }.toList() }
        assertTrue("no CookieManager read at all is unexpected", reads.isNotEmpty())
        // The sign-in screen reads the cookie of its own site only, and its sites are SIKOLA and Sipakamase (1.1.0).
        for (r in reads) assertTrue(r, r.contains("Sikola.ORIGIN") || r == "LoginActivity.kt: site.origin")
        val login = code(files.single { it.name == "LoginActivity.kt" })
        val origins = Regex("Site\\(\\s*(\\w+)\\.HOST, (\\w+)\\.ORIGIN").findAll(login).map { it.groupValues[2] }.toSet()
        assertEquals(setOf("Sikola", "Sipakamase"), origins)
    }

    @Test
    fun noNeosiaTokenOrStorageIsReadNatively() {
        for (f in files) {
            val c = code(f)
            assertTrue(f.name, !c.contains("access_token") && !c.contains("localStorage") && !c.contains("secure__ls"))
        }
    }

    @Test
    fun theNeosiaScreenNeverRunsCodeInThePage() {
        // NEOSIA's screen and hidden visit, Sipakamase, and the sign-in screen: no code of Sulo's run in a page by these means.
        for (f in files.filter { it.path.contains("/neosia/") || it.path.contains("/sipakamase/") || it.name == "LoginActivity.kt" }) {
            val c = code(f)
            assertTrue(f.name, !c.contains("evaluateJavascript") && !c.contains("addJavascriptInterface"))
        }
    }

    @Test
    fun onlySikolaHttpOpensConnections() {
        val opening = files.filter { code(it).contains("openConnection(") }.map { it.name }.sorted()
        // SikolaHttp (SIKOLA only), PublicConfig (the public data repo, no cookie, no identity)
        // and SipakamaseHttp (1.1.0: GET to its five read paths only, refused before connecting otherwise).
        assertEquals(listOf("PublicConfig.kt", "SikolaHttp.kt", "SipakamaseHttp.kt"), opening)
    }
}
