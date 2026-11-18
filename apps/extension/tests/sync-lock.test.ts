import { describe, expect, it } from 'vitest';
import { createSingleFlight, isSyncRunning, LOCK_RENEW_MS, LOCK_TTL_S, SYNC_LOCK_KEY, type SyncLock } from '@sulo/core/sync/lock';
import type { SyncOutcome } from '@sulo/core/types';
import { memoryStore } from './helpers';

const NOW = 1_795_000_000;

function setup(start = NOW) {
  const store = memoryStore();
  let now = start;
  let id = 0;
  const timers: (() => void)[] = [];
  let runs = 0;
  let release: (o: SyncOutcome) => void = () => {};
  const flight = createSingleFlight<string>({
    store,
    now: () => now,
    newId: () => `cycle-${++id}`,
    run: () => {
      runs += 1;
      return new Promise<SyncOutcome>((resolve) => (release = resolve));
    },
    setInterval: (fn) => {
      timers.push(fn);
      return timers.length;
    },
    clearInterval: () => void timers.splice(0),
  });
  return {
    store,
    flight,
    tick: (seconds: number) => {
      now += seconds;
    },
    fireTimers: async () => {
      for (const t of timers) t();
      await new Promise((r) => setTimeout(r, 0));
    },
    finish: (o: SyncOutcome = { status: 'ok', at: now, tasks: 0, courseListFetched: false }) => release(o),
    runs: () => runs,
    lock: () => store.get<SyncLock>(SYNC_LOCK_KEY),
  };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('single-flight sync', () => {
  it('two triggers at once share one run (one request)', async () => {
    const s = setup();
    const a = s.flight('popup');
    const b = s.flight('manual');
    await flush();
    expect(s.runs()).toBe(1);
    expect(await isSyncRunning(s.store, NOW)).toBe(true);
    s.finish();
    expect(await a).toEqual(await b);
    expect(await s.lock()).toBeUndefined();
  });

  it('a live lock from another worker blocks a new cycle without a request', async () => {
    const s = setup();
    await s.store.set<SyncLock>(SYNC_LOCK_KEY, { cycleId: 'other-worker', expiresAt: NOW + 60 });
    expect(await s.flight('manual')).toEqual({ status: 'skipped', reason: 'BUSY' });
    expect(s.runs()).toBe(0);
  });

  it('an abandoned lock (not renewed for 2 minutes) is taken over', async () => {
    const s = setup();
    await s.store.set<SyncLock>(SYNC_LOCK_KEY, { cycleId: 'dead-worker', expiresAt: NOW - 1 });
    const run = s.flight('manual');
    await flush();
    expect(s.runs()).toBe(1);
    expect((await s.lock())?.cycleId).toBe('cycle-1');
    s.finish();
    await run;
  });

  it('a running sync renews its lock every 30 seconds, so it never expires while alive', async () => {
    const s = setup();
    const run = s.flight('background');
    await flush();
    for (let i = 0; i < 10; i++) {
      s.tick(LOCK_RENEW_MS / 1000);
      await s.fireTimers();
    }
    const lock = await s.lock();
    expect(lock?.cycleId).toBe('cycle-1');
    expect(lock!.expiresAt).toBe(NOW + 10 * (LOCK_RENEW_MS / 1000) + LOCK_TTL_S);
    s.finish();
    await run;
  });

  it('after a run, the next trigger starts a new cycle', async () => {
    const s = setup();
    const first = s.flight('manual');
    await flush();
    s.finish();
    await first;
    const second = s.flight('manual');
    await flush();
    expect(s.runs()).toBe(2);
    s.finish();
    await second;
  });
});
