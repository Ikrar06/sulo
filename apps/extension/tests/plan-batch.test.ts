import { describe, expect, it } from 'vitest';
import { NOTIFICATIONS_LIMIT, NOTIFICATIONS_LIMIT_SMALL } from '@sulo/core/moodle/limits';
import { EMPTY_RADAR_PLAN, nextNotificationsWide, notificationsDue, planRadarCalls, radarPlanWith } from '@sulo/core/radar/sync-step';
import { DEFAULTS, switchUser, writeUser } from '@sulo/core/storage';
import { partsToDrop, planBatch, type BatchPlanInput } from '@sulo/core/sync/plan-batch';
import { memoryStore } from './helpers';

const NOW = 1_794_000_000;
const H = 3600;
const radar = radarPlanWith(1, { courseIds: [401, 402], withNotifications: true, notificationsLimit: 10 });
const input = (over: Partial<BatchPlanInput> = {}): BatchPlanInput => ({
  now: NOW,
  courseListDue: true,
  courseListMissing: false,
  radar,
  userId: 1,
  remaining: { posts: 40, calls: 300 },
  ...over,
});
const names = (p: ReturnType<typeof planBatch>) => p.calls.map((c) => c.methodname);

describe('planBatch', () => {
  it('always starts with the session and the calendar', () => {
    const plan = planBatch(input({ remaining: { posts: 1, calls: 2 } }));
    expect(names(plan).slice(0, 2)).toEqual(['core_session_time_remaining', 'core_calendar_get_action_events_by_timesort']);
  });

  it('with plenty of quota carries everything that is due', () => {
    const plan = planBatch(input());
    expect(plan.dropped).toEqual([]);
    expect(plan.withCourseList).toBe(true);
    expect(names(plan).filter((n) => n === 'core_courseformat_get_state')).toHaveLength(2);
    expect(names(plan)).toContain('message_popup_get_popup_notifications');
    expect(plan.radarStart).toBe(4);
  });

  it('drops in order: structure, then the course list re-fetch, then notifications', () => {
    expect(partsToDrop({ posts: 10, calls: 60 })).toEqual([]);
    expect(partsToDrop({ posts: 9, calls: 300 })).toEqual(['structure']);
    expect(partsToDrop({ posts: 40, calls: 59 })).toEqual(['structure']);
    expect(partsToDrop({ posts: 5, calls: 300 })).toEqual(['structure', 'course_list']);
    expect(partsToDrop({ posts: 40, calls: 14 })).toEqual(['structure', 'course_list', 'notifications']);

    const low = planBatch(input({ remaining: { posts: 2, calls: 200 } }));
    expect(low.dropped).toEqual(['course_list', 'structure', 'notifications']);
    expect(names(low)).toEqual(['core_session_time_remaining', 'core_calendar_get_action_events_by_timesort']);
    expect(low.radar.courseIds).toEqual([]);
  });

  it('never drops a course list that was never fetched', () => {
    const plan = planBatch(input({ courseListMissing: true, remaining: { posts: 2, calls: 200 } }));
    expect(plan.withCourseList).toBe(true);
  });

  it('adds no radar calls before the user is known', () => {
    const plan = planBatch(input({ userId: null, radar: EMPTY_RADAR_PLAN }));
    expect(names(plan)).not.toContain('message_popup_get_popup_notifications');
  });
});

describe('notifications: 3-hour TTL and adaptive page size', () => {
  it('is due without a fetch, then every 3 hours (10 minutes of slack)', () => {
    expect(notificationsDue({}, NOW)).toBe(true);
    expect(notificationsDue({ notificationsFetchedAt: NOW - 2 * H }, NOW)).toBe(false);
    expect(notificationsDue({ notificationsFetchedAt: NOW - 171 * 60 }, NOW)).toBe(true);
  });

  it('fetches 20 for the baseline, then 10', async () => {
    const store = memoryStore();
    await switchUser(store, 1);
    expect((await planRadarCalls(store, 1, [], NOW)).notificationsLimit).toBe(NOTIFICATIONS_LIMIT);
    await writeUser(store, 1, 'radar', { ...DEFAULTS.radar, notificationsLastId: 50 });
    const plan = await planRadarCalls(store, 1, [], NOW);
    expect(plan.notificationsLimit).toBe(NOTIFICATIONS_LIMIT_SMALL);
    expect(plan.calls[0]?.args).toMatchObject({ limit: 10 });
  });

  it('widens to 20 next time when the top 10 were all new', async () => {
    expect(nextNotificationsWide(10, [60, 59, 58, 57, 56, 55, 54, 53, 52, 51], 50)).toBe(true);
    expect(nextNotificationsWide(10, [60, 59, 58, 57, 56, 55, 54, 53, 52, 50], 50)).toBe(false);
    expect(nextNotificationsWide(10, [60, 59], 50)).toBe(false);
    expect(nextNotificationsWide(20, Array.from({ length: 20 }, (_, i) => 100 - i), 50)).toBe(false);
    expect(nextNotificationsWide(10, Array.from({ length: 10 }, (_, i) => 100 - i), null)).toBe(false);
    const store = memoryStore();
    await switchUser(store, 1);
    await writeUser(store, 1, 'radar', { ...DEFAULTS.radar, notificationsLastId: 50, notificationsWide: true });
    expect((await planRadarCalls(store, 1, [], NOW)).notificationsLimit).toBe(20);
  });

  it('skips notifications within 3 hours of the last fetch', async () => {
    const store = memoryStore();
    await switchUser(store, 1);
    await writeUser(store, 1, 'radar', { ...DEFAULTS.radar, notificationsLastId: 50, notificationsFetchedAt: NOW - H });
    const plan = await planRadarCalls(store, 1, [], NOW);
    expect(plan.withNotifications).toBe(false);
    expect(plan.calls).toEqual([]);
  });
});
