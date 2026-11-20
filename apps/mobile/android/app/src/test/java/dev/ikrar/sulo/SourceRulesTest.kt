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
        for (r in reads) assertTrue(r, r.contains("Sikola.ORIGIN"))
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
        for (f in files.filter { it.path.contains("/neosia/") }) {
            val c = code(f)
            assertTrue(f.name, !c.contains("evaluateJavascript") && !c.contains("addJavascriptInterface"))
        }
    }

    @Test
    fun onlySikolaHttpOpensConnections() {
        val opening = files.filter { code(it).contains("openConnection(") }.map { it.name }.sorted()
        // SikolaHttp (SIKOLA only) and PublicConfig (the public data repo, no cookie, no identity).
        assertEquals(listOf("PublicConfig.kt", "SikolaHttp.kt"), opening)
    }
}
