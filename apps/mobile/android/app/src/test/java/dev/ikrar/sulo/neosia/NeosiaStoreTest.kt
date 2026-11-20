package dev.ikrar.sulo.neosia

import dev.ikrar.sulo.session.FileSlots
import dev.ikrar.sulo.session.MemoryCrypto
import dev.ikrar.sulo.session.MemoryKey
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File
import java.nio.file.Files

class NeosiaStoreTest {
    private fun tmp(): File = Files.createTempDirectory("neosia").toFile()

    @Test
    fun valuesAreEncryptedOnDiskAndKeptPerAccount() {
        MemoryKey.key = null
        val dir = tmp()
        val store = NeosiaStore({ user -> FileSlots(File(dir, "u$user.json")) }, MemoryCrypto(), { dir.deleteRecursively() })
        val grades = """{"data":{"ipk":"3.71","nilai_huruf":"A"}}"""
        store.set(7, "neosia:snap:getTranskripMahasiswa", grades)
        assertEquals(grades, store.get(7, "neosia:snap:getTranskripMahasiswa"))
        // Never in clear on disk: neither the value nor anything of it.
        val disk = File(dir, "u7.json").readText()
        assertFalse(disk.contains("3.71"))
        assertFalse(disk.contains("nilai_huruf"))
        // Another account reads nothing of it.
        assertNull(store.get(8, "neosia:snap:getTranskripMahasiswa"))
        assertEquals(listOf("neosia:snap:getTranskripMahasiswa"), store.keys(7, "neosia:"))
        // A new account: the previous one's data goes.
        store.wipe(7)
        assertNull(store.get(7, "neosia:snap:getTranskripMahasiswa"))
        // Keluar: everything, and the key.
        store.set(8, "neosia:snap:dashboard", "{}")
        store.wipeAll()
        assertFalse(dir.exists())
        assertNull(MemoryKey.key)
    }

    @Test
    fun theQueueIsEncryptedBoundedAndEmptiedWhenTaken() {
        MemoryKey.key = null
        val dir = tmp()
        val q = CaptureQueue(FileSlots(File(dir, "queue.json")), MemoryCrypto())
        repeat(CaptureQueue.MAX + 5) { q.append("""{"type":"sulo:capture:v1","n":$it}""") }
        assertFalse(File(dir, "queue.json").readText().contains("sulo:capture"))
        val taken = q.take()
        assertEquals(CaptureQueue.MAX, taken.size)
        // The newest are kept, oldest first.
        assertTrue(taken.first().contains("\"n\":5"))
        assertTrue(taken.last().contains("\"n\":${CaptureQueue.MAX + 4}"))
        assertTrue(q.take().isEmpty())
        dir.deleteRecursively()
    }
}
