import { beforeEach, describe, expect, it, vi } from 'vitest';

// @capacitor/preferences and local-notifications, in memory.
const prefs = new Map<string, string>();
vi.mock('@capacitor/preferences', () => ({
  Preferences: {
    get: async ({ key }: { key: string }) => ({ value: prefs.get(key) ?? null }),
    set: async ({ key, value }: { key: string; value: string }) => void prefs.set(key, value),
    remove: async ({ key }: { key: string }) => void prefs.delete(key),
    keys: async () => ({ keys: [...prefs.keys()] }),
  },
}));
const scheduled: { id: number; title: string; at: number }[] = [];
vi.mock('@capacitor/local-notifications', () => ({
  LocalNotifications: {
    schedule: async ({ notifications }: { notifications: { id: number; title: string; schedule?: { at: Date } }[] }) =>
      void scheduled.push(...notifications.map((n) => ({ id: n.id, title: n.title, at: n.schedule?.at.getTime() ?? 0 }))),
    cancel: async ({ notifications }: { notifications: { id: number }[] }) => {
      for (const { id } of notifications) scheduled.splice(0, scheduled.length, ...scheduled.filter((s) => s.id !== id));
    },
    getPending: async () => ({ notifications: [] }),
    addListener: async () => ({ remove: async () => undefined }),
  },
}));

// SuloSession: record what reaches the "native" side.
const sent: { body: string; userInitiated: boolean }[] = [];
let nativeReply: Record<string, unknown> = {};
const pagesAsked: { path: string; userInitiated: boolean }[] = [];
let pageReply: Record<string, unknown> = {};
vi.mock('../src/session', () => ({
  SuloSession: {
    request: async (o: { body: string; userInitiated: boolean }) => (sent.push(o), nativeReply),
    page: async (o: { path: string; userInitiated: boolean }) => (pagesAsked.push(o), pageReply),
    status: async () => ({ status: 'connected' }),
  },
}));

const { createPreferencesStore } = await import('../src/platform/store');
const { createSessionHttp, NATIVE_SESSKEY } = await import('../src/platform/http');
const { resumeNeedsSync, RESUME_STALE_SEC } = await import('../src/sync');
const { planReminders } = await import('../src/reminders');

beforeEach(() => {
  prefs.clear();
  sent.length = 0;
  scheduled.length = 0;
});

describe('KeyValueStore on @capacitor/preferences', () => {
  it('get, set, remove, keys, with a prefix, and watch', async () => {
    const store = createPreferencesStore();
    const seen: string[][] = [];
    const stop = store.watch((c) => seen.push(Object.keys(c)));
    await store.set('global:prefs', { locale: 'id' });
    expect(prefs.get('sulo:global:prefs')).toBe('{"locale":"id"}');
    expect(await store.get('global:prefs')).toEqual({ locale: 'id' });
    expect(await store.keys('global:')).toEqual(['global:prefs']);
    await store.remove(['global:prefs']);
    expect(await store.get('global:prefs')).toBeUndefined();
    stop();
    await store.set('x', 1);
    expect(seen).toEqual([['global:prefs'], ['global:prefs']]);
  });
});

describe('HttpClient through SuloSession', () => {
  const batch = (q = `sesskey=${NATIVE_SESSKEY}&nosessionupdate=true`) => [`https://sikola-v2.unhas.ac.id/lib/ajax/service.php?${q}`, { method: 'POST', body: '[{"index":0,"methodname":"core_session_time_remaining","args":{}}]' }] as const;

  it('hands the batch and userInitiated to the native side, never a sesskey', async () => {
    nativeReply = { httpStatus: 200, body: '[{"error":false,"data":{"timeremaining":7140}}]', sessionStatus: 'connected' };
    const res = await createSessionHttp(true).request(...batch());
    expect(sent).toEqual([{ body: batch()[1].body, userInitiated: true }]);
    expect(JSON.stringify(sent)).not.toContain(NATIVE_SESSKEY);
    expect(await res.json()).toEqual([{ error: false, data: { timeremaining: 7140 } }]);
    await createSessionHttp(false).request(...batch());
    expect(sent[1]!.userInitiated).toBe(false);
  });

  it('no session: answers like Moodle asking for a login', async () => {
    nativeReply = { sessionStatus: 'expired' };
    const res = await createSessionHttp(true).request(...batch());
    expect(await res.json()).toEqual([{ error: true, exception: { errorcode: 'servicerequireslogin', message: '' } }]);
  });

  it('a network failure is a fetch failure; pages and other hosts are not served', async () => {
    nativeReply = { sessionStatus: 'connected', networkError: 'UnknownHostException' };
    await expect(createSessionHttp(true).request(...batch())).rejects.toThrow(TypeError);
    expect((await createSessionHttp(true).request('https://sikola-v2.unhas.ac.id/my/', { method: 'GET' })).status).toBe(404);
    expect((await createSessionHttp(true).request('https://example.invalid/lib/ajax/service.php', { method: 'POST', body: '[]' })).status).toBe(404);
    // Only the first (failed) batch reached the native side.
    expect(sent).toHaveLength(1);
  });
});

describe('opening the app', () => {
  it('syncs only when the data is 15 minutes old or there is none', () => {
    expect(resumeNeedsSync(null, 1000)).toBe(true);
    expect(resumeNeedsSync(1000, 1000 + RESUME_STALE_SEC - 1)).toBe(false);
    expect(resumeNeedsSync(1000, 1000 + RESUME_STALE_SEC)).toBe(true);
  });
});

describe('reminders from the data already on the phone', () => {
  it('plays the core planner forward and never plans a session notice', async () => {
    const store = createPreferencesStore();
    const now = 1_800_000_000;
    const due = now + 2 * 86_400;
    await store.set('global:currentUser', 1);
    await store.set('global:session', { state: 'EXPIRED', userId: 1, checkedAt: now, expiredAt: now - 3 * 86_400 });
    await store.set('u:1:courses', [{ id: 5, fullname: 'HIDROLOGI A [D001]', shortname: 'H', startdate: now - 30 * 86_400, enddate: 0, parsed: { name: 'Hidrologi', classLabel: 'A', code: 'D001' }, inProgress: true, past: false, activeScore: 0, activeReasons: [], activePin: true, alias: null, color: null }]);
    await store.set('u:1:tasks', [{ eventId: 9, cmId: null, courseId: 5, name: 'Laporan', module: 'assign', dueAt: due, url: 'https://x/9', overdue: false, firstSeenAt: now, lastSeenAt: now, missingSince: null }]);
    const planned = await planReminders(store, now, 'Asia/Makassar', 'id-ID');
    expect(planned.length).toBeGreaterThan(0);
    expect(planned.every((p) => !p.id.startsWith('session|'))).toBe(true);
    // The H-1 reminder (24 hours before) is among them, from the last data.
    expect(planned.some((p) => p.at === due - 86_400)).toBe(true);
    // Nothing real changed: the planner ran on a copy.
    expect(await store.get('u:1:notified')).toBeUndefined();
  });
});

describe('the second ask over a new connection', () => {
  it('the core marker becomes the native fresh option, and nothing else asks for it', async () => {
    sent.length = 0;
    nativeReply = { httpStatus: 200, body: '[]', sessionStatus: 'connected' };
    const body = JSON.stringify([{ index: 0, methodname: 'core_session_time_remaining', args: {} }]);
    await createSessionHttp(true).request('https://sikola-v2.unhas.ac.id/lib/ajax/service.php?sesskey=x', { method: 'POST', body, headers: { 'X-Sulo-Fresh-Connection': '1' } });
    await createSessionHttp(true).request('https://sikola-v2.unhas.ac.id/lib/ajax/service.php?sesskey=x', { method: 'POST', body });
    expect(sent.map((o) => (o as { fresh?: boolean }).fresh ?? false)).toEqual([true, false]);
  });
});

describe('attendance pages through SuloSession.page', () => {
  const origin = 'https://sikola-v2.unhas.ac.id';
  beforeEach(() => {
    pagesAsked.length = 0;
  });

  it('a GET of the attendance page goes native with the user flag and comes back as HTML', async () => {
    pageReply = { httpStatus: 200, html: '<div data-userid="1"></div>', sessionStatus: 'connected' };
    const r = await createSessionHttp(true).request(`${origin}/mod/attendance/view.php?id=5&mode=1`, { method: 'GET' });
    expect(pagesAsked).toEqual([{ path: '/mod/attendance/view.php?id=5&mode=1', userInitiated: true }]);
    expect(r.status).toBe(200);
    expect(r.headers.get('content-type')).toBe('text/html');
    expect(await r.text()).toContain('data-userid');
  });

  it('no session: a redirect to the login, so core marks it expired', async () => {
    pageReply = { sessionStatus: 'expired' };
    const r = await createSessionHttp(true).request(`${origin}/mod/attendance/view.php?id=5&view=5`, { method: 'GET' });
    expect(r.status).toBe(303);
  });

  it('a redirect elsewhere is that course closed, never a sign-out (20 Nov 2026, the phone)', async () => {
    // Native already turns a redirect to SIKOLA's login into "expired"; any other one is the course's page.
    pageReply = { httpStatus: 303, html: '', sessionStatus: 'connected' };
    const r = await createSessionHttp(true).request(`${origin}/mod/attendance/view.php?id=5&mode=1`, { method: 'GET' });
    expect(r.status).toBe(403);
  });

  it('a network failure throws like fetch does', async () => {
    pageReply = { networkError: 'UnknownHostException', sessionStatus: 'connected' };
    await expect(createSessionHttp(true).request(`${origin}/mod/attendance/view.php?id=5&mode=1`, { method: 'GET' })).rejects.toThrow();
  });

  it('every other page is refused before anything reaches the native side', async () => {
    for (const path of ['/my/', '/mod/assign/view.php?id=1', '/mod/attendance/take.php?id=1', '/login/index.php']) {
      expect((await createSessionHttp(true).request(`${origin}${path}`, { method: 'GET' })).status).toBe(404);
    }
    expect((await createSessionHttp(true).request(`https://example.com/mod/attendance/view.php?id=1`, { method: 'GET' })).status).toBe(404);
    expect(pagesAsked).toEqual([]);
  });
});
