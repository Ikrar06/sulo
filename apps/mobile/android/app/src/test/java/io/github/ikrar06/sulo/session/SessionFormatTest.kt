package io.github.ikrar06.sulo.session

import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.util.Base64

class SessionFormatTest {
    private val enc: (ByteArray) -> String = { Base64.getEncoder().encodeToString(it) }
    private val dec: (String) -> ByteArray = { Base64.getDecoder().decode(it) }

    @Test
    fun blobRoundTrip() {
        val iv = ByteArray(12) { it.toByte() }
        val data = byteArrayOf(9, 8, 7)
        val blob = BlobFormat.pack(iv, data, enc)
        assertTrue(blob.startsWith("v1:"))
        val (iv2, data2) = BlobFormat.unpack(blob, dec)
        assertArrayEquals(iv, iv2)
        assertArrayEquals(data, data2)
    }

    @Test(expected = IllegalArgumentException::class)
    fun unknownFormatIsRefused() {
        BlobFormat.unpack("v0:AA==:AA==", dec)
    }

    @Test
    fun batchAcceptedOrRefusedWithCodesOnly() {
        val ok = SikolaHttp.parseBatch(200, """[{"error":false,"data":{"userid":1,"timeremaining":7140}}]""")
        assertTrue(ok.accepted)
        assertEquals(7140L, ok.timeRemaining)
        val login = SikolaHttp.parseBatch(200, """[{"error":true,"exception":{"message":"x","errorcode":"servicerequireslogin"}}]""")
        assertFalse(login.accepted)
        assertEquals("servicerequireslogin", login.errorcode)
        val sesskey = SikolaHttp.parseBatch(200, """{"error":"x","errorcode":"invalidsesskey"}""")
        assertEquals("invalidsesskey", sesskey.errorcode)
        val html = SikolaHttp.parseBatch(303, "<html>")
        assertFalse(html.accepted)
        assertEquals("not_json", html.errorcode)
        assertNull(html.timeRemaining)
    }
}
