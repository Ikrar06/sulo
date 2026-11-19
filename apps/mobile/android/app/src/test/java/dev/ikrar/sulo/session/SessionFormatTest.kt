package dev.ikrar.sulo.session

import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.util.Base64
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey

class MemorySlots : Slots {
    val map = mutableMapOf<String, String>()
    /** Set to make the record read as damaged. */
    var damaged = false
    override fun all(): Map<String, String>? = if (damaged) null else map.toMap()
    override fun get(key: String) = if (damaged) null else map[key]
    override fun put(key: String, value: String) { map[key] = value }
    override fun putAll(values: Map<String, String?>) { for ((k, v) in values) if (v == null) map.remove(k) else map[k] = v }
    override fun clear() = map.clear()
}

/** AES-GCM like the phone, with an in-memory key instead of the Keystore. */
class MemoryCrypto : AesGcmCrypto(
    keys = { MemoryKey.key ?: KeyGenerator.getInstance("AES").apply { init(256) }.generateKey().also { MemoryKey.key = it } },
    destroy = { MemoryKey.key = null },
    encode = { Base64.getEncoder().encodeToString(it) },
    decode = { Base64.getDecoder().decode(it) },
)

object MemoryKey { var key: SecretKey? = null }

class SessionFormatTest {
    private val dec: (String) -> ByteArray = { Base64.getDecoder().decode(it) }

    @Test
    fun blobFormat() {
        val blob = BlobFormat.pack(ByteArray(12) { it.toByte() }, byteArrayOf(9, 8, 7)) { Base64.getEncoder().encodeToString(it) }
        assertTrue(blob.startsWith("v1:"))
        assertArrayEquals(byteArrayOf(9, 8, 7), BlobFormat.unpack(blob, dec).second)
    }

    @Test(expected = IllegalArgumentException::class)
    fun unknownFormatIsRefused() {
        BlobFormat.unpack("v0:AA==:AA==", dec)
    }
}

class SessionVaultTest {
    private fun vault(slots: MemorySlots = MemorySlots()) = SessionVault(slots, MemoryCrypto()).also { MemoryKey.key = null }

    @Test
    fun encryptsAndReadsBack() {
        val slots = MemorySlots()
        val v = vault(slots)
        v.save(SikolaSession("cookie-value-123", "Sesskey0001"))
        assertEquals("connected", v.status())
        // Nothing in storage is readable as the cookie or the sesskey.
        assertFalse(slots.map.values.any { it.contains("cookie-value-123") || it.contains("Sesskey0001") })
        assertEquals(SikolaSession("cookie-value-123", "Sesskey0001"), v.load())
        // A new encryption of the same value differs (random IV).
        val first = slots.map["blob"]
        v.save(SikolaSession("cookie-value-123", "Sesskey0001"))
        assertNotEquals(first, slots.map["blob"])
    }

    @Test
    fun alteredCiphertextIsRejected() {
        val slots = MemorySlots()
        val v = vault(slots)
        v.save(SikolaSession("cookie-value-123", null))
        val blob = slots.map["blob"]!!
        slots.map["blob"] = blob.dropLast(4) + if (blob.endsWith("AAAA")) "BBBB" else "AAAA"
        // GCM: altered data is never accepted.
        assertNull(v.load())
        // Owner's rule (20 Nov 2026): a failed read never deletes the session; only a key gone for good does.
        assertEquals("connected", v.status())
        assertTrue(slots.map.containsKey("blob"))
    }

    /** A Keystore that lost or invalidated its key (screen lock changed, key deleted, restored backup). */
    private class BrokenCrypto(private val destroyFails: Boolean = false) : Crypto {
        override fun encrypt(plain: ByteArray): String = "v1:AAAAAAAAAAAAAAAA:AAAA"
        override fun decrypt(blob: String): ByteArray = throw java.security.UnrecoverableKeyException("key unavailable")
        override fun destroyKey() { if (destroyFails) throw java.security.KeyStoreException("busy") }
    }

    @Test
    fun missingKeyEndsTheSessionWithoutCrashing() {
        val slots = MemorySlots()
        val v = SessionVault(slots, BrokenCrypto())
        v.save(SikolaSession("cookie-value-123", "Sesskey0001"))
        assertEquals("connected", v.status())
        assertNull(v.load())
        assertEquals("expired", v.status())
        assertFalse(slots.map.containsKey("blob"))
        // A second read finds nothing and stays calm.
        assertNull(v.load())
    }

    @Test
    fun aKeystoreThatCannotDeleteNeverCrashes() {
        val slots = MemorySlots()
        val v = SessionVault(slots, BrokenCrypto(destroyFails = true))
        v.save(SikolaSession("cookie-value-123", null))
        assertNull(v.load())
        assertEquals("expired", v.status())
        v.wipe()
        assertEquals("none", v.status())
    }

    @Test
    fun wipeRemovesDataAndKey() {
        val slots = MemorySlots()
        val v = vault(slots)
        v.save(SikolaSession("cookie-value-123", "Sesskey0001"))
        v.wipe()
        assertTrue(slots.map.isEmpty())
        assertNull(MemoryKey.key)
        assertNull(v.load())
        assertEquals("none", v.status())
    }

    @Test
    fun expiredKeepsNoSecret() {
        val slots = MemorySlots()
        val v = vault(slots)
        v.save(SikolaSession("cookie-value-123", "Sesskey0001"))
        v.markExpired()
        assertEquals("expired", v.status())
        assertNull(v.load())
        assertNull(MemoryKey.key)
        assertFalse(slots.map.containsKey("blob"))
    }
}

class SikolaRequestTest {
    @Test
    fun noSessionUpdateFollowsTheUser() {
        assertFalse(SikolaRequest.noSessionUpdate(userInitiated = true))
        assertTrue(SikolaRequest.noSessionUpdate(userInitiated = false))
        assertTrue(SikolaRequest.batchUrl("Sk00000001", listOf("core_session_time_remaining"), false).endsWith("&nosessionupdate=true"))
        assertFalse(SikolaRequest.batchUrl("Sk00000001", listOf("core_session_time_remaining"), true).contains("nosessionupdate"))
        assertEquals(
            "https://sikola-v2.unhas.ac.id/lib/ajax/service.php?sesskey=Sk00000001&info=core_session_time_remaining,core_courseformat_get_state",
            SikolaRequest.batchUrl("Sk00000001", listOf("core_session_time_remaining", "core_courseformat_get_state"), true),
        )
    }

    @Test
    fun onlyAllowlistedBatches() {
        assertEquals(listOf("core_session_time_remaining"), SikolaRequest.allowedFunctions("""[{"index":0,"methodname":"core_session_time_remaining","args":{}}]"""))
        assertNull(SikolaRequest.allowedFunctions("""[{"index":0,"methodname":"mod_assign_save_submission","args":{}}]"""))
        assertNull(SikolaRequest.allowedFunctions("""[{"index":0,"methodname":"core_session_touch","args":{}}]"""))
        assertNull(SikolaRequest.allowedFunctions("[]"))
        assertNull(SikolaRequest.allowedFunctions("not json"))
    }

    private val batch = listOf("core_session_time_remaining", "core_calendar_get_action_events_by_timesort", "core_courseformat_get_state")

    @Test
    fun sessionEndsAreRecognised() {
        assertTrue(SikolaRequest.loginRequired("""[{"error":true,"exception":{"errorcode":"servicerequireslogin"}}]""", batch))
        assertTrue(SikolaRequest.loginRequired("""[{"error":true,"exception":{"errorcode":"requireloginerror"}}]""", batch))
        assertTrue(SikolaRequest.loginRequired("""{"error":"x","errorcode":"requireloginerror"}""", batch))
        assertTrue(SikolaRequest.invalidSesskey("""{"error":"x","errorcode":"invalidsesskey"}""", batch))
        assertFalse(SikolaRequest.loginRequired("""[{"error":false,"data":{"timeremaining":7140}}]""", batch))
        // The same words inside course data never end the session.
        assertFalse(SikolaRequest.loginRequired("""[{"error":false,"data":{"events":[{"name":"Tugas \"servicerequireslogin\""}]}}]""", batch))
        assertFalse(SikolaRequest.invalidSesskey("""[{"error":false,"data":{"text":"\"invalidsesskey\""}}]""", batch))
        assertFalse(SikolaRequest.loginRequired("<html>servicerequireslogin</html>", batch))
    }

    @Test
    fun oneCourseThatCannotBeOpenedIsNotASignOut() {
        // 20 Nov 2026 on the phone: time_remaining answered, then one course's get_state failed with
        // requireloginerror and Moodle stopped the batch there. The session was alive.
        val body = """[{"error":false,"data":{"timeremaining":7000}},{"error":false,"data":{"events":[]}},{"error":true,"exception":{"errorcode":"requireloginerror"}}]"""
        assertFalse(SikolaRequest.loginRequired(body, batch))
        assertFalse(SikolaRequest.loginRequired("""[{"error":true,"exception":{"errorcode":"requireloginerror"}}]""", listOf("core_courseformat_get_state")))
        assertFalse(SikolaRequest.invalidSesskey("""[{"error":false,"data":{}},{"error":true,"exception":{"errorcode":"invalidsesskey"}}]""", batch))
        // When time_remaining itself says so, it is the session.
        assertTrue(SikolaRequest.loginRequired("""[{"error":false,"data":{}},{"error":true,"exception":{"errorcode":"servicerequireslogin"}}]""", listOf("core_calendar_get_action_events_by_timesort", "core_session_time_remaining")))
    }

    @Test
    fun aSessionCallThatAnsweredClearsSuspicion() {
        assertTrue(SikolaRequest.sessionAnswered("""[{"error":false,"data":{"userid":1,"timeremaining":7000}}]""", batch))
        assertFalse(SikolaRequest.sessionAnswered("""[{"error":true,"exception":{"errorcode":"servicerequireslogin"}}]""", batch))
        assertFalse(SikolaRequest.sessionAnswered("""{"errorcode":"invalidsesskey"}""", batch))
        assertFalse(SikolaRequest.sessionAnswered("""[{"error":false,"data":{}}]""", listOf("core_courseformat_get_state")))
    }
}
