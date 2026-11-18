import { describe, expect, it } from 'vitest';
import { CURRENT_USER_KEY, DEFAULTS, currentUser, readAllUser, readUser, switchUser, userKey, writeUser } from '@sulo/core/storage';
import { memoryStore } from './helpers';

describe('per-user storage', () => {
  it('namespaces keys by userid', () => {
    expect(userKey(7, 'tasks')).toBe('u:7:tasks');
  });

  it('returns defaults when nothing is stored', async () => {
    expect(await readUser(memoryStore(), 7, 'tasks')).toEqual([]);
    expect(await readAllUser(memoryStore(), 7)).toEqual(DEFAULTS);
  });

  it('keeps data when the same user syncs again', async () => {
    const store = memoryStore();
    await switchUser(store, 7);
    await writeUser(store, 7, 'courses', []);
    expect(await switchUser(store, 7)).toBe(false);
    expect(store.dump()['u:7:courses']).toEqual([]);
  });

  it("deletes the previous user's data when the userid changes", async () => {
    const store = memoryStore({ 'global:budget': { date: 'x', used: 3 } });
    await switchUser(store, 7);
    await writeUser(store, 7, 'tasks', []);
    await writeUser(store, 7, 'onboarding', { completedAt: 1, confirmedInProgress: [1], reviewSuggested: [] });
    expect(await switchUser(store, 8)).toBe(true);
    const keys = Object.keys(store.dump());
    expect(keys.filter((k) => k.startsWith('u:7:'))).toEqual([]);
    expect(keys).toContain('global:budget');
    expect(await currentUser(store)).toBe(8);
  });

  it('also cleans leftovers when no current user was recorded', async () => {
    const store = memoryStore({ 'u:5:tasks': [] });
    expect(await switchUser(store, 8)).toBe(true);
    expect(store.dump()).toEqual({ [CURRENT_USER_KEY]: 8 });
  });
});
