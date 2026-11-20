package dev.ikrar.sulo.neosia

import android.webkit.WebStorage

/**
 * "Putuskan NEOSIA": NEOSIA's own web storage in this app's WebView (where
 * NEOSIA keeps its sign-in), deleted by origin without reading anything, so
 * the next connect starts signed out. SIKOLA's session stays. NEOSIA's
 * cookies are not touched here: finding them would mean reading them, which
 * Sulo never does (SourceRulesTest); Keluar clears every cookie.
 */
object NeosiaWebData {
    /** The origins whose web storage goes: NEOSIA's app and its API host, nothing wider. */
    val ORIGINS = listOf(NeosiaRules.ORIGIN, "https://${NeosiaRules.API_HOST}")

    /** Main thread (WebStorage). */
    fun clear(done: () -> Unit) {
        val storage = WebStorage.getInstance()
        ORIGINS.forEach { storage.deleteOrigin(it) }
        done()
    }
}
