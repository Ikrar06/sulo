package dev.ikrar.sulo.session

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class VaultReadTest {
    /** Decrypts like a working vault until told to fail with `failure`. */
    private class Flaky(private val inner: Crypto) : Crypto {
        var failure: Exception? = null
        override fun encrypt(plain: ByteArray) = inner.encrypt(plain)
        override fun decrypt(blob: String): ByteArray = failure?.let { throw it } ?: inner.decrypt(blob)
        override fun destroyKey() = inner.destroyKey()
    }

    private fun setup(): Triple<MemorySlots, Flaky, SessionVault> {
        MemoryKey.key = null
        val slots = MemorySlots()
        val crypto = Flaky(MemoryCrypto())
        val vault = SessionVault(slots, crypto)
        vault.save(SikolaSession("cookie-value-123", "Sesskey0001"))
        return Triple(slots, crypto, vault)
    }

    @Test
    fun aPassingKeystoreFailureKeepsTheSession() {
        val (slots, crypto, vault) = setup()
        crypto.failure = java.security.KeyStoreException("not ready")
        assertTrue(vault.read() is SessionVault.Read.Unavailable)
        assertEquals("connected", vault.status())
        assertTrue(slots.map.containsKey("blob"))
        // Once the Keystore answers, the same session is there.
        crypto.failure = null
        assertEquals(SessionVault.Read.Ok(SikolaSession("cookie-value-123", "Sesskey0001")), vault.read())
    }

    @Test
    fun damagedDataEndsTheSessionAtOnce() {
        val (slots, crypto, vault) = setup()
        crypto.failure = javax.crypto.AEADBadTagException("tag mismatch")
        assertEquals(SessionVault.Read.Empty, vault.read())
        assertEquals("expired", vault.status())
        assertFalse(slots.map.containsKey("blob"))
    }

    @Test
    fun aMissingKeyEndsTheSession() {
        val (_, crypto, vault) = setup()
        crypto.failure = java.security.UnrecoverableKeyException("no key")
        assertEquals(SessionVault.Read.Empty, vault.read())
        assertEquals("expired", vault.status())
    }

    @Test
    fun theThirdPassingFailureInARowEndsIt() {
        val (_, crypto, vault) = setup()
        crypto.failure = java.security.ProviderException("busy")
        repeat(SessionVault.MAX_PASSING_FAILURES - 1) { assertTrue(vault.read() is SessionVault.Read.Unavailable) }
        assertEquals(SessionVault.Read.Empty, vault.read())
        assertEquals("expired", vault.status())
    }

    @Test
    fun aGoodReadResetsTheCount() {
        val (_, crypto, vault) = setup()
        crypto.failure = java.security.KeyStoreException("not ready")
        repeat(SessionVault.MAX_PASSING_FAILURES - 1) { vault.read() }
        crypto.failure = null
        assertTrue(vault.read() is SessionVault.Read.Ok)
        crypto.failure = java.security.KeyStoreException("not ready")
        assertTrue(vault.read() is SessionVault.Read.Unavailable)
        assertEquals("connected", vault.status())
    }

    @Test
    fun permanentCausesAreFoundInTheChain() {
        assertTrue(VaultErrors.permanent(RuntimeException(javax.crypto.AEADBadTagException("x"))))
        assertFalse(VaultErrors.permanent(java.security.KeyStoreException("x")))
        assertFalse(VaultErrors.permanent(java.security.ProviderException("x")))
    }

    @Test
    fun theDiagnosticLogKeepsCodesAndTimesOnly() {
        val slots = MemorySlots()
        var t = 1_000L
        val diag = Diag(slots) { t++ }
        diag.note("vault_expired:sikola_login_required:batch")
        diag.note("cookie=secret value; \"quoted\"")
        val list = diag.entries()
        assertEquals(2, list.length())
        assertEquals("vault_expired:sikola_login_required:batch", list.getJSONObject(0).getString("e"))
        // Anything that is not a code character is dropped.
        assertEquals("cookiesecretvaluequoted", list.getJSONObject(1).getString("e"))
        repeat(Diag.MAX + 5) { diag.note("app_start") }
        assertEquals(Diag.MAX, diag.entries().length())
    }
}
