package dev.ikrar.sulo.session

import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream
import java.nio.file.Files
import java.nio.file.StandardCopyOption

/**
 * One small record in one file, written whole and atomically: to a temporary
 * file, fsync, then renamed over the old one. A process that dies mid-write
 * leaves the previous record, never half of one. [all] answers null when the
 * file is there but cannot be read (the caller falls back to its copy).
 * Plain java.io, so it runs in JVM tests too.
 */
class FileSlots(private val file: File) : Slots {
    @Synchronized
    override fun all(): Map<String, String>? {
        if (!file.exists()) return emptyMap()
        return runCatching {
            val o = JSONObject(file.readText(Charsets.UTF_8))
            o.keys().asSequence().associateWith { o.getString(it) }
        }.getOrNull()
    }

    override fun get(key: String): String? = all()?.get(key)

    override fun put(key: String, value: String) = putAll(mapOf(key to value))

    @Synchronized
    override fun putAll(values: Map<String, String?>) {
        val next = (all() ?: emptyMap()).toMutableMap()
        for ((k, v) in values) if (v == null) next.remove(k) else next[k] = v
        write(JSONObject(next as Map<*, *>).toString())
    }

    @Synchronized
    override fun clear() {
        if (file.exists()) write("{}")
    }

    /** Removes the file itself (Keluar). */
    @Synchronized
    fun delete() {
        file.delete()
        File(file.path + ".tmp").delete()
    }

    private fun write(text: String) {
        file.parentFile?.mkdirs()
        val tmp = File(file.path + ".tmp")
        FileOutputStream(tmp).use { out ->
            out.write(text.toByteArray(Charsets.UTF_8))
            out.flush()
            out.fd.sync()
        }
        Files.move(tmp.toPath(), file.toPath(), StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE)
    }
}
