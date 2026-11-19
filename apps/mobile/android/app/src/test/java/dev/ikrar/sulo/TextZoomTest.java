package dev.ikrar.sulo;

import static org.junit.Assert.assertEquals;

import org.junit.Test;

public class TextZoomTest {
    @Test
    public void followsTheSettingWithinEightyFiveToOneThirty() {
        assertEquals(100, MainActivity.textZoom(1.0f));
        assertEquals(115, MainActivity.textZoom(1.15f));
        assertEquals(85, MainActivity.textZoom(0.7f));
        assertEquals(130, MainActivity.textZoom(2.0f));
    }
}
