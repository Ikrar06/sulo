package dev.ikrar.sulo;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import dev.ikrar.sulo.session.SuloSessionPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // The app's own native plugin (login, session, SIKOLA requests).
        registerPlugin(SuloSessionPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
