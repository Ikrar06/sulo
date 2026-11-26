import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { readPrefs } from '@sulo/core/prefs';
import { setMobileOs } from '@sulo/core/i18n/os';
import { initPerf } from './perf';
import { createMobilePlatform } from './platform';
import { applyIosTextScale, applyTextZoom } from './text-zoom';
import { Capacitor } from '@capacitor/core';
import { SuloSession } from './session';
import './styles.css';

declare global {
  interface Window {
    __suloWebViewTooOld?: boolean;
  }
}

// index.html's WebView guard already sent this page to the update page; if the
// bundle still starts, it does nothing (no storage, no request, no render).
if (window.__suloWebViewTooOld) throw new Error('webview-too-old');

// pnpm mobile:web and the layout check (--ios): ?os=ios shows the iPhone's words on the synthetic account.
if (__SULO_WEB_FAKE__ && import.meta.env.MODE === 'web' && new URLSearchParams(location.search).get('os') === 'ios') setMobileOs('ios');

// The layout's thresholds follow the phone's text size (src/text-zoom.ts), before the first frame.
applyTextZoom();
// iPhone: the text size comes from the native side (WKWebView does not follow it), at start and on each return.
if (Capacitor.getPlatform() === 'ios') {
  // The words, help and privacy for the iPhone (core i18n/os.ts), before anything reads them.
  setMobileOs('ios');
  await applyIosTextScale(() => SuloSession.textScale());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void applyIosTextScale(() => SuloSession.textScale());
  });
}

const platform = createMobilePlatform();

// The performance tier before the first frame, so nothing starts in the
// wrong mode; never waits more than 250 ms (full until then).
await Promise.race([
  readPrefs(platform.store).then((p) => initPerf(platform.store, p.animation)).catch(() => undefined),
  new Promise((resolve) => setTimeout(resolve, 250)),
]);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App platform={platform} />
  </StrictMode>,
);
