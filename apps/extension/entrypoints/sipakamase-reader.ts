import { browser } from 'wxt/browser';
import { defineUnlistedScript } from 'wxt/utils/define-unlisted-script';
import { readPage } from '@sulo/core/sipakamase/reader';
import type { FragmentId } from '@sulo/core/sipakamase/store';

// Isolated-world reader for Sipakamase (1.1.0), registered at runtime only
// while the module is on (core sipakamase/module.ts), on the activity,
// history, conversion and claim pages only. It listens for the site's own
// htmx:afterSettle events (DOM events reach the isolated world; their detail
// is not used), waits for loads to settle, and hands the projected data to
// the service worker, which validates it again. No request, no change to the
// page, nothing kept after the tab closes.
const SETTLE_MS = 600;

export default defineUnlistedScript(() => {
  const sent = new Map<FragmentId | 'login', string>();
  let timer: number | undefined;
  const run = () => {
    try {
      readPage(
        {
          html: () => document.body?.innerHTML ?? '',
          asksPassword: () => document.querySelector('input[type="password"]') !== null,
          send: (message) => void browser.runtime.sendMessage({ type: 'sipakamase/passive', message }).catch(() => undefined),
        },
        sent,
      );
    } catch {
      // Never break the page.
    }
  };
  const later = () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(run, SETTLE_MS);
  };
  document.addEventListener('htmx:afterSettle', later);
  later();
});
