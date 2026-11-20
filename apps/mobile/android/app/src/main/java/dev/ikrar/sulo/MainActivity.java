package dev.ikrar.sulo;

import android.content.Intent;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import dev.ikrar.sulo.neosia.SuloNeosiaPlugin;
import dev.ikrar.sulo.session.SuloSessionPlugin;
import dev.ikrar.sulo.watch.WatchNotifier;
import dev.ikrar.sulo.watch.WatchStore;

public class MainActivity extends BridgeActivity {
    /** Android's font size setting, within what the layout is tested for (85% to 130%). */
    /** True while the app is on screen: the watch worker then leaves syncing to the app. */
    public static volatile boolean inForeground = false;

    static final float MIN_TEXT_SCALE = 0.85f;
    static final float MAX_TEXT_SCALE = 1.30f;

    static int textZoom(float fontScale) {
        return Math.round(Math.max(MIN_TEXT_SCALE, Math.min(MAX_TEXT_SCALE, fontScale)) * 100f);
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // The app's own native plugin (login, session, SIKOLA requests).
        registerPlugin(SuloSessionPlugin.class);
        registerPlugin(dev.ikrar.sulo.store.SuloStorePlugin.class);
        // M8d: the NEOSIA screen (debug builds only in B0).
        registerPlugin(SuloNeosiaPlugin.class);
        super.onCreate(savedInstanceState);
        // The session's event log (times and codes only): when the app starts.
        dev.ikrar.sulo.session.Diag.Companion.of(this).note("app_start");
        // Capacitor's built-in CapacitorCookies plugin makes itself java.net's default
        // CookieHandler on every start, even switched off: every HttpURLConnection in the
        // process then sends the WebView's cookies too and writes every Set-Cookie into the
        // WebView (seen 20 Nov 2026). Sulo's requests to SIKOLA carry the vault's cookie
        // only, so no handler: nothing outside the vault takes part in the session.
        java.net.CookieHandler.setDefault(null);
        // Honor the phone's text size, clamped so screens never break (src/tokens.css).
        if (getBridge() != null && getBridge().getWebView() != null) {
            getBridge().getWebView().getSettings().setTextZoom(textZoom(getResources().getConfiguration().fontScale));
        }
        rememberTap(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        rememberTap(intent);
    }

    @Override
    public void onResume() {
        super.onResume();
        inForeground = true;
    }

    @Override
    public void onPause() {
        inForeground = false;
        // Cookies and web storage to disk before Android may end the process (swiped away from recents).
        android.webkit.CookieManager.getInstance().flush();
        super.onPause();
    }

    /** A background notification was tapped: the app reads its id once it is up (SuloSession.watchTakeOpen). */
    private void rememberTap(Intent intent) {
        if (intent == null) return;
        String id = intent.getStringExtra(WatchNotifier.EXTRA_OPEN);
        if (id != null) new WatchStore(this).setPendingOpen(id);
    }
}
