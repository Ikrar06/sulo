import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { browser } from 'wxt/browser';
import { createAlarmScheduler } from '../src/platform/alarms';
import { createSessionSecrets } from '../src/platform/secrets';
import { createWatchedStore } from '../src/platform/store';

// The extension's chrome.* adaptors for @sulo/core/platform (M8a).
describe('extension platform adaptors', () => {
  beforeEach(() => fakeBrowser.reset());

  it('store: get/set/remove/keys, and watch reports changes of its own area only', async () => {
    const store = createWatchedStore(browser.storage.local, 'local');
    const seen: string[][] = [];
    const stop = store.watch((changes) => seen.push(Object.keys(changes)));
    await store.set('global:prefs', { locale: 'id' });
    await browser.storage.session.set({ sesskey: 'x' });
    expect(await store.get('global:prefs')).toEqual({ locale: 'id' });
    expect(await store.keys('global:')).toEqual(['global:prefs']);
    await store.remove('global:prefs');
    stop();
    await store.set('global:after', 1);
    expect(seen).toEqual([['global:prefs'], ['global:prefs']]);
  });

  it('secrets: strings in session storage, null when missing', async () => {
    const secrets = createSessionSecrets();
    expect(await secrets.get('sesskey')).toBeNull();
    await secrets.set('sesskey', 'abc123XYZ0');
    expect(await secrets.get('sesskey')).toBe('abc123XYZ0');
    expect(await browser.storage.local.get('sesskey')).toEqual({});
    await secrets.remove('sesskey');
    expect(await secrets.get('sesskey')).toBeNull();
  });

  it('alarms: schedule, list, cancel', async () => {
    const alarms = createAlarmScheduler();
    await alarms.schedule('reminders', { at: 2_000_000_000 });
    await alarms.schedule('sync', { delayMinutes: 5, periodMinutes: 180 });
    const listed = await alarms.list();
    expect(listed.find((a) => a.name === 'reminders')).toEqual({ name: 'reminders', at: 2_000_000_000, periodMinutes: null });
    expect(listed.find((a) => a.name === 'sync')?.periodMinutes).toBe(180);
    expect(await alarms.cancel('sync')).toBe(true);
    expect((await alarms.list()).map((a) => a.name)).toEqual(['reminders']);
  });
});
