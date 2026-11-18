import { beforeEach, describe, expect, it, vi } from 'vitest';

// Capacitor plugins in memory (as in platform.test.ts).
const prefs = new Map<string, string>();
vi.mock('@capacitor/preferences', () => ({
  Preferences: {
    get: async ({ key }: { key: string }) => ({ value: prefs.get(key) ?? null }),
    set: async ({ key, value }: { key: string; value: string }) => void prefs.set(key, value),
    remove: async ({ key }: { key: string }) => void prefs.delete(key),
    keys: async () => ({ keys: [...prefs.keys()] }),
  },
}));
const scheduled: { id: number; title: string; at: number; extra?: { suloId?: string } }[] = [];
const cancelled: number[] = [];
vi.mock('@capacitor/local-notifications', () => ({
  LocalNotifications: {
    schedule: async ({ notifications }: { notifications: { id: number; title: string; extra?: { suloId?: string }; schedule?: { at: Date } }[] }) =>
      void scheduled.push(...notifications.map((n) => ({ id: n.id, title: n.title, extra: n.extra, at: n.schedule?.at.getTime() ?? 0 }))),
    cancel: async ({ notifications }: { notifications: { id: number }[] }) => void cancelled.push(...notifications.map((n) => n.id)),
    getPending: async () => ({ notifications: [] }),
    addListener: async () => ({ remove: async () => undefined }),
  },
}));
vi.mock('../src/session', () => ({ SuloSession: { request: async () => ({}), page: async () => ({}), status: async () => ({ status: 'connected' }) } }));

const nav = await import('../src/shell/nav');
const { screenForNotification } = await import('../src/shell/notify-route');
const { doneToast } = await import('@sulo/ui/dashboard/done-undo');
const { UNDO_MS } = await import('@sulo/core/tasks/done-undo');
const { mobileDash, mobileWords } = await import('@sulo/core/i18n/mobile');
const { createPreferencesStore } = await import('../src/platform/store');
const { planReminders, scheduleReminders, clearScheduledReminders, HORIZON_DAYS, SCHEDULED_KEY } = await import('../src/reminders');
const { outcomeNote } = await import('../src/App');
const { syncNow, refreshPresensi } = await import('../src/sync');
const { mountedCount, PAGE_ROWS } = await import('../src/screens/LongList');
const { damp, PULL_THRESHOLD } = await import('../src/shell/PullToRefresh');
const { systemClock } = await import('@sulo/core/clock');

describe('Android back button and tabs', () => {
  const { START, open, back, selectTab, current, parseScreen } = nav;

  it('back closes the detail on top, then returns to the previous tab, then leaves the app', () => {
    let s = open(START, { name: 'tugas', detail: null });
    s = open(s, { name: 'tugas', detail: '42' });
    expect(current(s)).toEqual({ name: 'tugas', detail: '42' });
    let b = back(s);
    expect(b !== 'exit' && current(b)).toEqual({ name: 'tugas', detail: null });
    b = back(b as nav.NavState);
    expect(b !== 'exit' && b.tab).toBe('ringkasan');
    expect(back(b as nav.NavState)).toBe('exit');
  });

  it('pages under Lainnya stack on its tab; back returns to the list', () => {
    let s = selectTab(START, 'lainnya');
    s = open(s, { name: 'pengaturan', detail: null });
    expect(s.tab).toBe('lainnya');
    expect(current(s).name).toBe('pengaturan');
    const b = back(s);
    expect(b !== 'exit' && current(b)).toEqual({ name: 'lainnya', detail: null });
  });

  it('a link from another tab opens in its own tab (Ringkasan to a task)', () => {
    const s = open(START, { name: 'tugas', detail: '7' });
    expect(s.tab).toBe('tugas');
    expect(s.history).toEqual(['ringkasan']);
    const b = back(s);
    expect(b !== 'exit' && current(b)).toEqual({ name: 'tugas', detail: null });
  });

  it('the current tab again goes back to its first screen; a task replaces a task', () => {
    let s = open(START, { name: 'tugas', detail: '1' });
    s = open(s, { name: 'tugas', detail: '2' });
    expect(s.stack).toEqual([{ name: 'tugas', detail: '2' }]);
    expect(selectTab(s, 'tugas').stack).toEqual([]);
  });

  it('a tab is in the history once; back from a tab with no history goes to Ringkasan', () => {
    let s = selectTab(START, 'tugas');
    s = selectTab(s, 'kalender');
    s = selectTab(s, 'tugas');
    expect(s.history).toEqual(['ringkasan', 'kalender']);
    const lone = { tab: 'presensi' as const, stack: [], history: [] };
    expect(back(lone)).toEqual({ tab: 'ringkasan', stack: [], history: [] });
  });

  it('dashboard hashes and the phone-only screens parse', () => {
    expect(parseScreen('#tugas/123')).toEqual({ name: 'tugas', detail: '123' });
    expect(parseScreen('#presensi/36673')).toEqual({ name: 'presensi', detail: '36673' });
    expect(parseScreen('#privasi')).toEqual({ name: 'privasi', detail: null });
    expect(parseScreen('#lainnya')).toEqual({ name: 'lainnya', detail: null });
    expect(parseScreen('#nonsense')).toEqual({ name: 'ringkasan', detail: null });
  });
});

describe('tapping a reminder opens the right screen', () => {
  it('a task opens its details; calendar opens Kalender; updates open Kabar', () => {
    expect(screenForNotification('task|9|1440')).toEqual({ name: 'tugas', detail: '9' });
    expect(screenForNotification('calendar|uas-2026|h-1')).toEqual({ name: 'kalender', detail: null });
    expect(screenForNotification('changes|course:401')).toEqual({ name: 'kabar', detail: '401' });
    expect(screenForNotification('summary|2026-11-18')).toEqual({ name: 'tugas', detail: null });
    // The morning summary opens Ringkasan (M8c.3); background news about one task opens it.
    expect(screenForNotification('morning|2026-11-18')).toEqual({ name: 'ringkasan', detail: null });
    expect(screenForNotification('changes|task:103:added')).toEqual({ name: 'tugas', detail: '103' });
    expect(screenForNotification('something-else')).toEqual({ name: 'ringkasan', detail: null });
  });
});

describe('the "Urungkan" snackbar after marking a task done', () => {
  it('says the task is done, offers Urungkan for 5 seconds, then lets the row leave', () => {
    const calls: string[] = [];
    const t = doneToast(mobileDash('id'), { undo: () => calls.push('undo'), timeout: () => calls.push('leave') });
    expect(UNDO_MS).toBe(5000);
    expect(t.duration).toBe(5000);
    expect(t.message).toBe(mobileDash('id').tugas.markedDone);
    expect(t.action?.label).toBe('Urungkan');
    t.action!.onClick();
    t.onTimeout!();
    expect(calls).toEqual(['undo', 'leave']);
  });
});

describe('reminders scheduled on the phone', () => {
  beforeEach(() => {
    prefs.clear();
    scheduled.length = 0;
    cancelled.length = 0;
  });
  const course = (now: number) => ({ id: 5, fullname: 'HIDROLOGI A [D001]', shortname: 'H', startdate: now - 30 * 86_400, enddate: 0, parsed: { name: 'Hidrologi', classLabel: 'A', code: 'D001' }, inProgress: true, past: false, activeScore: 0, activeReasons: [], activePin: true, alias: null, color: null });
  const task = (now: number, eventId: number, dueAt: number) => ({ eventId, cmId: null, courseId: 5, name: `Laporan ${eventId}`, module: 'assign', dueAt, url: `https://x/${eventId}`, overdue: false, firstSeenAt: now, lastSeenAt: now, missingSince: null });

  it('plans only the next 7 days, and a fresh plan replaces the previous one', async () => {
    const store = createPreferencesStore();
    const now = 1_800_000_000;
    await store.set('global:currentUser', 1);
    await store.set('u:1:courses', [course(now)]);
    await store.set('u:1:tasks', [task(now, 1, now + 2 * 86_400), task(now, 2, now + 20 * 86_400)]);
    const planned = await planReminders(store, now, 'Asia/Makassar', 'id-ID');
    expect(planned.length).toBeGreaterThan(0);
    expect(planned.every((p) => p.at <= now + HORIZON_DAYS * 86_400)).toBe(true);
    expect(planned.some((p) => p.id.startsWith('task|1|'))).toBe(true);
    expect(planned.some((p) => p.id.startsWith('task|2|'))).toBe(false);

    const platform = { store, clock: { now: () => now, today: () => '2027-01-15' } } as never;
    const first = await scheduleReminders(platform);
    expect(first).toBeGreaterThan(0);
    expect(scheduled.every((s) => typeof s.extra?.suloId === 'string')).toBe(true);
    const ids = (await store.get<number[]>(SCHEDULED_KEY)) ?? [];
    await scheduleReminders(platform);
    expect(cancelled).toEqual(ids);
    await clearScheduledReminders(platform);
    expect(await store.get(SCHEDULED_KEY)).toBeUndefined();
  });

  it('quiet hours hold: nothing is planned inside them (the core planner moves it out)', async () => {
    const store = createPreferencesStore();
    // 18 Nov 2026, 12.00 WITA.
    const now = Date.UTC(2026, 10, 18, 4, 0) / 1000;
    await store.set('global:currentUser', 1);
    await store.set('u:1:courses', [course(now)]);
    // Due 21 Nov at 23.30: the H-1 and H-3 stages fall inside quiet hours.
    await store.set('u:1:tasks', [task(now, 3, now + 3 * 86_400 + 11.5 * 3600)]);
    await store.set('global:prefs', { reminders: { quiet: { enabled: true, startMin: 22 * 60, endMin: 6 * 60 }, lastStageDuringQuiet: false } });
    const planned = await planReminders(store, now, 'Asia/Makassar', 'id-ID');
    const minuteOf = (at: number) => (Math.floor(at / 60) + 8 * 60) % (24 * 60);
    expect(planned.length).toBeGreaterThan(0);
    expect(planned.every((p) => minuteOf(p.at) >= 6 * 60 && minuteOf(p.at) < 22 * 60)).toBe(true);
    // Without quiet hours the same task has reminders at 23.30.
    await store.set('global:prefs', { reminders: { quiet: { enabled: false, startMin: 22 * 60, endMin: 6 * 60 }, lastStageDuringQuiet: false } });
    const loud = await planReminders(store, now, 'Asia/Makassar', 'id-ID');
    expect(loud.some((p) => minuteOf(p.at) === 23 * 60 + 30)).toBe(true);
  });
});

describe('Perbarui without a connection', () => {
  it('sends nothing and says "Tidak ada koneksi"', async () => {
    const online = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
    Object.defineProperty(globalThis, 'navigator', { value: { onLine: false, language: 'id' }, configurable: true });
    try {
      const platform = { store: createPreferencesStore(), clock: systemClock } as never;
      const outcome = await syncNow(platform, { userInitiated: true });
      expect(outcome).toEqual({ status: 'offline' });
      expect(outcomeNote(outcome, mobileWords('id'))).toBe('Tidak ada koneksi');
      expect(await refreshPresensi(platform, 'recap', null, true)).toEqual({ status: 'failed', reason: 'offline' });
    } finally {
      if (online) Object.defineProperty(globalThis, 'navigator', online);
    }
  });

  it('the other outcomes: up to date, failed, nothing for ok or an ended session', () => {
    const w = mobileWords('id');
    expect(outcomeNote({ status: 'skipped', reason: 'FRESH' }, w)).toBe(w.connected.upToDate);
    expect(outcomeNote({ status: 'server_error' }, w)).toBe(w.connected.failed);
    // The daily limit: one calm line, no numbers or technical words; the loop guard says "sebentar".
    const day = outcomeNote({ status: 'skipped', reason: 'BUDGET_EXHAUSTED' }, w, 'day');
    expect(day).toBe('Sulo istirahat dulu sampai besok. Data terakhir tetap bisa dibuka.');
    expect(day).not.toMatch(/\d|batas|anggaran|request|POST/i);
    expect(outcomeNote({ status: 'skipped', reason: 'BUDGET_EXHAUSTED' }, w, 'short')).toBe(w.app.restShort);
    expect(outcomeNote({ status: 'ok', at: 0, tasks: 0, courseListFetched: false }, w)).toBe('');
    expect(outcomeNote({ status: 'session_expired' }, w)).toBe('');
  });
});

describe('long lists and pull to update', () => {
  it('mounts 100 rows at a time', () => {
    expect(PAGE_ROWS).toBe(100);
    expect(mountedCount(40, 1)).toBe(40);
    expect(mountedCount(250, 1)).toBe(100);
    expect(mountedCount(250, 2)).toBe(200);
    expect(mountedCount(250, 5)).toBe(250);
  });

  it('pulling follows the finger at half speed; the threshold needs a deliberate pull', () => {
    expect(damp(-10)).toBe(0);
    expect(damp(60)).toBe(30);
    expect(damp(2 * PULL_THRESHOLD)).toBe(PULL_THRESHOLD);
    expect(damp(1000)).toBeLessThanOrEqual(96);
  });
});

describe('the phone says "on this phone", never "in your browser"', () => {
  it('task details and About in both languages', () => {
    for (const l of ['id', 'en'] as const) {
      const d = mobileDash(l);
      for (const text of [d.tugas.stepsHelp, d.tugas.customDueHelp, ...d.tentang.points]) expect(text.toLowerCase()).not.toMatch(/browser/);
    }
  });
});
