import { browser } from 'wxt/browser';
import { defineContentScript } from 'wxt/utils/define-content-script';
import { pickSesskey } from '@sulo/core/sesskey';
import { isLoggedOutPage, readPageSignals } from '@sulo/core/sikola/page-signals';
import { SIKOLA_ORIGIN } from '@sulo/core/moodle/limits';
import type { Message } from '@/lib/messages';
import { attendanceCmidFromUrl } from '@sulo/core/presensi/urls';

// Passive: reads the sesskey already present in the page DOM and hands it to
// the service worker, or reports a logged-out page (login form, no sesskey;
// structure only, lib/sikola/page-signals.ts) so Sulo stops without a
// request. Makes no requests and does not modify the page.
export default defineContentScript({
  matches: ['https://sikola-v2.unhas.ac.id/*'],
  runAt: 'document_idle',
  main() {
    // An attendance page the user opened: only the id from its URL, never the page.
    const cmid = attendanceCmidFromUrl(location.href);
    if (cmid !== null) browser.runtime.sendMessage({ type: 'presensi/seenCmid', cmid } satisfies Message).catch(() => undefined);

    const sesskey = pickSesskey(
      {
        inputValues: Array.from(
          document.querySelectorAll<HTMLInputElement>('input[name="sesskey"]'),
          (el) => el.value,
        ),
        hrefs: Array.from(
          document.querySelectorAll<HTMLAnchorElement>('a[href*="sesskey="]'),
          (el) => el.href,
        ),
      },
      SIKOLA_ORIGIN,
    );
    if (!sesskey) {
      if (isLoggedOutPage(readPageSignals(document))) {
        browser.runtime.sendMessage({ type: 'session/loggedOut' } satisfies Message).catch(() => undefined);
      }
      return;
    }

    const message: Message = { type: 'sesskey/found', sesskey };
    // The service worker may be starting up; a lost message is retried on the next page load.
    browser.runtime.sendMessage(message).catch(() => undefined);
  },
});
