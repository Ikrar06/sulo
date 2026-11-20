package dev.ikrar.sulo.neosia

import android.webkit.CookieManager
import android.webkit.WebStorage

/**
 * "Putuskan NEOSIA": NEOSIA's own cookies and web storage in this app's
 * WebView, so the next connect starts signed out. SIKOLA's session stays.
 * Cookie values are never read into anything but this expiry: only their
 * names are taken from the header, in memory, and nothing is logged.
 */
object NeosiaWebData {
    private val ORIGINS = listOf(NeosiaRules.ORIGIN, "https://${NeosiaRules.API_HOST}")

    /** The cookie names in a Cookie header ("a=1; b=2" -> a, b). Pure. */
    fun names(header: String?): List<String> =
        header.orEmpty().split(';').map { it.substringBefore('=').trim() }.filter { it.isNotEmpty() }.distinct()

    /**
     * Expiring cookies for a NEOSIA host: host-only and Domain=<that host>,
     * never a parent domain (unhas.ac.id would reach SIKOLA's cookies).
     */
    fun expiries(origin: String, names: List<String>): List<String> {
        val host = origin.removePrefix("https://")
        return names.flatMap { listOf("$it=; Max-Age=0; Path=/", "$it=; Max-Age=0; Path=/; Domain=$host") }
    }

    /** Main thread (WebStorage and CookieManager). */
    fun clear(done: () -> Unit) {
        val storage = WebStorage.getInstance()
        ORIGINS.forEach { storage.deleteOrigin(it) }
        val cookies = CookieManager.getInstance()
        for (origin in ORIGINS) {
            expiries(origin, names(cookies.getCookie(origin))).forEach { cookies.setCookie(origin, it) }
        }
        cookies.flush()
        done()
    }
}
