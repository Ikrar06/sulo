package dev.ikrar.sulo;

import static org.junit.Assert.assertEquals;

import org.junit.Test;

public class TextZoomTest {
    /** Android's font size setting reaches the WebView as it is (owner's decision, 23 Nov 2026): the layout adapts, the text is never held back. */
    @Test
    public void followsTheSettingAsItIs() {
        assertEquals(100, MainActivity.textZoom(1.0f));
        assertEquals(85, MainActivity.textZoom(0.85f));
        assertEquals(115, MainActivity.textZoom(1.15f));
        assertEquals(130, MainActivity.textZoom(1.3f));
        assertEquals(150, MainActivity.textZoom(1.5f));
        assertEquals(200, MainActivity.textZoom(2.0f));
    }
}
