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
    fun get(key: String): String?
    fun put(key: String, value: String)
    fun clear()
}

class PrefsSlots(private val prefs: SharedPreferences) : Slots {
    override fun get(key: String): String? = prefs.getString(key, null)
    override fun put(key: String, value: String) { prefs.edit().putString(key, value).commit() }
    override fun clear() { prefs.edit().clear().commit() }
}

/**
 * The SIKOLA session on the phone: AES-256-GCM with a key that lives in the
 * Android Keystore (it cannot be exported), the ciphertext in app-private
 * storage that is excluded from every backup. "Keluar" removes both.
 */
class SessionVault(private val slots: Slots, private val crypto: Crypto) {
    constructor(context: Context) : this(PrefsSlots(context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)), KeystoreCrypto())

    fun save(session: SikolaSession) {
        val json = JSONObject().put("m", session.moodleSession).apply { session.sesskey?.let { put("s", it) } }.toString()
        slots.put(KEY_BLOB, crypto.encrypt(json.toByteArray(Charsets.UTF_8)))
        slots.put(KEY_STATE, STATE_CONNECTED)
    }

    /**
     * null when nothing is stored. A blob that can no longer be decrypted
     * (the Keystore key is gone, invalidated or changed, or the data was
     * altered) is treated as an ended session: it is deleted, the key with
     * it, and the state becomes "expired" so the app asks to sign in again.
     * Never throws.
     */
    fun load(): SikolaSession? {
        val blob = slots.get(KEY_BLOB) ?: return null
        val session = runCatching {
            val json = JSONObject(String(crypto.decrypt(blob), Charsets.UTF_8))
            SikolaSession(json.getString("m"), json.optString("s").ifEmpty { null })
        }.getOrNull()
        if (session == null) runCatching { markExpired() }
        return session
    }

    fun status(): String = when (slots.get(KEY_STATE)) {
        STATE_CONNECTED -> if (slots.get(KEY_BLOB) != null) "connected" else "none"
        STATE_EXPIRED -> "expired"
        else -> "none"
    }

    /** SIKOLA said the session ended: keep nothing usable, remember "expired" for the screen. */
    fun markExpired() {
        slots.clear()
        runCatching { crypto.destroyKey() }
        slots.put(KEY_STATE, STATE_EXPIRED)
    }

    /** "Keluar": the ciphertext, the state and the Keystore key itself. */
    fun wipe() {
        slots.clear()
        runCatching { crypto.destroyKey() }
    }

    companion object {
        const val PREFS = "sulo_session"
        private const val KEY_BLOB = "blob"
        private const val KEY_STATE = "state"
        private const val STATE_CONNECTED = "connected"
        private const val STATE_EXPIRED = "expired"
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
open class AesGcmCrypto(private val keys: () -> SecretKey, private val destroy: () -> Unit, private val encode: (ByteArray) -> String, private val decode: (String) -> ByteArray) : Crypto {
    override fun encrypt(plain: ByteArray): String {
        val cipher = Cipher.getInstance(TRANSFORMATION)
        cipher.init(Cipher.ENCRYPT_MODE, keys())
        return BlobFormat.pack(cipher.iv, cipher.doFinal(plain), encode)
    }

    override fun decrypt(blob: String): ByteArray {
        val (iv, data) = BlobFormat.unpack(blob, decode)
        val cipher = Cipher.getInstance(TRANSFORMATION)
        cipher.init(Cipher.DECRYPT_MODE, keys(), GCMParameterSpec(128, iv))
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
