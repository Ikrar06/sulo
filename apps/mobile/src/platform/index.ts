// The Android app's implementation of @sulo/core/platform.
import { systemClock } from '@sulo/core/clock';
import { resolveLocale } from '@sulo/core/i18n';
import type { Platform, SecretStore } from '@sulo/core/platform';
import { readPrefs } from '@sulo/core/prefs';
import { createSessionHttp } from './http';
import { createAlarmScheduler, createNotifier } from './notifications';
import { createPreferencesStore } from './store';

/**
 * Secrets never live in JavaScript on Android: the SIKOLA cookie and the
 * sesskey stay inside SuloSession's Keystore vault. This store therefore
 * holds nothing and refuses writes.
 */
const nativeOnlySecrets: SecretStore = {
  get: async () => null,
  set: async () => {
    throw new Error('Secrets stay native on Android');
  },
  remove: async () => undefined,
};

export function createMobilePlatform(): Platform {
  const store = createPreferencesStore();
  return {
    store,
    secrets: nativeOnlySecrets,
    alarms: createAlarmScheduler(store),
    notifier: createNotifier(store),
    // Plain requests are background-free reads; a sync the user starts makes its own (sync.ts).
    http: createSessionHttp(false),
    clock: systemClock,
    locale: { current: async () => resolveLocale((await readPrefs(store)).locale, navigator.language) },
  };
}
