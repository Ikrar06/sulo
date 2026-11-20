package dev.ikrar.sulo.neosia

import dev.ikrar.sulo.neosia.NeosiaRules.Verdict
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class NeosiaRulesTest {
    private val home = "https://neosia.unhas.ac.id/"
    private val capture = """{"type":"sulo:capture:v1","v":2,"endpoint":"dashboard","status":"ok","data":{},"at":1}"""

    @Test
    fun theLoginPageNeverGetsTheScript() {
        assertFalse(NeosiaRules.scriptFor(NeosiaRules.Page.LOGIN))
        for (page in NeosiaRules.Page.entries) if (page != NeosiaRules.Page.LOGIN) assertTrue(page.name, NeosiaRules.scriptFor(page))
        // Every page that gets the script is not a login URL.
        for (page in NeosiaRules.Page.entries) assertEquals(page.name, !page.script, NeosiaRules.isLogin(NeosiaRules.url(page)))
    }

    @Test
    fun loginUrlsAreRecognised() {
        assertTrue(NeosiaRules.isLogin("https://neosia.unhas.ac.id/login"))
        assertTrue(NeosiaRules.isLogin("https://neosia.unhas.ac.id/login?next=%2F"))
        assertTrue(NeosiaRules.isLogin("https://neosia.unhas.ac.id/login/sso"))
        assertFalse(NeosiaRules.isLogin("https://neosia.unhas.ac.id/loginx"))
        assertFalse(NeosiaRules.isLogin("https://neosia.unhas.ac.id/kartu-hasil-studi"))
        assertFalse(NeosiaRules.isLogin("https://evil.example/login"))
        assertFalse(NeosiaRules.isLogin(null))
    }

    @Test
    fun messagesFromAnotherOriginAreRefused() {
        assertEquals(Verdict.OTHER_ORIGIN, NeosiaRules.judge("https://evil.example", true, home, capture))
        assertEquals(Verdict.OTHER_ORIGIN, NeosiaRules.judge("http://neosia.unhas.ac.id", true, home, capture))
        assertEquals(Verdict.OTHER_ORIGIN, NeosiaRules.judge("https://api.neosia.unhas.ac.id", true, home, capture))
        assertEquals(Verdict.OTHER_ORIGIN, NeosiaRules.judge(null, true, home, capture))
    }

    @Test
    fun messagesOver256KiBAreRefused() {
        val big = capture.dropLast(1) + ",\"pad\":\"" + "x".repeat(NeosiaRules.MAX_MESSAGE_BYTES) + "\"}"
        assertEquals(Verdict.TOO_BIG, NeosiaRules.judge(NeosiaRules.ORIGIN, true, home, big))
        // Exactly at the limit is still taken.
        val pad = NeosiaRules.MAX_MESSAGE_BYTES - capture.length - ",\"p\":\"\"".length
        val atLimit = capture.dropLast(1) + ",\"p\":\"" + "x".repeat(pad) + "\"}"
        assertEquals(NeosiaRules.MAX_MESSAGE_BYTES, atLimit.toByteArray(Charsets.UTF_8).size)
        assertEquals(Verdict.ACCEPT, NeosiaRules.judge(NeosiaRules.ORIGIN, true, home, atLimit))
    }

    @Test
    fun onlyCaptureMessagesFromTheMainFrameOffTheLoginPage() {
        assertEquals(Verdict.ACCEPT, NeosiaRules.judge(NeosiaRules.ORIGIN, true, home, capture))
        assertEquals(Verdict.NOT_MAIN_FRAME, NeosiaRules.judge(NeosiaRules.ORIGIN, false, home, capture))
        assertEquals(Verdict.ON_LOGIN, NeosiaRules.judge(NeosiaRules.ORIGIN, true, "https://neosia.unhas.ac.id/login", capture))
        assertEquals(Verdict.NOT_CAPTURE, NeosiaRules.judge(NeosiaRules.ORIGIN, true, home, """{"type":"other"}"""))
        assertEquals(Verdict.NOT_CAPTURE, NeosiaRules.judge(NeosiaRules.ORIGIN, true, home, null))
    }

    @Test
    fun theScreenStaysOnNeosia() {
        assertTrue(NeosiaRules.stays("https://neosia.unhas.ac.id/kartu-hasil-studi"))
        assertFalse(NeosiaRules.stays("http://neosia.unhas.ac.id/"))
        assertFalse(NeosiaRules.stays("https://example.com/"))
        assertFalse(NeosiaRules.stays("intent://scan"))
    }

    @Test
    fun theTrialKeepsLabelsNotData() {
        assertEquals("dashboard (ok)", NeosiaRules.label(capture))
        assertEquals("api.neosia.unhas.ac.id/api/mahasiswa/:n/khs", NeosiaRules.scrub("https://api.neosia.unhas.ac.id/api/mahasiswa/123/khs?nim=x"))
        assertNull(NeosiaRules.scrub("https://example.com/a"))
    }

    @Test
    fun onlyKnownPagesOpen() {
        assertEquals(NeosiaRules.Page.KHS, NeosiaRules.page("khs"))
        assertNull(NeosiaRules.page("mahasiswa/mahasiswa"))
        assertNull(NeosiaRules.page(null))
    }
}
