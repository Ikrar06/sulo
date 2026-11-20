package dev.ikrar.sulo.neosia

import android.content.Context
import dev.ikrar.sulo.session.Crypto
import dev.ikrar.sulo.session.FileSlots
import dev.ikrar.sulo.session.KeystoreCrypto
import dev.ikrar.sulo.session.Slots
import java.io.File

/**
 * NEOSIA's data on the phone (M8d B2): schedule, KHS, transcript, KRS
 * readiness, the academic advisor's name. Encrypted value by value with a
 * Keystore key of its own (not the SIKOLA vault's), one atomic file per
 * SIKOLA account, so another account never reads it and Keluar or a new
 * account removes it. Key names are endpoint ids, never personal data.
 * Values are only ever decrypted for core's NEOSIA code when asked; grades
 * are asked for only while the Nilai screen or the Studi card shows.
 */
class NeosiaStore(private val files: (Long) -> Slots, private val crypto: Crypto, private val wipeFiles: () -> Unit = {}) {
    fun get(user: Long, key: String): String? = files(user).get(key)?.let { runCatching { String(crypto.decrypt(it), Charsets.UTF_8) }.getOrNull() }

    fun set(user: Long, key: String, value: String) = files(user).put(key, crypto.encrypt(value.toByteArray(Charsets.UTF_8)))

    fun remove(user: Long, keys: List<String>) = files(user).putAll(keys.associateWith { null })

    fun keys(user: Long, prefix: String): List<String> = files(user).all().orEmpty().keys.filter { it.startsWith(prefix) }.sorted()

    /** One account's NEOSIA data (a new SIKOLA account). */
    fun wipe(user: Long) = files(user).clear()

    /** Keluar: every account's, and the key itself. */
    fun wipeAll() {
        runCatching { wipeFiles() }
        runCatching { crypto.destroyKey() }
    }

    companion object {
        private const val DIR = "neosia"

        fun of(context: Context): NeosiaStore {
            val dir = File(context.applicationContext.filesDir, DIR)
            return NeosiaStore(
                files = { user -> FileSlots(File(dir, "u$user.json")) },
                crypto = KeystoreCrypto("sulo_neosia_v1"),
                wipeFiles = { dir.deleteRecursively() },
            )
        }
    }
}

/**
 * Captures that passed the NEOSIA screen's own checks (origin, main frame,
 * not the login page, size), waiting for the app: already projected in the
 * page, encrypted at rest, at most MAX of them, taken (and cleared) by the
 * app, which runs core's gate (Zod schema, 5-second dedupe) before storing.
 */
class CaptureQueue(private val slots: Slots, private val crypto: Crypto) {
    @Synchronized
    fun append(message: String): Boolean {
        val all = slots.all().orEmpty()
        val n = all.keys.mapNotNull { it.toIntOrNull() }.maxOrNull()?.plus(1) ?: 0
        // Full: the newest wins room (the page's data repeats on every open).
        val drop = all.keys.mapNotNull { it.toIntOrNull() }.sorted().dropLast(MAX - 1).map { it.toString() }
        slots.putAll(drop.associateWith { null } + (n.toString() to crypto.encrypt(message.toByteArray(Charsets.UTF_8))))
        return true
    }

    /** Every waiting capture, oldest first; the queue is empty after. */
    @Synchronized
    fun take(): List<String> {
        val all = slots.all().orEmpty()
        slots.clear()
        return all.entries.sortedBy { it.key.toIntOrNull() ?: 0 }.mapNotNull { runCatching { String(crypto.decrypt(it.value), Charsets.UTF_8) }.getOrNull() }
    }

    companion object {
        const val MAX = 40

        fun of(context: Context) = CaptureQueue(FileSlots(File(File(context.applicationContext.filesDir, "neosia"), "queue.json")), KeystoreCrypto("sulo_neosia_v1"))
    }
}
