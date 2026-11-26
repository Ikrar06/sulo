// The passive reader's logic (1.1.0), shared by the extension's isolated
// script (entrypoints/sipakamase-reader.ts) and testable without a browser.
// On a Sipakamase page the student opened, after the site's own htmx loads
// settle, it runs the five readers over the page and sends only what they
// projected, and only when it differs from what it sent last. It sends no
// request, follows no link, and leaves the page untouched. A page asking
// for a password gets one "login" message and nothing else is read.

import { readHtml } from './client';
import { FRAGMENTS, PASSIVE_MESSAGE_TYPE, type FragmentId } from './store';

export interface ReaderDeps {
  /** The page's markup now (document.body.innerHTML). */
  html: () => string;
  /** Whether the page has a password field (a login page). */
  asksPassword: () => boolean;
  send: (message: unknown) => void;
}

/** One pass; `sent` keeps what went out before, per fragment, so nothing is sent twice. */
export function readPage(deps: ReaderDeps, sent: Map<FragmentId | 'login', string>): number {
  if (deps.asksPassword()) {
    if (!sent.has('login')) {
      sent.set('login', '1');
      deps.send({ type: `${PASSIVE_MESSAGE_TYPE}:login` });
    }
    return 0;
  }
  const html = deps.html();
  let count = 0;
  for (const fragment of FRAGMENTS) {
    const read = readHtml(fragment, html);
    if (read.kind !== 'ok') continue;
    const json = JSON.stringify(read.value.data);
    if (sent.get(fragment) === json) continue;
    sent.set(fragment, json);
    deps.send({ type: PASSIVE_MESSAGE_TYPE, fragment, data: read.value.data });
    count += 1;
  }
  return count;
}
