package dev.ikrar.sulo;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import dev.ikrar.sulo.session.SuloSessionPlugin;

public class MainActivity extends BridgeActivity {
    /** Android's font size setting, within what the layout is tested for (85% to 130%). */
    static final float MIN_TEXT_SCALE = 0.85f;
    static final float MAX_TEXT_SCALE = 1.30f;

    static int textZoom(float fontScale) {
        return Math.round(Math.max(MIN_TEXT_SCALE, Math.min(MAX_TEXT_SCALE, fontScale)) * 100f);
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // The app's own native plugin (login, session, SIKOLA requests).
        registerPlugin(SuloSessionPlugin.class);
        super.onCreate(savedInstanceState);
        // Honor the phone's text size, clamped so screens never break (src/tokens.css).
        if (getBridge() != null && getBridge().getWebView() != null) {
            getBridge().getWebView().getSettings().setTextZoom(textZoom(getResources().getConfiguration().fontScale));
        }
    }
}
