import { browser } from 'wxt/browser';
import type { Notifier } from '@sulo/core/platform';

/** chrome.notifications, with the mascot icons in public/notify. */
export function createNotifier(): Notifier {
  return {
    async show(id, view, options = {}) {
      await browser.notifications.create(id, {
        type: 'basic',
        iconUrl: browser.runtime.getURL(`/notify/${view.icon}.png`),
        title: view.title,
        message: view.message,
        buttons: view.buttons.map((title) => ({ title })),
        priority: options.lowPriority ? 0 : 1,
        ...(options.silent ? { silent: true } : {}),
      });
    },
    clear: (id) => browser.notifications.clear(id),
    onClick(listener) {
      browser.notifications.onClicked.addListener(listener);
      return () => browser.notifications.onClicked.removeListener(listener);
    },
  };
}
