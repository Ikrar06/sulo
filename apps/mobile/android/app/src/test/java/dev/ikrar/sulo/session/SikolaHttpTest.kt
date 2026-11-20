package dev.ikrar.sulo.session

import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test
import java.net.CookieHandler
import java.net.HttpCookie
import java.net.ServerSocket
import java.net.URI
import kotlin.concurrent.thread

/**
 * Requests to SIKOLA carry exactly one Cookie header, the vault's, even with a
 * CookieHandler installed the way Capacitor's CapacitorCookies does on every
 * start (the cause of the lost sessions, 20 Nov 2026). The background check
 * uses the same class, so this covers it too.
 */
class SikolaHttpTest {
    @After
    fun noHandler() = CookieHandler.setDefault(null)

    /** A one-shot local server: answers "[]" and hands back the request's header lines. */
    private fun serve(block: (origin: String) -> Unit): List<String> {
        val server = ServerSocket(0)
        val lines = mutableListOf<String>()
        val t = thread {
            server.accept().use { s ->
                val reader = s.getInputStream().bufferedReader()
                while (true) {
                    val l = reader.readLine() ?: break
                    if (l.isEmpty()) break
                    lines.add(l)
                }
                s.getOutputStream().write("HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: 2\r\nConnection: close\r\n\r\n[]".toByteArray())
            }
        }
        try {
            block("http://127.0.0.1:${server.localPort}")
        } finally {
            t.join(5_000)
            server.close()
        }
        return lines
    }

    private fun webViewLikeHandler(origin: String) = java.net.CookieManager().apply {
        cookieStore.add(URI(origin), HttpCookie("twk_uuid_x", "chat").apply { path = "/"; version = 0 })
        cookieStore.add(URI(origin), HttpCookie("MoodleSession", "webview-copy").apply { path = "/"; version = 0 })
    }

    @Test
    fun exactlyOneCookieHeaderFromTheVaultEvenWithAHandlerInstalled() {
        var cleared = 0
        val lines = serve { origin ->
            CookieHandler.setDefault(webViewLikeHandler(origin))
            val http = SikolaHttp("Sulo/test", strict = false, origin = origin, onHandlerCleared = { cleared++ })
            http.postJson("$origin/lib/ajax/service.php", "vault-cookie", "[]")
        }
        val cookies = lines.filter { it.startsWith("Cookie:", ignoreCase = true) }
        assertEquals(listOf("Cookie: MoodleSession=vault-cookie"), cookies)
        assertEquals(1, cleared)
        assertEquals(null, CookieHandler.getDefault())
    }

    @Test
    fun aDebugBuildRefusesToSendWithAHandlerInstalled() {
        CookieHandler.setDefault(java.net.CookieManager())
        try {
            SikolaHttp("Sulo/test", strict = true, origin = "http://127.0.0.1:9").get("http://127.0.0.1:9/my/", "vault-cookie")
            fail("a request went out with a CookieHandler installed")
        } catch (e: IllegalStateException) {
            assertTrue(e.message!!.contains("CookieHandler"))
        }
    }

    @Test
    fun neverAnotherHostThanSikola() {
        val http = SikolaHttp("Sulo/test")
        for (url in listOf("https://neosia.unhas.ac.id/", "https://api.neosia.unhas.ac.id/api/mahasiswa/dashboard", "https://sikola-v2.unhas.ac.id.evil.example/x", "http://sikola-v2.unhas.ac.id/my/")) {
            try {
                http.get(url, "vault-cookie")
                fail("sent to $url")
            } catch (e: IllegalArgumentException) {
                assertEquals("SIKOLA only", e.message)
            }
        }
    }
}
