package dev.ikrar.sulo.session

import dev.ikrar.sulo.watch.WatchStore

/** SIKOLA's cookies and web storage in this app (CookieManager and WebStorage on the phone). */
interface CookieJar {
    /** Clears everything, then calls `done` (CookieManager clears asynchronously). */
    fun clearAll(done: () -> Unit)
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
            vault.markExpired()
            done(vault.status())
        }
    }

    /** "Pakai akun ini": no check scheduled, no plan, no queued answer, no held notice, no timings. The session stays. */
    fun watchReset() {
        runCatching { stopChain() }
        store.reset()
    }
}
