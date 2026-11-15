import { describe, expect, it } from 'vitest';
import { DEFAULT_REMOTE_CONFIG } from '../lib/remote/remote-config';
import { DEFAULT_SYNC_STATUS, DEFAULTS, type UserData } from '../lib/storage';
import type { CourseRecord, Task } from '../lib/types';
import { buildPopupView, type PopupInput } from '../lib/view/popup-view';

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
    [{ session: 'EXPIRED' as const }, { kind: 'session_expired' }],
    [{ syncStatus: { ...DEFAULT_SYNC_STATUS, lastOutcome: { status: 'parser_broken' as const, where: 'x' } } }, { kind: 'parser_broken' }],
    [{ budget: { date: 'x', used: 40 } }, { kind: 'budget_exhausted' }],
    [{ syncStatus: { ...DEFAULT_SYNC_STATUS, lastOutcome: { status: 'offline' as const } } }, { kind: 'offline' }],
    [{ online: false }, { kind: 'offline' }],
  ])('banner for %o', (patch, banner) => {
    expect(buildPopupView(input(patch)).banner).toEqual(banner);
  });

  it('does not call a server error or a slow SIKOLA "offline"', () => {
    const view = buildPopupView(input({ syncStatus: { ...DEFAULT_SYNC_STATUS, lastOutcome: { status: 'server_error' as const } } }));
    expect(view.banner?.kind).not.toBe('offline');
  });

  it('marks stale data, uses a neutral badge and the sleepy mascot', () => {
    const view = buildPopupView(input({ user: user({ sync: { lastSyncAt: NOW - 8 * HOUR, lastCourseListAt: null } }) }));
    expect(view.banner).toEqual({ kind: 'stale', lastSyncAt: NOW - 8 * HOUR });
    expect(view.badge.tone).toBe('neutral');
    expect(view.mascot).toBe('stale');
  });

  it('shows "!" when the session expired', () => {
    expect(buildPopupView(input({ session: 'EXPIRED' })).badge).toEqual({ text: '!', tone: 'expired' });
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
    expect(buildPopupView(input({ notificationsAllowed: false, session: 'EXPIRED' })).banner).toEqual({ kind: 'session_expired' });
  });
});
