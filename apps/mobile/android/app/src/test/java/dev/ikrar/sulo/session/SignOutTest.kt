package dev.ikrar.sulo.session

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class SignOutTest {
    @Test
    fun keluarClearsTheWebViewsDataThenTheVaultAndTheRest() {
        MemoryKey.key = null
        val order = mutableListOf<String>()
        val slots = MemorySlots()
        val vault = SessionVault(slots, MemoryCrypto(), pause = {})
        vault.save(SikolaSession("cookie-value-123", "Sesskey0001"))
        val web = object : CookieJar {
            // On the phone: CookieManager (SIKOLA and NEOSIA cookies), WebStorage (NEOSIA's localStorage) and the cache.
            override fun clearAll(done: () -> Unit) {
                order.add("web")
                done()
            }
        }
        var finished = false
        SignOut(web, vault, listOf({ order.add("diag") }, { order.add("watch") })).run { finished = true }
        assertEquals(listOf("web", "diag", "watch"), order)
        assertEquals("none", vault.status())
        assertTrue(slots.map.isEmpty())
        assertTrue(finished)
    }
}
