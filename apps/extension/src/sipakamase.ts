// The Sipakamase module in the service worker (1.1.0): its life cycle, the
// keeper's alarm, "Perbarui sekarang" and the passive reader's messages,
// around core sipakamase/run.ts. No state in variables: everything is in
// storage, the queue only orders the work.

import { browser } from 'wxt/browser';
import { readRemoteConfig } from '@sulo/core/remote/remote-config';
import { sourcesFrom } from '@sulo/core/remote/sources';
import type { Scheduler } from '@sulo/core/net/scheduler';
import { disableSipakamase, enableSipakamase, readSipakamaseModule, reconcileSipakamase } from '@sulo/core/sipakamase/module';
import { keep, passive, refresh, type SipakamaseDeps } from '@sulo/core/sipakamase/run';
import { parsePassive } from '@sulo/core/sipakamase/schema';
import type { KeyValueStore, UnixSeconds } from '@sulo/core/types';
import { browserSipakamaseDeps } from './platform/sipakamase';

export const SIPAKAMASE_ALARM = 'sipakamase-keep';
/** How often the alarm asks the keeper; the keeper itself decides whether a read is due (3 hours or more). */
const ALARM_PERIOD_MIN = 30;

export function createSipakamaseService(opts: { store: KeyValueStore; scheduler: Scheduler; now: () => UnixSeconds; today: () => string }) {
  const module = browserSipakamaseDeps(opts.store, opts.now);
  const deps: SipakamaseDeps = {
    store: opts.store,
    scheduler: opts.scheduler,
    now: opts.now,
    today: opts.today,
    config: () => readRemoteConfig(opts.store),
  };
  // One piece of work at a time: a refresh, a keeper read and a passive message never interleave.
  let queue: Promise<unknown> = Promise.resolve();
  const serial = <T>(task: () => Promise<T>): Promise<T> => {
    const run = queue.then(task);
    queue = run.catch(() => undefined);
    return run;
  };

  /** The keeper's alarm exists only while the module is on and the owner lets it keep. */
  const ensureAlarm = async () => {
    const on = (await readSipakamaseModule(opts.store)).enabled && sourcesFrom(await readRemoteConfig(opts.store)).sipakamase.keep;
    const alarm = await browser.alarms.get(SIPAKAMASE_ALARM);
    if (!on) {
      if (alarm) await browser.alarms.clear(SIPAKAMASE_ALARM);
    } else if (!alarm) {
      await browser.alarms.create(SIPAKAMASE_ALARM, { delayInMinutes: ALARM_PERIOD_MIN, periodInMinutes: ALARM_PERIOD_MIN });
    }
  };

  return {
    ensureAlarm,
    enable: () =>
      serial(async () => {
        const result = await enableSipakamase(module, true);
        await ensureAlarm();
        return result;
      }),
    disable: () =>
      serial(async () => {
        await disableSipakamase(module);
        await ensureAlarm();
        return { ok: true };
      }),
    /** Startup and a removed permission. */
    reconcile: () => serial(() => reconcileSipakamase(module, true).then(async (r) => (await ensureAlarm(), r))).catch(() => 'off' as const),
    refresh: () => serial(() => refresh(deps)),
    keep: () => serial(() => keep(deps)).catch(() => undefined),
    passive: (raw: unknown) => serial(() => passive(deps, parsePassive(raw))).catch(() => 'ignored' as const),
  };
}
