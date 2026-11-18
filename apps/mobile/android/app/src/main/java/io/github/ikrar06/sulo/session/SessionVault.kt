package io.github.ikrar06.sulo.session

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/**
 * The SIKOLA session on the phone: AES-256-GCM with a key that lives in the
 * Android Keystore (it cannot be exported), the ciphertext in app-private
 * SharedPreferences (excluded from backups). Nothing here is ever logged,
 * handed to JavaScript or written anywhere else.
 */
class SessionVault(context: Context, private val crypto: Crypto = KeystoreCrypto()) {
    private val prefs = context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    fun save(moodleSession: String) {
        prefs.edit().putString(KEY_BLOB, crypto.encrypt(moodleSession.toByteArray(Charsets.UTF_8))).commit()
    }

    fun load(): String? {
        val blob = prefs.getString(KEY_BLOB, null) ?: return null
        return runCatching { String(crypto.decrypt(blob), Charsets.UTF_8) }.getOrNull()
    }

    fun has(): Boolean = prefs.contains(KEY_BLOB)

    var expired: Boolean
        get() = prefs.getBoolean(KEY_EXPIRED, false)
        set(value) { prefs.edit().putBoolean(KEY_EXPIRED, value).commit() }

    /** "Keluar": the ciphertext, the flags and the Keystore key itself. */
    fun wipe() {
        prefs.edit().clear().commit()
        crypto.destroyKey()
    }

    companion object {
        const val PREFS = "sulo_session"
        /** Spike diagnostics: cookie names and the landing path, never values. */
        const val PREFS_DIAG = "sulo_session_diag"
        private const val KEY_BLOB = "blob"
        private const val KEY_EXPIRED = "expired"
    }
}

/** Encryption behind an interface, so the format can be unit-tested off-device. */
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

class KeystoreCrypto(private val alias: String = "sulo_session_v1") : Crypto {
    private val keyStore: KeyStore = KeyStore.getInstance(PROVIDER).apply { load(null) }

    private fun key(): SecretKey {
        (keyStore.getEntry(alias, null) as? KeyStore.SecretKeyEntry)?.let { return it.secretKey }
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

    override fun encrypt(plain: ByteArray): String {
        val cipher = Cipher.getInstance(TRANSFORMATION)
        cipher.init(Cipher.ENCRYPT_MODE, key())
        val out = cipher.doFinal(plain)
        return BlobFormat.pack(cipher.iv, out) { Base64.encodeToString(it, Base64.NO_WRAP) }
    }

    override fun decrypt(blob: String): ByteArray {
        val (iv, data) = BlobFormat.unpack(blob) { Base64.decode(it, Base64.NO_WRAP) }
        val cipher = Cipher.getInstance(TRANSFORMATION)
        cipher.init(Cipher.DECRYPT_MODE, key(), GCMParameterSpec(128, iv))
        return cipher.doFinal(data)
    }

    override fun destroyKey() {
        if (keyStore.containsAlias(alias)) keyStore.deleteEntry(alias)
    }

    private companion object {
        const val PROVIDER = "AndroidKeyStore"
        const val TRANSFORMATION = "AES/GCM/NoPadding"
    }
}
