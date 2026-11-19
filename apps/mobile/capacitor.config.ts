import type { CapacitorConfig } from '@capacitor/cli';

// The app's own pages load from the APK (https://localhost). SIKOLA opens
// only in SuloSession's native login screen; its cookie never reaches this
// WebView or its JavaScript (CLAUDE.md, mobile rules).
const config: CapacitorConfig = {
  // Final (M8b): it can never change after the first release.
  appId: 'dev.ikrar.sulo',
  appName: 'Sulo',
  webDir: 'dist',
  android: {
    // No mixed content, no remote debugging in release builds (Capacitor's default).
    allowMixedContent: false,
    // The oldest Android System WebView the UI renders correctly in (CSS color-mix, see
    // docs/UI.md "WebView minimum"). Older: the static update page instead of the app,
    // no request to SIKOLA and no background watching (watch/WebViewGate.kt).
    minWebViewVersion: 111,
  },
  server: {
    // Plain HTML and CSS that works on WebView 69 (public/perlu-pembaruan.html).
    errorPath: 'perlu-pembaruan.html',
  },
};

export default config;
