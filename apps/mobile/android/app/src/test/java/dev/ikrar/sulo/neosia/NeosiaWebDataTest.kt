package dev.ikrar.sulo.neosia

import org.junit.Assert.assertEquals
import org.junit.Test

class NeosiaWebDataTest {
    @Test
    fun onlyNeosiaOriginsAreCleared() {
        // Never a parent domain or SIKOLA's origin.
        assertEquals(listOf("https://neosia.unhas.ac.id", "https://api.neosia.unhas.ac.id"), NeosiaWebData.ORIGINS)
    }
}
