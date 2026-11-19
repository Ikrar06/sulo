import { describe, expect, it } from 'vitest';
import { readSession, writeSession } from '@sulo/core/moodle/session';
import type { Clock, KeyValueStore } from '@sulo/core/types';
import { alignSession } from '../src/session-truth';
import { confirmDelayMs } from '../src/sync';

function memory(): KeyValueStore {
  const m = new Map<string, unknown>();
  return {
    get: async <T>(k: string) => m.get(k) as T | undefined,
    set: async (k, v) => void m.set(k, v),
    remove: async (keys) => void [keys].flat().forEach((k) => m.delete(k)),
    keys: async (start) => [...m.keys()].filter((k) => k.startsWith(start)),
    watch: () => () => undefined,
  };
}
const clock = { now: () => 1_795_125_000 } as unknown as Clock;

describe('the vault is the one source of truth for the session', () => {
  it('a stored EXPIRED is cleared on open while the vault still holds a session', async () => {
    const store = memory();
    await writeSession(store, clock, 'EXPIRED', 7);
    expect(await alignSession({ store, clock }, 'connected')).toBe('core_expired_cleared');
    expect((await readSession(store)).state).toBe('UNKNOWN');
  });

  it('an ended vault makes the screens say so too', async () => {
    const store = memory();
    await writeSession(store, clock, 'OK', 7);
    expect(await alignSession({ store, clock }, 'expired')).toBe('core_expired_from_vault');
    expect((await readSession(store)).state).toBe('EXPIRED');
  });

  it('nothing changes when both agree', async () => {
    const store = memory();
    await writeSession(store, clock, 'OK', 7);
    expect(await alignSession({ store, clock }, 'connected')).toBeNull();
    expect(await alignSession({ store, clock }, 'none')).toBeNull();
  });
});

describe('the second ask waits 2 to 5 seconds', () => {
  it('stays inside the window', () => {
    expect(confirmDelayMs(() => 0)).toBe(2000);
    expect(confirmDelayMs(() => 0.999999)).toBeLessThanOrEqual(5000);
    expect(confirmDelayMs(() => 0.5)).toBe(3500);
  });
});
