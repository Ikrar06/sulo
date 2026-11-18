import { defineUnlistedScript } from 'wxt/utils/define-unlisted-script';
import { installCapture, type CaptureOptions } from '@/lib/neosia/capture';
import { observation } from '@/lib/neosia/observe';
import { scrubPath } from '@/lib/neosia/match';

// Page-world capture script for NEOSIA (world MAIN, document_start),
// registered at runtime only while the module is on (lib/neosia/module.ts).
// Bundled into one file with no dependencies besides lib/neosia's plain
// modules. It never sends a request; it reads, never changes, the responses
// the NEOSIA app asked for (lib/neosia/capture.ts).
export default defineUnlistedScript(() => {
  try {
    const options: CaptureOptions = { now: () => Math.floor(Date.now() / 1000) };
    // Development builds only: the path and key structure of what NEOSIA
    // requests, for checking the allowlist. Other builds drop this branch.
    if (import.meta.env.MODE === 'development') {
      options.onSeen = (match, json) => {
        try {
          window.postMessage(observation(match, json, Math.floor(Date.now() / 1000), scrubPath(location.pathname)), location.origin);
        } catch {
          // Dev listing only.
        }
      };
    }
    installCapture(window as unknown as Parameters<typeof installCapture>[0], options);
  } catch {
    // Never in the app's way.
  }
});
