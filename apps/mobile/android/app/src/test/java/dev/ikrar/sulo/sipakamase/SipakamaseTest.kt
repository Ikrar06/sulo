package dev.ikrar.sulo.sipakamase

import dev.ikrar.sulo.session.SikolaText
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class SipakamaseTest {
    @Test
    fun onlyTheFiveExactReadPaths() {
        for (p in Sipakamase.READ_PATHS) assertTrue(p, Sipakamase.isReadPath(p))
        // Every address known to change data or end the session (core sipakamase/allowlist.ts).
        for (p in listOf("/caktifitasmahasiswa/delete/x.y", "/ckonversimhs/sksmk/a/b/c", "/home/clearnotify", "/logout", "/caktifitas/final/x", "/caktifitasmahasiswa/halamanedit/x", "/caktifitasmahasiswa/pilihbasis", "/home", "/ckonversimhs/detail")) {
            assertFalse(p, Sipakamase.isReadPath(p))
        }
        for (p in listOf("/cklaim/content?x=1", "/cklaim/content/", "/cklaim/content#a", "/CKLAIM/content", "")) assertFalse(p, Sipakamase.isReadPath(p))
    }

    @Test
    fun theClientRefusesAnyOtherPathBeforeConnecting() {
        val http = SipakamaseHttp("test", origin = "https://127.0.0.1:1")
        var refused = false
        try {
            http.get("/logout", "c") {}
        } catch (e: IllegalArgumentException) {
            refused = true
        }
        assertTrue(refused)
    }

    @Test
    fun signedInPagesAreTheStudentsOwnNeverTheLogin() {
        assertTrue(Sipakamase.isSignedInPage("https://sipakamase.unhas.ac.id/home"))
        assertTrue(Sipakamase.isSignedInPage("https://sipakamase.unhas.ac.id/cklaim"))
        assertFalse(Sipakamase.isSignedInPage("https://sipakamase.unhas.ac.id/"))
        assertFalse(Sipakamase.isSignedInPage("https://sipakamase.unhas.ac.id/login"))
        assertFalse(Sipakamase.isSignedInPage("http://sipakamase.unhas.ac.id/home"))
        assertFalse(Sipakamase.isSignedInPage("https://sipakamase.unhas.ac.id.evil.test/home"))
    }

    @Test
    fun readsTheSessionCookieByItsOwnName() {
        val set = listOf("session=new.value; HttpOnly; Path=/")
        assertEquals(SikolaText.SessionCookie.Replaced("new.value"), SikolaText.sessionCookie(set, "old", Sipakamase.SESSION_COOKIE))
        assertEquals(SikolaText.SessionCookie.Absent, SikolaText.sessionCookie(set, "old"))
    }

    @Test
    fun knowsTheLoginPage() {
        assertTrue(Sipakamase.isLoginPage("<form><input type=\"password\" name=\"p\"></form>"))
        assertFalse(Sipakamase.isLoginPage("<table><tr><th>Aksi</th></tr></table>"))
    }

    @Test
    fun readsOnlyTheSessionCookiesAttributesNeverItsValue() {
        assertEquals(null, Sipakamase.cookieAttrs(null))
        assertEquals(null, Sipakamase.cookieAttrs(listOf("_ga=x; Max-Age=100")))
        assertEquals(Sipakamase.CookieAttrs(false, null), Sipakamase.cookieAttrs(listOf("session=abc; HttpOnly; Path=/")))
        assertEquals(Sipakamase.CookieAttrs(true, 3600L), Sipakamase.cookieAttrs(listOf("session=abc; Expires=Thu, 27 Nov 2026 10:00:00 GMT; Max-Age=3600; HttpOnly")))
    }
}
