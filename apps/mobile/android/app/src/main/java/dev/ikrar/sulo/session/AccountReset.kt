package dev.ikrar.sulo.session

import dev.ikrar.sulo.watch.WatchStore

/**
 * Everything the app's WebViews keep: the SIKOLA login's and NEOSIA's cookies,
 * their web storage (NEOSIA's sign-in lives in localStorage) and the HTTP
 * cache (CookieManager, WebStorage and the WebView cache on the phone).
 */
interface CookieJar {
    /** Clears everything (cookies, web storage, cache), then calls `done` (CookieManager clears asynchronously). */
    fun clearAll(done: () -> Unit)
}

/**
 * "Keluar": every trace of both sign-ins on the phone. The WebViews' data
 * first (SIKOLA's and NEOSIA's cookies, localStorage, cache), then the
 * vault and its key, the session history, and background watching.
 */
class SignOut(
    private val web: CookieJar,
    private val vault: SessionVault,
    private val after: List<() -> Unit>,
) {
    fun run(done: () -> Unit) {
        web.clearAll {
            vault.wipe()
            after.forEach { runCatching { it() } }
            done()
        }
    }
}

/**
 * The two answers on the "Akun berbeda" screen (src/switch-account.ts),
 * apart from Capacitor so they can be tested on the JVM. Both are safe to
 * call twice and while the watch worker is in the middle of a check: the
 * vault and the store are synchronized, and a reset bumps the store's
 * generation so an answer the running check still writes is dropped.
 */
class AccountReset(
    private val vault: SessionVault,
    private val store: WatchStore,
    private val cookies: CookieJar,
    private val stopChain: () -> Unit,
) {
    /**
     * "Batal": the session just signed in is thrown away (cookies, the
     * vault's ciphertext and its Keystore key); the state reads "expired" so
     * the previous account's data shows with "Masuk lagi". Watching is not
     * touched here (the app already wrote its plan disabled).
     */
    fun discardSession(done: (String) -> Unit) {
        cookies.clearAll {
            vault.markExpired("account_discard")
            done(vault.status())
        }
    }

    /** "Pakai akun ini": no check scheduled, no plan, no queued answer, no held notice, no timings. The session stays. */
    fun watchReset() {
        runCatching { stopChain() }
        store.reset()
    }
}
