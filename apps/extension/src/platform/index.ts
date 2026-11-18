// The extension's implementation of the platform adaptors in
// @sulo/core/platform, on chrome.* (WXT's browser). packages/core receives
// these through injection and never imports this folder.
//
// The service worker still builds most of its pieces directly (the same
// calls, M8a changed no behavior); new shared code takes a Platform.

import { browser } from 'wxt/browser';
import type { Platform } from '@sulo/core/platform';
import { systemClock } from '@sulo/core/clock';
import { resolveLocale } from '@sulo/core/i18n';
import { readPrefs } from '@sulo/core/prefs';
import { createAlarmScheduler } from './alarms';
import { createNotifier } from './notifier';
import { createSessionSecrets } from './secrets';
import { createWatchedStore } from './store';

export function createExtensionPlatform(): Platform {
  const store = createWatchedStore(browser.storage.local, 'local');
  return {
    store,
    secrets: createSessionSecrets(),
    alarms: createAlarmScheduler(),
    notifier: createNotifier(),
    // The browser sends SIKOLA's cookies itself (host permission).
    http: { request: (input, init) => fetch(input, init) },
    clock: systemClock,
    locale: { current: async () => resolveLocale((await readPrefs(store)).locale, browser.i18n.getUILanguage()) },
  };
}
