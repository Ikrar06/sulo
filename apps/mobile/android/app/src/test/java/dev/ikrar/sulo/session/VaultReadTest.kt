package dev.ikrar.sulo.session

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/** Same simple name as Android's (a stub in JVM tests); VaultErrors reads names. */
class KeyPermanentlyInvalidatedException(m: String) : Exception(m)

class VaultReadTest {
    /** Decrypts like a working vault until told to fail with `failure`. */
    private class Flaky(private val inner: Crypto) : Crypto {
        var failure: Exception? = null
        override fun encrypt(plain: ByteArray) = inner.encrypt(plain)
        override fun decrypt(blob: String): ByteArray = failure?.let { throw it } ?: inner.decrypt(blob)
        override fun destroyKey() = inner.destroyKey()
    }

    private val pauses = mutableListOf<Long>()

    private fun setup(withBackup: Boolean = false): Triple<MemorySlots, Flaky, SessionVault> {
        MemoryKey.key = null
        pauses.clear()
        val slots = MemorySlots()
        val crypto = Flaky(MemoryCrypto())
        val vault = SessionVault(slots, crypto, backup = if (withBackup) MemorySlots() else null, pause = { pauses.add(it) })
        vault.save(SikolaSession("cookie-value-123", "Sesskey0001"))
        return Triple(slots, crypto, vault)
    }

    @Test
    fun aFailedReadIsTriedThreeTimesWithAPause() {
        val (_, crypto, vault) = setup()
        crypto.failure = java.security.KeyStoreException("not ready")
        assertTrue(vault.read() is SessionVault.Read.Unavailable)
        assertEquals(SessionVault.READ_TRIES - 1, pauses.size)
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
    fun damagedDataNeverDeletesTheSession() {
        // Owner's rule (20 Nov 2026): only a key the Keystore reports gone for good ends it.
        val (slots, crypto, vault) = setup()
        crypto.failure = javax.crypto.AEADBadTagException("tag mismatch")
        repeat(5) { assertTrue(vault.read() is SessionVault.Read.Unavailable) }
        assertEquals("connected", vault.status())
        assertTrue(slots.map.containsKey("blob"))
    }

    @Test
    fun aMissingKeyEndsTheSession() {
        val (_, crypto, vault) = setup()
        crypto.failure = java.security.UnrecoverableKeyException("no key")
        assertEquals(SessionVault.Read.Empty, vault.read())
        assertEquals("expired", vault.status())
    }

    @Test
    fun anInvalidatedKeyEndsTheSessionThroughTheChain() {
        val (_, crypto, vault) = setup()
        crypto.failure = RuntimeException(KeyPermanentlyInvalidatedException("gone"))
        assertEquals(SessionVault.Read.Empty, vault.read())
        assertEquals("expired", vault.status())
    }

    @Test
    fun aDamagedRecordFallsBackToTheLastGoodCopy() {
        val (slots, _, vault) = setup(withBackup = true)
        slots.damaged = true
        assertEquals("connected", vault.status())
        assertEquals(SessionVault.Read.Ok(SikolaSession("cookie-value-123", "Sesskey0001")), vault.read())
    }

    @Test
    fun aDamagedBlobFallsBackToTheCopysBlob() {
        val (slots, _, vault) = setup(withBackup = true)
        slots.map["blob"] = "v1:AAAAAAAAAAAAAAAA:AAAA"
        assertTrue(vault.read() is SessionVault.Read.Ok)
    }

    @Test
    fun suspicionIsCountedAndClearedButNeverEndsTheSession() {
        val (_, _, vault) = setup()
        assertEquals(1, vault.markSuspect("watch:servicerequireslogin"))
        assertEquals(2, vault.markSuspect("watch:servicerequireslogin"))
        assertEquals("connected", vault.status())
        assertTrue(vault.read() is SessionVault.Read.Ok)
        vault.clearSuspect()
        assertEquals(0, vault.suspectCount())
        // A new sign-in starts clean.
        vault.markSuspect("watch:x")
        vault.save(SikolaSession("cookie-value-456", "Sesskey0002"))
        assertEquals(0, vault.suspectCount())
    }

    @Test
    fun anEndedSessionLeavesNothingInTheCopyEither() {
        val (slots, _, vault) = setup(withBackup = true)
        vault.markExpired("confirmed:session:servicerequireslogin+session:servicerequireslogin")
        slots.damaged = true
        assertEquals(SessionVault.Read.Empty, vault.read())
    }

    @Test
    fun earlierBuildsRecordsMoveOnce() {
        val old = MemorySlots().apply { map["blob"] = "v1:x:y"; map["state"] = "connected" }
        val main = MemorySlots()
        val copy = MemorySlots()
        SessionVault.migrate(old, main, copy, null)
        assertEquals("v1:x:y", main.map["blob"])
        assertEquals("v1:x:y", copy.map["blob"])
        assertTrue(old.map.isEmpty())
        // Never over a record that is already there.
        val again = MemorySlots().apply { map["blob"] = "v1:other:z" }
        SessionVault.migrate(again, main, copy, null)
        assertEquals("v1:x:y", main.map["blob"])
    }

    @Test
    fun fileSlotsWriteWholeAndReadDamageAsNull() {
        val dir = java.nio.file.Files.createTempDirectory("vault").toFile()
        val file = java.io.File(dir, "s.json")
        val slots = FileSlots(file)
        assertEquals(emptyMap<String, String>(), slots.all())
        slots.putAll(mapOf("blob" to "v1:a:b", "state" to "connected"))
        assertEquals("connected", FileSlots(file).get("state"))
        assertFalse(java.io.File(dir, "s.json.tmp").exists())
        file.writeText("{\"blob\": \"v1:a")
        assertEquals(null, FileSlots(file).all())
        dir.deleteRecursively()
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
