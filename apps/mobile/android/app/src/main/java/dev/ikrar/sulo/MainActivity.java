package dev.ikrar.sulo;

import android.content.Intent;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import dev.ikrar.sulo.neosia.SuloNeosiaPlugin;
import dev.ikrar.sulo.session.SuloSessionPlugin;
import dev.ikrar.sulo.watch.WatchNotifier;
import dev.ikrar.sulo.watch.WatchStore;

public class MainActivity extends BridgeActivity {
    /** True while the app is on screen: the watch worker then leaves syncing to the app. */
    public static volatile boolean inForeground = false;
    /** The WebView has drawn its first frame (SuloSession.ready, from the app): the launch screen may go. */
    public static volatile boolean webReady = false;
    /** The launch screen never stays longer than this, whatever the app says. */
    static final long SPLASH_MAX_MS = 2500;

    /**
     * Android's font size setting as the WebView's text zoom, as it is: never held back. The layout is
     * what adapts (check:mobile-layout covers 0.85 to 2.0; Android 14 goes up to 2.0).
     */
    static int textZoom(float fontScale) {
        return Math.round(fontScale * 100f);
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // The app's own native plugin (login, session, SIKOLA requests).
        registerPlugin(SuloSessionPlugin.class);
        registerPlugin(dev.ikrar.sulo.store.SuloStorePlugin.class);
        // The notification channels (the chosen sound): made and removed in one place.
        registerPlugin(dev.ikrar.sulo.notify.SuloNotifyPlugin.class);
        // M8d: the NEOSIA screen (debug builds only in B0).
        registerPlugin(SuloNeosiaPlugin.class);
        registerPlugin(dev.ikrar.sulo.sipakamase.SuloSipakamasePlugin.class);
        // The launch screen (res/values/styles.xml): kept until the first frame, then gone without a flash.
        webReady = false;
        final long shownAt = android.os.SystemClock.uptimeMillis();
        androidx.core.splashscreen.SplashScreen.installSplashScreen(this)
            .setKeepOnScreenCondition(() -> !webReady && android.os.SystemClock.uptimeMillis() - shownAt < SPLASH_MAX_MS);
        super.onCreate(savedInstanceState);
        // Behind the first frame: the app's screen colour (light or dark), never white.
        if (getBridge() != null && getBridge().getWebView() != null) {
            getBridge().getWebView().setBackgroundColor(androidx.core.content.ContextCompat.getColor(this, R.color.sulo_screen));
        }
        // The session's event log (times and codes only): when the app starts.
        dev.ikrar.sulo.session.Diag.Companion.of(this).note("app_start");
        // Capacitor's built-in CapacitorCookies plugin makes itself java.net's default
        // CookieHandler on every start, even switched off: every HttpURLConnection in the
        // process then sends the WebView's cookies too and writes every Set-Cookie into the
        // WebView (seen 20 Nov 2026). Sulo's requests to SIKOLA carry the vault's cookie
        // only, so no handler: nothing outside the vault takes part in the session.
        java.net.CookieHandler.setDefault(null);
        // The phone's text size, as it is (src/tokens.css).
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
