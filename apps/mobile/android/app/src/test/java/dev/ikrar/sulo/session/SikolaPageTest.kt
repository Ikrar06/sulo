package dev.ikrar.sulo.session

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class SikolaPageTest {
    private val base = "https://sikola-v2.unhas.ac.id"

    @Test
    fun attendancePagesWithIdModeViewOnly() {
        assertEquals("$base/mod/attendance/view.php?id=197570&mode=1", SikolaPage.allowedUrl("/mod/attendance/view.php?id=197570&mode=1"))
        assertEquals("$base/mod/attendance/view.php?id=197570&view=5", SikolaPage.allowedUrl("/mod/attendance/view.php?id=197570&view=5"))
        assertEquals("$base/mod/attendance/view.php?id=1", SikolaPage.allowedUrl("/mod/attendance/view.php?id=1"))
    }

    @Test
    fun otherPagesAreRefused() {
        for (path in listOf(
            "/my/",
            "/mod/attendance/take.php?id=1",
            "/mod/attendance/sessions.php?id=1",
            "/mod/assign/view.php?id=1",
            "/login/logout.php?sesskey=abc",
            "/mod/attendance/view.php",
            "/mod/attendance/view.php?",
            "https://example.com/mod/attendance/view.php?id=1",
            "//example.com/mod/attendance/view.php?id=1",
            "/mod/attendance/../../login/index.php?id=1",
            "/mod/attendance/view.php/../take.php?id=1",
        )) assertNull(path, SikolaPage.allowedUrl(path))
    }

    @Test
    fun extraOrOddParametersAreRefused() {
        for (path in listOf(
            "/mod/attendance/view.php?id=1&sesskey=abc",
            "/mod/attendance/view.php?id=1&studentid=2",
            "/mod/attendance/view.php?id=1&mode=1&mode=2",
            "/mod/attendance/view.php?mode=1",
            "/mod/attendance/view.php?id=abc",
            "/mod/attendance/view.php?id=1&view=5#x",
            "/mod/attendance/view.php?id=1%26take=1",
            "/mod/attendance/view.php?id=1&view",
            "/mod/attendance/view.php?id=1&view=5=6",
            "/mod/attendance/view.php?id=1?mode=1",
            "/mod/attendance/view.php?id=12345678901",
        )) assertNull(path, SikolaPage.allowedUrl(path))
    }

    @Test
    fun javascriptGetsNoHeadScriptsFormsOrSesskey() {
        val page = """
            <html><head><title>x</title><script>M.cfg = {"sesskey":"AbC123xyZ0"};</script></head>
            <body><div class="popover-region" data-userid="42"></div>
            <a href="$base/login/logout.php?sesskey=AbC123xyZ0">Keluar</a>
            <form action="/x"><input type="hidden" name="sesskey" value="AbC123xyZ0"></form>
            <script src="/y.js"></script><style>.a{}</style><!-- note -->
            <section id="region-main"><table class="generaltable"></table></section></body></html>
        """.trimIndent()
        val out = SikolaPage.forJs(page)
        assertFalse(out.contains("AbC123xyZ0"))
        assertFalse(out.contains("<script", ignoreCase = true))
        assertFalse(out.contains("<head", ignoreCase = true))
        assertFalse(out.contains("<form", ignoreCase = true))
        assertFalse(out.contains("<style", ignoreCase = true))
        assertTrue(out.contains("data-userid=\"42\""))
        assertTrue(out.contains("region-main"))
    }
}
