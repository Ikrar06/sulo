import type { CapacitorConfig } from '@capacitor/cli';

// The app's own pages load from the APK (https://localhost). SIKOLA opens
// only in SuloSession's native login screen; its cookie never reaches this
// WebView or its JavaScript (CLAUDE.md, mobile rules).
const config: CapacitorConfig = {
  // Final (M8b): it can never change after the first release.
  appId: 'dev.ikrar.sulo',
  appName: 'Sulo',
  webDir: 'dist',
  // Capacitor logs every plugin call and its result to logcat in debug builds, which
  // would put stored data (SIKOLA's tasks, the account id) in the system log. Never.
  loggingBehavior: 'none',
  android: {
    // No mixed content, no remote debugging in release builds (Capacitor's default).
    allowMixedContent: false,
    // The oldest Android System WebView the UI renders correctly in (CSS color-mix, see
    // docs/UI.md "WebView minimum"). Older: the static update page instead of the app,
    // no request to SIKOLA and no background watching (watch/WebViewGate.kt).
    minWebViewVersion: 111,
    // minHuaweiWebViewVersion stays Capacitor's default: Huawei numbers its WebView
    // on its own scale and no published table maps it to Chromium 111. Every brand,
    // Huawei included, is held to Chromium 111 by the user-agent guard in index.html.
  },
  plugins: {
    // Reminders: the mascot's silhouette as the status bar icon (res/drawable/ic_stat_sulo.xml).
    LocalNotifications: { smallIcon: 'ic_stat_sulo' },
    // Off, written out: Sulo patches neither document.cookie nor fetch/XHR in its WebView. CapacitorCookies
    // still loads and installs a CookieHandler on every start whatever this says; MainActivity and SikolaHttp
    // clear it (the cause of the lost SIKOLA sessions, 20 Nov 2026).
    CapacitorCookies: { enabled: false },
    CapacitorHttp: { enabled: false },
  },
  server: {
    // Plain HTML and CSS that works on WebView 69 (public/perlu-pembaruan.html).
    errorPath: 'perlu-pembaruan.html',
  },
};

export default config;
