import type { CapacitorConfig } from '@capacitor/cli';

// The app's own pages load from the APK (https://localhost). SIKOLA opens
// only in SuloSession's native login screen; its cookie never reaches this
// WebView or its JavaScript (CLAUDE.md, mobile rules).
const config: CapacitorConfig = {
  // Under the maintainer's GitHub namespace; it can never change after the first release.
  appId: 'io.github.ikrar06.sulo',
  appName: 'Sulo',
  webDir: 'dist',
  android: {
    // No mixed content, no remote debugging in release builds (Capacitor's default).
    allowMixedContent: false,
  },
};

export default config;
