// The NEOSIA page-world script on the phone (M8d). The same capture as the
// extension (core neosia/capture.ts: allowlist, projection, size limit); only
// the bridge differs: the extension forwards with window.postMessage to its
// content script, this forwards to the app through the WebMessageListener
// object `SuloNeosia` (Android) or the WKScriptMessageHandler `SuloNeosia`
// (iPhone), which the app adds only for https://neosia.unhas.ac.id.
//
// The native side adds this script (WebViewCompat.addDocumentStartJavaScript)
// only for pages Sulo opens from a tap that are not the login page, and takes
// it away before a login page loads. As a second guard the script does nothing
// on a login page, and stops forwarding if the app moves to one.
// It makes no request, never changes a response, and the raw response never
// leaves it (only the projected capture message does, at most 256 KiB).

import { CAPTURE_TYPE, MAX_MESSAGE_CHARS } from '@sulo/core/neosia/allowlist';
import { installCapture, type CaptureWindow } from '@sulo/core/neosia/capture';

interface Port {
  postMessage(message: string): void;
}

const onLogin = () => location.pathname === '/login' || location.pathname.startsWith('/login/');

(() => {
  try {
    // The app adds this script only for NEOSIA's origin (the native origin rule), so the page's own origin is NEOSIA's.
    if (onLogin()) return;
    // Android: the WebMessageListener object; iOS: the WKScriptMessageHandler of the same name.
    const g = globalThis as unknown as { SuloNeosia?: Port; webkit?: { messageHandlers?: { SuloNeosia?: Port } } };
    const port = g.SuloNeosia ?? g.webkit?.messageHandlers?.SuloNeosia;
    if (!port || typeof port.postMessage !== 'function') return;
    window.addEventListener('message', (event) => {
      try {
        if (event.source !== window || event.origin !== location.origin || onLogin()) return;
        const data = event.data as { type?: unknown } | null;
        if (!data || typeof data !== 'object' || data.type !== CAPTURE_TYPE) return;
        const text = JSON.stringify(data);
        if (text.length > MAX_MESSAGE_CHARS) return;
        port.postMessage(text);
      } catch {
        // Never in the app's way.
      }
    });
    installCapture(window as unknown as CaptureWindow, { now: () => Math.floor(Date.now() / 1000) });
  } catch {
    // Never in the app's way.
  }
})();
