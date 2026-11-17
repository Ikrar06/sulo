import { describe, expect, it } from 'vitest';
import { notificationId, parseNotificationId, pruneSent, runNotifyCycle, type Notifier } from '../lib/reminders/run';
import { SESSION_KEY } from '../lib/moodle/session';
import { CURRENT_USER_KEY, pruneOrphanUserKeys, userKey, writeUserIfCurrent } from '../lib/storage';
import type { CourseRecord, Task } from '../lib/types';
import { memoryStore } from './helpers';

const H = 3600;
const NOW = Date.UTC(2026, 10, 19, 4, 0) / 1000; // Thu 19 Nov 2026, 12.00 WITA
const course: CourseRecord = {
  id: 1, fullname: 'FISIKA DASAR', shortname: 'FD', startdate: NOW - 90 * 86_400, enddate: NOW + 90 * 86_400,
  parsed: { name: 'Fisika Dasar', classLetter: 'B', program: null, code: null, matched: true },
  inProgress: true, past: false, activeScore: 8, activeReasons: ['inprogress'], activePin: null, alias: null, color: null,
};
const task: Task = {
  eventId: 7, cmId: 70, courseId: 1, name: 'Laporan praktikum', module: 'assign', dueAt: NOW + 3 * H, url: 'https://sikola-v2.unhas.ac.id/mod/assign/view.php?id=70',
  overdue: false, firstSeenAt: 0, lastSeenAt: 0, missingSince: null,
};

function setup() {
  return memoryStore({
    [CURRENT_USER_KEY]: 5,
    [userKey(5, 'tasks')]: [task],
    [userKey(5, 'courses')]: [course],
    [SESSION_KEY]: { state: 'OK', userId: 5, checkedAt: NOW },
  });
}

describe('notification cycle', () => {
  it('records the key before showing, with text in the chosen language', async () => {
    const store = setup();
    const shown: { id: string; title: string; message: string; recordedFirst: boolean }[] = [];
    const notifier: Notifier = {
      show: async (id, view) => {
        const notified = (await store.get<Record<string, number>>(userKey(5, 'notified'))) ?? {};
        shown.push({ id, title: view.title, message: view.message, recordedFirst: Object.keys(notified).length > 0 });
      },
    };
    const result = await runNotifyCycle({ store, now: NOW, timeZone: 'Asia/Makassar', uiLanguage: 'id', notifier });
    expect(shown).toEqual([
      { id: `task|7|t:7:180:${NOW + 3 * H}`, title: 'Laporan praktikum, 3 jam lagi', message: 'Fisika Dasar. Tenggat hari ini 15.00.', recordedFirst: true },
    ]);
    expect(result.shown).toBe(1);
  });

  it('never shows the same reminder twice across cycles', async () => {
    const store = setup();
    let count = 0;
    const notifier: Notifier = { show: async () => void (count += 1) };
    for (const offset of [0, 60, 600, 3600]) {
      await runNotifyCycle({ store, now: NOW + offset, timeZone: 'Asia/Makassar', uiLanguage: 'id', notifier });
    }
    expect(count).toBe(1);
  });

  it('stays silent while another account is signed in, and resumes when it is resolved', async () => {
    const store = setup();
    await store.set('global:accountPending', { userId: 6, detectedAt: NOW, lastCheckAt: NOW, deferredAt: null });
    let count = 0;
    const notifier: Notifier = { show: async () => void (count += 1) };
    expect(await runNotifyCycle({ store, now: NOW, timeZone: 'Asia/Makassar', uiLanguage: 'id', notifier })).toEqual({ nextAt: null, shown: 0 });
    expect(count).toBe(0);
    await store.remove('global:accountPending');
    await runNotifyCycle({ store, now: NOW, timeZone: 'Asia/Makassar', uiLanguage: 'id', notifier });
    expect(count).toBe(1);
  });

  it('counts a failed notification and does not retry it', async () => {
    const store = setup();
    let attempts = 0;
    const notifier: Notifier = { show: async () => { attempts += 1; throw new Error('blocked'); } };
    await runNotifyCycle({ store, now: NOW, timeZone: 'Asia/Makassar', uiLanguage: 'id', notifier });
    await runNotifyCycle({ store, now: NOW + 60, timeZone: 'Asia/Makassar', uiLanguage: 'id', notifier });
    expect(attempts).toBe(1);
    expect(await store.get(userKey(5, 'stats'))).toEqual({ notifyFailures: 1, lastNotifyFailureAt: NOW });
  });

  it('follows the stored language', async () => {
    const store = setup();
    await store.set('global:prefs', { locale: 'en' });
    const titles: string[] = [];
    await runNotifyCycle({ store, now: NOW, timeZone: 'Asia/Makassar', uiLanguage: 'id', notifier: { show: async (_id, v) => void titles.push(`${v.title} | ${v.message}`) } });
    expect(titles).toEqual(['Laporan praktikum, 3 hours left | Fisika Dasar. Due today 15:00.']);
  });

  it('notifies once when the session expires, with the sleepy mascot', async () => {
    const store = setup();
    await store.set(userKey(5, 'tasks'), []);
    await store.set(SESSION_KEY, { state: 'EXPIRED', userId: 5, checkedAt: NOW, expiredAt: NOW });
    const views: string[] = [];
    const notifier: Notifier = { show: async (id, v) => void views.push(`${id} ${v.icon}`) };
    await runNotifyCycle({ store, now: NOW, timeZone: 'Asia/Makassar', uiLanguage: 'id', notifier });
    await runNotifyCycle({ store, now: NOW + H, timeZone: 'Asia/Makassar', uiLanguage: 'id', notifier });
    expect(views).toEqual([`session|s:${NOW} sleepy`]);
  });
});

describe('notification ids and pruning', () => {
  it('round-trips the task id for click handling', () => {
    const id = notificationId({ kind: 'task', key: 't:7:180:1', task, snoozed: false });
    expect(parseNotificationId(id)).toEqual({ kind: 'task', eventId: 7, entryId: null, courseId: null });
    expect(parseNotificationId('summary|sum:1')).toEqual({ kind: 'summary', eventId: null, entryId: null, courseId: null });
    // Several updates for one course open "Kabar terbaru" filtered to it.
    expect(parseNotificationId('changes|course:401|chg:401:1')).toEqual({ kind: 'changes', eventId: null, entryId: null, courseId: 401 });
    expect(parseNotificationId('changes|task:9:added')).toEqual({ kind: 'changes', eventId: null, entryId: 'task:9:added', courseId: null });
    expect(parseNotificationId('changes|task:5:added')).toEqual({ kind: 'changes', eventId: null, entryId: 'task:5:added', courseId: null });
  });

  it('drops keys older than 30 days and keys of tasks that are gone', () => {
    const sent = { 't:7:180:1': NOW, 't:8:180:1': NOW, 's:1': NOW - 31 * 86_400, 'm:2026-11-19': NOW };
    expect(pruneSent(sent, NOW, new Set([7]))).toEqual({ 't:7:180:1': NOW, 'm:2026-11-19': NOW });
  });
});

describe('account switch during a reminder cycle', () => {
  it('stops without writing anything when the account changed after planning', async () => {
    const store = setup();
    let reads = 0;
    // The first read sees account 5; the switch to 6 lands before the write.
    const switching = {
      ...store,
      get: async <T,>(key: string) => {
        if (key === CURRENT_USER_KEY && reads++ > 0) return 6 as T;
        return store.get<T>(key);
      },
    };
    const shown: string[] = [];
    await runNotifyCycle({ store: switching, now: NOW, timeZone: 'Asia/Makassar', uiLanguage: 'id', notifier: { show: async (id) => void shown.push(id) } });
    expect(shown).toEqual([]);
    expect(await store.get(userKey(5, 'notified'))).toBeUndefined();
  });

  it('does not show the next notification once the account changed', async () => {
    const store = setup();
    await store.set(userKey(5, 'tasks'), [task, { ...task, eventId: 8, dueAt: NOW + 3 * H }]);
    const shown: string[] = [];
    const notifier: Notifier = {
      show: async (id) => {
        shown.push(id);
        await store.set(CURRENT_USER_KEY, 6);
      },
    };
    // Two tasks due at once become one summary, so use two separate notices: task + session.
    await store.set(SESSION_KEY, { state: 'EXPIRED', userId: 5, checkedAt: NOW, expiredAt: NOW });
    await runNotifyCycle({ store, now: NOW, timeZone: 'Asia/Makassar', uiLanguage: 'id', notifier });
    expect(shown).toHaveLength(1);
  });
});

describe('orphaned account keys', () => {
  it('removes keys of any account that is not active (or waiting)', async () => {
    const store = memoryStore({ [CURRENT_USER_KEY]: 5, 'u:5:tasks': [], 'u:4:notified': {}, 'u:4:stats': {}, 'u:9:tasks': [], 'global:prefs': {} });
    expect((await pruneOrphanUserKeys(store, [9])).sort()).toEqual(['u:4:notified', 'u:4:stats']);
    expect(Object.keys(store.dump()).sort()).toEqual(['global:currentUser', 'global:prefs', 'u:5:tasks', 'u:9:tasks']);
  });
});

describe('compare-and-set writes (onboarding tab of another account)', () => {
  it('writes only while the expected account is still active', async () => {
    const store = memoryStore({ [CURRENT_USER_KEY]: 6 });
    expect(await writeUserIfCurrent(store, 5, 'courses', [])).toBe(false);
    expect(store.dump()['u:5:courses']).toBeUndefined();
    expect(await writeUserIfCurrent(store, 6, 'courses', [])).toBe(true);
    expect(store.dump()['u:6:courses']).toEqual([]);
  });
});
