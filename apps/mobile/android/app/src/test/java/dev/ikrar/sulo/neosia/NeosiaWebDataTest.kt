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

class UserOfTest {
    @Test
    fun takesIntegersAndLongs() {
        // An Integer is what Capacitor hands over for a small JSON number.
        assertEquals(1234567L, userOf(Integer.valueOf(1234567)))
        assertEquals(9_000_000_000L, userOf(9_000_000_000L))
        assertEquals(42L, userOf(42.0))
    }

    @Test
    fun refusesTheRest() {
        for (raw in listOf<Any?>(null, "42", 0, -1, 4.5, Double.NaN)) assertEquals(raw.toString(), null, userOf(raw))
    }
}
