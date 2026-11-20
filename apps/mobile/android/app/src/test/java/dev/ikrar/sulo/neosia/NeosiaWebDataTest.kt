package dev.ikrar.sulo.neosia

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class NeosiaWebDataTest {
    @Test
    fun namesAreTakenWithoutValues() {
        assertEquals(listOf("a", "b"), NeosiaWebData.names("a=1; b=x=y; a=2"))
        assertEquals(emptyList<String>(), NeosiaWebData.names(null))
        assertEquals(emptyList<String>(), NeosiaWebData.names(""))
    }

    @Test
    fun expiriesStayOnNeosiaHostsAndCarryNoValue() {
        val out = NeosiaWebData.expiries("https://api.neosia.unhas.ac.id", listOf("XSRF-TOKEN"))
        assertEquals(listOf("XSRF-TOKEN=; Max-Age=0; Path=/", "XSRF-TOKEN=; Max-Age=0; Path=/; Domain=api.neosia.unhas.ac.id"), out)
        // Never the parent domain SIKOLA shares.
        assertTrue(out.none { it.contains("Domain=unhas.ac.id") || it.contains("Domain=.unhas.ac.id") })
    }
}
