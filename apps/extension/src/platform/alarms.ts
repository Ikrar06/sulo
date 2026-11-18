import { browser } from 'wxt/browser';
import type { AlarmScheduler } from '@sulo/core/platform';

/** chrome.alarms. Chrome fires an alarm no sooner than 30 seconds from now. */
export function createAlarmScheduler(): AlarmScheduler {
  return {
    async schedule(name, when) {
      const period = when.periodMinutes !== undefined ? { periodInMinutes: when.periodMinutes } : {};
      // A time, or a delay (Chrome takes one of the two).
      if (when.at !== undefined) await browser.alarms.create(name, { when: when.at * 1000, ...period });
      else await browser.alarms.create(name, { delayInMinutes: when.delayMinutes ?? 0.5, ...period });
    },
    cancel: (name) => browser.alarms.clear(name),
    async list() {
      return (await browser.alarms.getAll()).map((a) => ({ name: a.name, at: Math.floor(a.scheduledTime / 1000), periodMinutes: a.periodInMinutes ?? null }));
    },
    onAlarm(listener) {
      const onAlarm = (alarm: { name: string }) => listener(alarm.name);
      browser.alarms.onAlarm.addListener(onAlarm);
      return () => browser.alarms.onAlarm.removeListener(onAlarm);
    },
  };
}
