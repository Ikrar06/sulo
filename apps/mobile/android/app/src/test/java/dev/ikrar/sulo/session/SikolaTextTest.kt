package dev.ikrar.sulo.session

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class SikolaTextTest {
    @Test
    fun sesskeyFromHiddenInputOrLink() {
        assertEquals("AbC123xyZ0", SikolaText.sesskey("""<form><input type="hidden" name="sesskey" value="AbC123xyZ0"></form>"""))
        assertEquals("AbC123xyZ0", SikolaText.sesskey("""<input value="AbC123xyZ0" name="sesskey" type="hidden">"""))
        assertEquals("Q1w2E3r4T5", SikolaText.sesskey("""<a href="https://sikola-v2.unhas.ac.id/login/logout.php?sesskey=Q1w2E3r4T5">Keluar</a>"""))
        assertNull(SikolaText.sesskey("""<form action="/login/index.php"><input name="password" type="password"></form>"""))
        assertNull(SikolaText.sesskey("""<input name="sesskey" value="short">"""))
    }

    @Test
    fun cookieValue() {
        val header = "MOODLEID1_=x; MoodleSession=abcdef123456; BIGipServer=y"
        assertEquals("abcdef123456", SikolaText.cookieValue(header, "MoodleSession"))
        assertNull(SikolaText.cookieValue("other=1", "MoodleSession"))
        assertNull(SikolaText.cookieValue(null, "MoodleSession"))
    }

    @Test
    fun signedInPagesExcludeTheLoginFlow() {
        assertTrue(Sikola.isSignedInPage("https://sikola-v2.unhas.ac.id/my/"))
        assertTrue(Sikola.isSignedInPage("https://sikola-v2.unhas.ac.id/"))
        assertFalse(Sikola.isSignedInPage("https://sikola-v2.unhas.ac.id/login/index.php"))
        assertFalse(Sikola.isSignedInPage("https://sikola-v2.unhas.ac.id/login"))
        assertFalse(Sikola.isSignedInPage("http://sikola-v2.unhas.ac.id/my/"))
        assertFalse(Sikola.isSignedInPage("https://neosia.unhas.ac.id/"))
        assertFalse(Sikola.isSignedInPage(null))
    }
}
