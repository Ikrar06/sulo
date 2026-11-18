import { describe, expect, it } from 'vitest';
import { useNewAccount, wipeAllData, WIPE_WAIT_MS, type WipeDeps } from '@sulo/core/account/actions';
import { ACCOUNT_PENDING_KEY, newPending } from '@sulo/core/account/pending';
import { CURRENT_USER_KEY, pruneOrphanUserKeys } from '@sulo/core/storage';
import { memoryStore } from './helpers';

const NOW = 1_794_000_000;

describe('"Pakai akun ini"', () => {
  it('deletes the previous account only now, makes the other one current and opens setup at the connect step', async () => {
    const store = memoryStore({
      [CURRENT_USER_KEY]: 99,
      'u:99:tasks': [{ eventId: 1 }],
      'u:99:courses': [{ id: 5 }],
      [ACCOUNT_PENDING_KEY]: newPending(1, NOW),
      'global:prefs': { locale: 'en' },
    });
    const opened: string[] = [];
    let cleared = 0;
    expect(await useNewAccount({ store, clearNotifications: async () => void (cleared += 1), openSetup: async (h) => void opened.push(h) })).toBe(true);
    const dump = store.dump();
    expect(Object.keys(dump).filter((k) => k.startsWith('u:99:'))).toEqual([]);
    expect(dump[CURRENT_USER_KEY]).toBe(1);
    expect(dump[ACCOUNT_PENDING_KEY]).toBeUndefined();
    expect(dump['global:prefs']).toEqual({ locale: 'en' }); // device settings stay
    expect(cleared).toBe(1);
    expect(opened).toEqual(['#switch-account']);
  });

  it('does nothing without a detected account', async () => {
    const store = memoryStore({ [CURRENT_USER_KEY]: 99, 'u:99:tasks': [] });
    expect(await useNewAccount({ store, clearNotifications: async () => {}, openSetup: async () => {} })).toBe(false);
    expect(store.dump()['u:99:tasks']).toEqual([]);
  });

  it('while only detected, the previous data is never pruned as orphaned', async () => {
    const store = memoryStore({ [CURRENT_USER_KEY]: 99, 'u:99:tasks': [], [ACCOUNT_PENDING_KEY]: newPending(1, NOW) });
    expect(await pruneOrphanUserKeys(store)).toEqual([]);
    expect(store.dump()['u:99:tasks']).toEqual([]);
  });
});

describe('pruning orphaned keys while the first sync writes', () => {
  it("never deletes the first account's data written between pruning's two reads", async () => {
    const base = memoryStore();
    let synced = false;
    // The first sync lands right after pruning's first storage call, whichever it is.
    const firstSync = async () => {
      if (synced) return;
      synced = true;
      await base.set(CURRENT_USER_KEY, 1);
      await base.set('u:1:tasks', [{ eventId: 1 }]);
    };
    const store = {
      ...base,
      get: async <T,>(key: string) => {
        const value = await base.get<T>(key);
        await firstSync();
        return value;
      },
      keys: async (prefix: string) => {
        const keys = await base.keys(prefix);
        await firstSync();
        return keys;
      },
    };
    expect(await pruneOrphanUserKeys(store)).toEqual([]);
    expect(base.dump()['u:1:tasks']).toEqual([{ eventId: 1 }]);
  });
});

describe('"Hapus semua data"', () => {
  function deps(running: boolean[] = []) {
    const log: string[] = [];
    const d: WipeDeps = {
      syncRunning: async () => running.shift() ?? false,
      sleep: async (ms) => void log.push(`sleep ${ms}`),
      clearAlarms: async () => void log.push('alarms'),
      clearNotifications: async () => void log.push('notifications'),
      clearLocal: async () => void log.push('local'),
      clearSession: async () => void log.push('session'),
      ensureAlarms: async () => void log.push('ensureAlarms'),
      openSetup: async (h) => void log.push(`setup${h}`),
    };
    return { d, log };
  }

  it('clears alarms, notifications, local and session storage, then restores the base alarms and opens setup', async () => {
    const { d, log } = deps();
    await wipeAllData(d);
    expect(log).toEqual(['alarms', 'notifications', 'local', 'session', 'ensureAlarms', 'setup']);
  });

  it('waits for a running sync first, so it cannot write back', async () => {
    const { d, log } = deps([true, true, false]);
    await wipeAllData(d);
    expect(log.slice(0, 3)).toEqual(['sleep 500', 'sleep 500', 'alarms']);
  });

  it('gives up waiting after 30 seconds', async () => {
    const { d, log } = deps(Array.from({ length: 200 }, () => true));
    await wipeAllData(d);
    expect(log.filter((l) => l.startsWith('sleep'))).toHaveLength(WIPE_WAIT_MS / 500);
    expect(log.at(-1)).toBe('setup');
  });
});
