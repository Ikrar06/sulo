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
    fun anAssignmentByItsIdOnly() {
        assertEquals("$base/mod/assign/view.php?id=70", SikolaPage.allowedUrl("/mod/assign/view.php?id=70"))
        for (path in listOf(
            "/mod/assign/view.php?id=70&action=editsubmission",
            "/mod/assign/view.php?id=70&action=removesubmission&sesskey=abc",
            "/mod/assign/view.php?action=grading",
            "/mod/assign/view.php?id=70&mode=1",
            "/mod/assign/view.php?id=70&id=71",
            "/mod/assign/view.php?id=abc",
            "/mod/assign/view.php",
            "/mod/assign/index.php?id=70",
        )) assertNull(path, SikolaPage.allowedUrl(path))
    }

    @Test
    fun otherPagesAreRefused() {
        for (path in listOf(
            "/my/",
            "/mod/attendance/take.php?id=1",
            "/mod/attendance/sessions.php?id=1",
            "/mod/quiz/view.php?id=1",
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

    @Test
    fun noSesskeyInAnyEscapedForm() {
        val key = "Zx9Yw8Vu7T"
        val page = """
            <body><div class="popover-region" data-userid="42"></div>
            <div data-config="{&quot;sesskey&quot;:&quot;$key&quot;,&quot;a&quot;:1}"></div>
            <a href="/x.php?sesskey&#61;$key">x</a>
            <a href="/y.php?SESSKEY%3D$key">y</a>
            <span data-k="${key.map { "&#${it.code};" }.joinToString("")}"></span>
            <span data-k="${key.map { "&#x${Integer.toHexString(it.code)};" }.joinToString("")}"></span>
            <input type="hidden" name="sesskey" value="$key">
            <section id="region-main">ok</section></body>
        """.trimIndent()
        val out = SikolaPage.forJs(page, listOf(key))
        assertFalse(out, out.contains(key))
        assertFalse(out.contains("&#${key[0].code};&#${key[1].code};"))
        assertFalse(out.contains("<input", ignoreCase = true))
        assertTrue(out.contains("data-userid=\"42\""))
    }

    @Test
    fun theVaultKeyIsRemovedEvenWithoutTheWordSesskey() {
        val key = "Qq1Ww2Ee3R"
        val out = SikolaPage.forJs("""<div data-x="$key"></div><p>$key</p>""", listOf(key))
        assertFalse(out.contains(key))
    }
}
