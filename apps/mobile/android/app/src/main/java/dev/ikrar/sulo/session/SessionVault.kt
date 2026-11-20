package dev.ikrar.sulo.session

import android.content.Context
import android.content.SharedPreferences
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import org.json.JSONObject
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/** What the vault holds; never logged, never handed to JavaScript. */
data class SikolaSession(val moodleSession: String, val sesskey: String?)

/** A tiny key-value store, so the vault can be tested off-device. */
interface Slots {
    /** Everything stored, or null when the store is there but cannot be read (damaged). */
    fun all(): Map<String, String>?
    fun get(key: String): String?
    fun put(key: String, value: String)
    /** Several keys in one write (one atomic write for [FileSlots]). */
    fun putAll(values: Map<String, String?>) { for ((k, v) in values) if (v != null) put(k, v) }
    fun clear()
}

class PrefsSlots(private val prefs: SharedPreferences) : Slots {
    override fun all(): Map<String, String> = prefs.all.mapNotNull { (k, v) -> (v as? String)?.let { k to it } }.toMap()
    override fun get(key: String): String? = prefs.getString(key, null)
    override fun put(key: String, value: String) { prefs.edit().putString(key, value).commit() }
    override fun putAll(values: Map<String, String?>) {
        prefs.edit().apply { for ((k, v) in values) if (v == null) remove(k) else putString(k, v) }.commit()
    }
    override fun clear() { prefs.edit().clear().commit() }
}

/**
 * The SIKOLA session on the phone: AES-256-GCM with a key that lives in the
 * Android Keystore (it cannot be exported), the ciphertext in app-private
 * storage that is excluded from every backup. "Keluar" removes both.
 *
 * Owner's rules (20 Nov 2026):
 * - Written atomically (FileSlots); a copy of the last good record is kept
 *   and read when the main record is damaged.
 * - A read that fails is tried 3 times with a pause. Failing still never
 *   deletes the session, unless the Keystore says its key is gone for good.
 * - Only [markExpired] ends a session, called after core asked SIKOLA twice
 *   (SuloSession.endSession), or by the user's own Keluar or Batal. The
 *   background check only marks it [markSuspect]; the app confirms.
 * - Every change notes a reason code in Diag.
 */
class SessionVault(
    private val slots: Slots,
    private val crypto: Crypto,
    private val diag: Diag? = null,
    private val backup: Slots? = null,
    private val pause: (Long) -> Unit = { Thread.sleep(it) },
) {
    fun save(session: SikolaSession, note: Boolean = true) {
        val json = JSONObject().put("m", session.moodleSession).apply { session.sesskey?.let { put("s", it) } }.toString()
        val record = mapOf(KEY_BLOB to crypto.encrypt(json.toByteArray(Charsets.UTF_8)), KEY_STATE to STATE_CONNECTED, KEY_FAILURES to "0", KEY_SUSPECT to "0", KEY_INTERRUPTED to null, KEY_ENDED_BY to null, KEY_CANDIDATE to null)
        slots.putAll(record)
        backup?.putAll(record)
        if (note) diag?.note("vault_saved")
    }

    /** What a read of the vault found. */
    sealed class Read {
        object Empty : Read()
        data class Ok(val session: SikolaSession) : Read()
        /** The blob is there but cannot be read right now: kept, try again later. */
        data class Unavailable(val cause: String) : Read()
    }

    /** The main record, or the last good copy when the main one is damaged. */
    private fun record(): Map<String, String> {
        slots.all()?.let { return it }
        val copy = backup?.all()
        diag?.note(if (copy != null) "vault_backup_used" else "vault_unreadable_record")
        return copy ?: emptyMap()
    }

    /**
     * Reads the session. Each stored blob (the main one, then the last good
     * copy when it differs) is tried [READ_TRIES] times with a pause. When
     * none decrypts: a key that is gone for good (missing, or invalidated by
     * the system) ends the session; anything else keeps it and answers
     * Unavailable. Never throws.
     */
    fun read(): Read {
        val main = record()
        val blobs = listOfNotNull(main[KEY_BLOB], backup?.get(KEY_BLOB)).distinct()
        if (blobs.isEmpty() || main[KEY_STATE] == STATE_EXPIRED) return Read.Empty
        var last: Exception? = null
        for ((index, blob) in blobs.withIndex()) {
            repeat(READ_TRIES) { attempt ->
                try {
                    val json = JSONObject(String(crypto.decrypt(blob), Charsets.UTF_8))
                    if ((main[KEY_FAILURES] ?: "0") != "0") slots.put(KEY_FAILURES, "0")
                    if (index > 0) diag?.note("vault_backup_blob_used")
                    return Read.Ok(SikolaSession(json.getString("m"), json.optString("s").ifEmpty { null }))
                } catch (e: Exception) {
                    last = e
                    if (VaultErrors.keyGone(e)) return@repeat
                    if (attempt < READ_TRIES - 1) pause(RETRY_PAUSE_MS[attempt])
                }
            }
        }
        val e = last ?: return Read.Empty
        val name = e.javaClass.simpleName
        if (VaultErrors.keyGone(e)) {
            markExpired("key_gone:$name")
            return Read.Empty
        }
        val failures = (main[KEY_FAILURES]?.toIntOrNull() ?: 0) + 1
        runCatching { slots.put(KEY_FAILURES, failures.toString()) }
        diag?.note("vault_unavailable:$name:$failures")
        return Read.Unavailable(name)
    }

    /** The session, or null (nothing stored, ended, or not readable right now; see [read]). */
    fun load(): SikolaSession? = (read() as? Read.Ok)?.session

    fun status(): String {
        val r = record()
        return when (r[KEY_STATE]) {
            STATE_CONNECTED -> if (r[KEY_BLOB] != null) "connected" else "none"
            STATE_EXPIRED -> "expired"
            else -> "none"
        }
    }

    /** The background check thought the session ended: the app confirms (asking twice) before anything ends. */
    fun markSuspect(reason: String): Int {
        val n = (record()[KEY_SUSPECT]?.toIntOrNull() ?: 0) + 1
        slots.put(KEY_SUSPECT, n.toString())
        diag?.note("vault_suspect:$n:$reason")
        return n
    }

    fun suspectCount(): Int = record()[KEY_SUSPECT]?.toIntOrNull() ?: 0

    /** SIKOLA answered fine: any suspicion is gone. */
    fun clearSuspect() {
        if (suspectCount() == 0) return
        slots.put(KEY_SUSPECT, "0")
        diag?.note("vault_suspect_cleared")
    }

    /**
     * A MoodleSession that SIKOLA set in an answer: kept on disk at once
     * (atomically), but not used until that same answer shows the session is
     * valid ([promoteCandidate]). Moodle sets a new cookie when it no longer
     * knows the one sent (a guest session), so using it blindly would replace
     * a signed-in cookie with a guest one (seen on the emulator, 20 Nov 2026).
     */
    fun saveCandidate(cookie: String) {
        slots.put(KEY_CANDIDATE, cookie)
    }

    /** The answer was a valid session: the candidate becomes the session's cookie. */
    fun promoteCandidate(): Boolean {
        val cookie = record()[KEY_CANDIDATE] ?: return false
        val current = load() ?: return false
        save(current.copy(moodleSession = cookie), note = false)
        diag?.note("sikola_cookie_promoted")
        return true
    }

    /** The answer did not show a valid session: the candidate is dropped. */
    fun dropCandidate() {
        if (record()[KEY_CANDIDATE] == null) return
        slots.putAll(mapOf(KEY_CANDIDATE to null))
        diag?.note("sikola_cookie_dropped")
    }

    /** A request of this session was cut off when an earlier process ended (RequestGuard). */
    fun noteInterrupted(at: Long) {
        if (record()[KEY_STATE] != STATE_CONNECTED) return
        slots.put(KEY_INTERRUPTED, at.toString())
    }

    /** Why the session ended, when the app can say: "interrupted" (a request was cut off before it ended). */
    fun endedBy(): String? = record()[KEY_ENDED_BY]

    /** The session ended (`reason`: who said so): keep nothing usable, remember "expired" for the screen. */
    fun markExpired(reason: String = "unspecified") {
        val interrupted = record()[KEY_INTERRUPTED] != null
        backup?.clear()
        slots.clear()
        runCatching { crypto.destroyKey() }
        slots.putAll(mapOf(KEY_STATE to STATE_EXPIRED, KEY_ENDED_BY to if (interrupted) "interrupted" else null))
        diag?.note("vault_expired:$reason")
    }

    /** "Keluar": the ciphertext, the state and the Keystore key itself. */
    fun wipe() {
        backup?.clear()
        slots.clear()
        runCatching { crypto.destroyKey() }
        diag?.note("vault_wiped")
    }

    companion object {
        const val PREFS = "sulo_session"
        private const val KEY_BLOB = "blob"
        private const val KEY_STATE = "state"
        private const val STATE_CONNECTED = "connected"
        private const val STATE_EXPIRED = "expired"
        private const val KEY_FAILURES = "readFailures"
        private const val KEY_SUSPECT = "suspect"
        private const val KEY_INTERRUPTED = "interruptedAt"
        private const val KEY_ENDED_BY = "endedBy"
        private const val KEY_CANDIDATE = "candidateCookie"
        /** Tries per stored blob before a read counts as failed. */
        const val READ_TRIES = 3
        private val RETRY_PAUSE_MS = longArrayOf(150, 600)

        /**
         * The vault on the phone: files/sulo_session.json and its last good
         * copy, moved once from the SharedPreferences the earlier builds used.
         */
        fun of(context: Context): SessionVault {
            val app = context.applicationContext
            val main = FileSlots(java.io.File(app.filesDir, "sulo_session.json"))
            val copy = FileSlots(java.io.File(app.filesDir, "sulo_session.good.json"))
            val diag = Diag.of(app)
            migrate(PrefsSlots(app.getSharedPreferences(PREFS, Context.MODE_PRIVATE)), main, copy, diag)
            return SessionVault(main, KeystoreCrypto(), diag, copy)
        }

        /** Earlier builds kept the record in SharedPreferences: moved over once, then cleared there. */
        fun migrate(old: Slots, main: Slots, copy: Slots, diag: Diag?) {
            val record = old.all().orEmpty()
            if (record.isEmpty() || main.all().orEmpty().isNotEmpty()) return
            main.putAll(record)
            if (record[KEY_STATE] == STATE_CONNECTED) copy.putAll(record)
            old.clear()
            diag?.note("vault_migrated")
        }
    }
}

/** Encryption behind an interface, so the vault can be unit-tested off-device. */
interface Crypto {
    fun encrypt(plain: ByteArray): String
    fun decrypt(blob: String): ByteArray
    fun destroyKey()
}

/** "v1:" + base64(12-byte IV) + ":" + base64(ciphertext with GCM tag). */
object BlobFormat {
    fun pack(iv: ByteArray, cipher: ByteArray, encode: (ByteArray) -> String): String = "v1:${encode(iv)}:${encode(cipher)}"

    fun unpack(blob: String, decode: (String) -> ByteArray): Pair<ByteArray, ByteArray> {
        val parts = blob.split(':')
        require(parts.size == 3 && parts[0] == "v1") { "unknown session format" }
        return decode(parts[1]) to decode(parts[2])
    }
}

/** AES-GCM on any key source: the Keystore on the phone, an in-memory key in tests. */
open class AesGcmCrypto(private val keys: () -> SecretKey, private val destroy: () -> Unit, private val encode: (ByteArray) -> String, private val decode: (String) -> ByteArray, private val existingKey: () -> SecretKey = keys) : Crypto {
    override fun encrypt(plain: ByteArray): String {
        val cipher = Cipher.getInstance(TRANSFORMATION)
        cipher.init(Cipher.ENCRYPT_MODE, keys())
        return BlobFormat.pack(cipher.iv, cipher.doFinal(plain), encode)
    }

    override fun decrypt(blob: String): ByteArray {
        val (iv, data) = BlobFormat.unpack(blob, decode)
        val cipher = Cipher.getInstance(TRANSFORMATION)
        // Reading never makes a key: a missing one means the blob can never be read.
        cipher.init(Cipher.DECRYPT_MODE, existingKey(), GCMParameterSpec(128, iv))
        return cipher.doFinal(data)
    }

    override fun destroyKey() = destroy()

    companion object {
        const val TRANSFORMATION = "AES/GCM/NoPadding"
    }
}

class KeystoreCrypto(alias: String = "sulo_session_v1") : AesGcmCrypto(
    keys = { keystoreKey(alias) },
    destroy = { keyStore().run { if (containsAlias(alias)) deleteEntry(alias) } },
    encode = { Base64.encodeToString(it, Base64.NO_WRAP) },
    decode = { Base64.decode(it, Base64.NO_WRAP) },
    existingKey = { (keyStore().getEntry(alias, null) as? KeyStore.SecretKeyEntry)?.secretKey ?: throw java.security.UnrecoverableKeyException("no key") },
) {
    private companion object {
        const val PROVIDER = "AndroidKeyStore"

        fun keyStore(): KeyStore = KeyStore.getInstance(PROVIDER).apply { load(null) }

        fun keystoreKey(alias: String): SecretKey {
            (keyStore().getEntry(alias, null) as? KeyStore.SecretKeyEntry)?.let { return it.secretKey }
            val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, PROVIDER)
            generator.init(
                KeyGenParameterSpec.Builder(alias, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
                    .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                    .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                    .setKeySize(256)
                    .setRandomizedEncryptionRequired(true)
                    .build(),
            )
            return generator.generateKey()
        }
    }
}
