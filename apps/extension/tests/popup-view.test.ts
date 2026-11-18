import { describe, expect, it } from 'vitest';
import { DEFAULT_REMOTE_CONFIG } from '@sulo/core/remote/remote-config';
import { DEFAULT_SYNC_STATUS, DEFAULTS, type UserData } from '@sulo/core/storage';
import type { CourseRecord, Task } from '@sulo/core/types';
import { buildPopupView, type PopupInput } from '@sulo/core/view/popup-view';

const NOW = Date.UTC(2026, 8, 22, 4, 0) / 1000; // 12.00 WITA
const HOUR = 3600;

const course = (id: number, name: string, active: boolean): CourseRecord => ({
  id,
  fullname: `${name} A [23D0000000${id % 10}]`,
  shortname: '',
  startdate: 0,
  enddate: NOW + 90 * 86_400,
  parsed: { name, classLetter: 'A', program: null, code: null, matched: true },
  inProgress: active,
  past: !active,
  activeScore: active ? 6 : -3,
  activeReasons: [],
  activePin: null,
  alias: null,
  color: null,
});

const task = (eventId: number, courseId: number, dueAt: number | null, extra: Partial<Task> = {}): Task => ({
  eventId,
  cmId: null,
  courseId,
  name: `Tugas ${eventId}`,
  module: 'assign',
  dueAt,
  url: `https://sikola-v2.unhas.ac.id/mod/assign/view.php?id=${eventId}`,
  overdue: false,
  firstSeenAt: NOW,
  lastSeenAt: NOW,
  missingSince: null,
  ...extra,
});

const user = (patch: Partial<UserData> = {}): UserData => ({
  ...DEFAULTS,
  courses: [course(1, 'ANALISA STRUKTUR I', true), course(2, 'GAMBAR TEKNIK', false)],
  tasks: [task(10, 1, NOW - HOUR), task(11, 1, NOW + 5 * HOUR), task(12, 2, NOW + HOUR), task(13, 1, NOW + 9 * 86_400), task(14, 1, NOW, { missingSince: NOW })],
  sync: { lastSyncAt: NOW - 600, lastCourseListAt: NOW - 600 },
  onboarding: { completedAt: NOW - 86_400, confirmedInProgress: [1], reviewSuggested: [] },
  ...patch,
});

const input = (patch: Partial<PopupInput> = {}): PopupInput => ({
  user: user(),
  session: 'OK',
  syncStatus: DEFAULT_SYNC_STATUS,
  remoteConfig: DEFAULT_REMOTE_CONFIG,
  budget: { date: '2026-09-22', used: 3 },
  budgetLimit: 40,
  now: NOW,
  timeZone: 'Asia/Makassar',
  ...patch,
});

describe('buildPopupView', () => {
  it('shows only tasks of active courses, grouped, with labels and remaining time', () => {
    const view = buildPopupView(input());
    expect(view.groups.map((g) => [g.key, g.rows.map((r) => r.eventId)])).toEqual([
      ['overdue', [10]],
      ['soon', [11]],
      ['later', [13]],
    ]);
    expect(view.groups[0]?.rows[0]).toMatchObject({ courseColor: 1, courseName: 'Analisa Struktur I', urgency: 'overdue', remaining: 'terlambat 1 jam' });
    expect(view.groups.find((g) => g.key === 'later')?.collapsedByDefault).toBe(true);
    expect(view.inactiveCourseTaskCount).toBe(1);
    expect(view.probablySubmittedCount).toBe(1);
    expect(view.badge).toEqual({ text: '2', tone: 'urgent' });
    expect(view.mascot).toBe('urgent');
    expect(view.banner).toBeNull();
  });

  it('asks to finish onboarding before anything else', () => {
    const view = buildPopupView(input({ user: null }));
    expect(view.onboarded).toBe(false);
    expect(view.mascot).toBe('onboarding');
  });

  it.each([
    [{ remoteConfig: { ...DEFAULT_REMOTE_CONFIG, enabled: false, message: 'Jeda' } }, { kind: 'disabled_remotely', message: 'Jeda' }],
    [{ session: 'EXPIRED' as const }, { kind: 'session_expired', lastSyncAt: NOW - 600 }],
    [{ syncStatus: { ...DEFAULT_SYNC_STATUS, lastOutcome: { status: 'offline' as const } } }, { kind: 'offline' }],
    [{ online: false }, { kind: 'offline' }],
  ])('banner for %o', (patch, banner) => {
    expect(buildPopupView(input(patch)).banner).toEqual(banner);
  });

  // M5a.4: users never see budgets, backoff or parser trouble; only actionable messages and one plain "could not update" after 12 hours.
  describe('status message selection', () => {
    const old = (h: number) => user({ sync: { lastSyncAt: NOW - h * HOUR, lastCourseListAt: null } });
    const broken = { syncStatus: { ...DEFAULT_SYNC_STATUS, lastOutcome: { status: 'parser_broken' as const, where: 'x' } } };
    it('a full daily budget or a parser problem shows nothing while data is fresh', () => {
      expect(buildPopupView(input({ budget: { date: 'x', used: 999 } })).banner).toBeNull();
      expect(buildPopupView(input(broken)).banner).toBeNull();
      expect(buildPopupView(input({ syncStatus: { ...DEFAULT_SYNC_STATUS, lastOutcome: { status: 'skipped' as const, reason: 'BUDGET_EXHAUSTED' as const } } })).banner).toBeNull();
    });
    it('data up to 12 hours old shows nothing; older shows the plain stale message, whatever the cause', () => {
      expect(buildPopupView(input({ user: old(12) })).banner).toBeNull();
      expect(buildPopupView(input({ ...broken, user: old(13) })).banner).toEqual({ kind: 'stale', lastSyncAt: NOW - 13 * HOUR });
      expect(buildPopupView(input({ budget: { date: 'x', used: 999 }, user: old(30) })).banner?.kind).toBe('stale');
    });
    it('an expired session wins over old data (it can be acted on)', () => {
      expect(buildPopupView(input({ session: 'EXPIRED', user: old(30) })).banner).toEqual({ kind: 'session_expired', lastSyncAt: NOW - 30 * HOUR });
    });
  });

  it('does not call a server error or a slow SIKOLA "offline"', () => {
    const view = buildPopupView(input({ syncStatus: { ...DEFAULT_SYNC_STATUS, lastOutcome: { status: 'server_error' as const } } }));
    expect(view.banner?.kind).not.toBe('offline');
  });

  it('marks stale data, uses a neutral badge and the sleepy mascot', () => {
    const view = buildPopupView(input({ user: user({ sync: { lastSyncAt: NOW - 13 * HOUR, lastCourseListAt: null } }) }));
    expect(view.banner).toEqual({ kind: 'stale', lastSyncAt: NOW - 13 * HOUR });
    expect(view.badge.tone).toBe('neutral');
    expect(view.mascot).toBe('stale');
  });

  it('an expired session: grey badge with the count from the last data, no "!" and no red (M7.2)', () => {
    const view = buildPopupView(input({ session: 'EXPIRED' }));
    expect(view.badge.tone).toBe('neutral');
    expect(view.badge.text).not.toBe('!');
    expect(view.badge.text).toBe(buildPopupView(input({ user: user({ sync: { lastSyncAt: NOW - 13 * HOUR, lastCourseListAt: null } }) })).badge.text);
    // Every task from the last data stays listed.
    expect(view.pendingCount).toBe(buildPopupView(input({})).pendingCount);
  });

  it('is all-done with no pending tasks', () => {
    const view = buildPopupView(input({ user: user({ tasks: [] }) }));
    expect(view.pendingCount).toBe(0);
    expect(view.mascot).toBe('all-done');
    expect(view.badge.text).toBe('');
  });

  it('copes with more than 30 tasks', () => {
    const many = Array.from({ length: 35 }, (_, i) => task(100 + i, 1, NOW + (i + 1) * HOUR));
    const view = buildPopupView(input({ user: user({ tasks: many }) }));
    expect(view.pendingCount).toBe(35);
    expect(view.badge.text).toBe('23');
  });
});

describe('reminder signals in the popup', () => {
  it('shows a blocked-notifications line only when nothing more important is shown', () => {
    expect(buildPopupView(input({ notificationsAllowed: false })).banner).toEqual({ kind: 'notifications_off' });
    expect(buildPopupView(input({ notificationsAllowed: false, session: 'EXPIRED' })).banner).toEqual({ kind: 'session_expired', lastSyncAt: NOW - 600 });
  });
});

describe('another SIKOLA account (mismatch)', () => {
  const pending = { userId: 2, detectedAt: NOW, lastCheckAt: NOW, deferredAt: null };

  it('hides everything of the stored account and shows the mismatch screen', () => {
    const view = buildPopupView(input({ accountPending: pending }));
    expect(view.screen).toBe('mismatch');
    expect(view.groups).toEqual([]);
    expect(view.copyItems).toEqual([]);
    expect(view.updates).toEqual([]);
    expect(view.courseNames).toEqual({});
    expect(view.pendingCount).toBe(0);
    expect(view.banner).toBeNull();
    expect(view.mismatchDeferred).toBe(false);
  });

  it('shows "!" on the badge in red (an expired session is grey since M7.2)', () => {
    expect(buildPopupView(input({ accountPending: pending })).badge).toEqual({ text: '!', tone: 'expired' });
    expect(buildPopupView(input({ session: 'EXPIRED' })).badge.tone).toBe('neutral');
  });

  it('keeps the shorter note after "Nanti"', () => {
    expect(buildPopupView(input({ accountPending: { ...pending, deferredAt: NOW } })).mismatchDeferred).toBe(true);
  });

  it('is the list again once resolved', () => {
    expect(buildPopupView(input({ accountPending: null })).screen).toBe('main');
  });
});
