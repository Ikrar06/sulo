// The phone's background watching (M8c.3): the plan package. Core writes it
// whenever the app is active and after every sync; the native worker
// (apps/mobile/android, WatchWorker) only follows it. Every decision the
// worker makes comes from here: the batch it sends (with times relative to
// the moment it runs), the Radar rotation, the baselines it compares with,
// the user's notification settings and quiet hours, the intervals and the
// budget limits, and the notification texts in the user's language. The
// worker writes no text and no rule of its own; when in doubt it stays
// silent and core records the change when the app opens (watch/check.ts is
// the reference of what it does, tested on shared vectors).

import { CALENDAR_LIMIT, CALENDAR_LOOKAHEAD_DAYS, CALENDAR_LOOKBACK_DAYS, DAILY_BUDGET, DAILY_CALL_BUDGET, LOOP_GUARD, NOTIFICATIONS_LIMIT, RADAR_AUTO_MAX, SOFT_DAILY_POSTS, WATCH_STOP } from '../moodle/limits';
import { NOTIFICATION_RULES } from '../radar/notification-kinds';
import { MAX_COURSE_NOTICES } from '../reminders/plan';
import { FAR_TASK_DAYS } from '../radar/log';
import { TASK_MODULES } from '../radar/task-modules';
import type { ChannelPlan } from '../notify/channels';
import type { KeepAliveConfig } from '../remote/keep-alive';
import type { WorkerConfig } from './remote';
import type { UpdateSettings } from '../radar/settings';
import type { CourseId, UnixSeconds, UserId } from '../types';

export const WATCH_PLAN_VERSION = 1;
/** A plan older than this is stale: the worker stays silent and waits for the app. */
export const PLAN_STALE_SEC = 48 * 3600;
/** 06.00 to 22.59 device time is "day". */
export const DAY_START_MIN = 6 * 60;
export const NIGHT_START_MIN = 23 * 60;
/** Past the soft daily limit, daytime checks slow to this. */
export const SOFT_DAY_INTERVAL_MIN = 40;
/** Background responses waiting for the app; more keeps only the newest and asks for a full sync. */
export const QUEUE_MAX = 20;
/** The "sign in again" notification at most this often. */
export const EXPIRED_NOTICE_GAP_SEC = 24 * 3600;
const DAY = 86_400;

/** One call of the batch. `nowOffsets`: argument = the moment the check runs + offset seconds. */
export interface WatchCall {
  methodname: string;
  args: Record<string, unknown>;
  nowOffsets?: Record<string, number>;
}

export interface WatchTemplate {
  title: string;
  body: string;
}

/** Placeholders: {name}, {course}, {n}, {courses}. Substituted literally, nothing else. */
export interface WatchTemplates {
  taskAdded: WatchTemplate;
  dueChanged: WatchTemplate;
  grade: WatchTemplate;
  forum: WatchTemplate;
  material: WatchTemplate;
  mixed: WatchTemplate;
  summary: WatchTemplate;
  expired: WatchTemplate;
  /** The app not opened for 7 days: watching stops with this one notice (watch/remote.ts). */
  paused: WatchTemplate;
  /** Name used when a course is unknown. */
  otherCourse: string;
  /** The Android notification channel's name, as Settings shows it. */
  channel: string;
}

export interface WatchBaselineTask {
  eventId: number;
  dueAt: UnixSeconds | null;
  cmId: number | null;
}

export interface WatchPlan {
  version: typeof WATCH_PLAN_VERSION;
  writtenAt: UnixSeconds;
  userId: UserId;
  /**
   * The user's switch and a connected session. The remote switches are not
   * folded in any more: the worker reads the config itself (watch/remote.ts)
   * and, while they are off, keeps a 6-hour chain that only reads it again.
   */
  enabled: boolean;
  /** The app's last good config and its read times, the worker's starting point; `url`: where the worker reads it. */
  remote: { config: WorkerConfig | null; okAt: UnixSeconds; readAt: UnixSeconds; url: string };
  schedule: {
    dayIntervalMin: number;
    nightIntervalMin: number;
    softDayIntervalMin: number;
    dayStartMin: number;
    nightStartMin: number;
    radarEvery: number;
    radarMax: number;
  };
  /**
   * The shared day: soft limit (slower, no Radar), where watching stops for
   * the day (watchStop*, leaving the reserve for active use), and the hard
   * limits plus loop guard every request obeys.
   */
  budget: { softPosts: number; watchStopPosts: number; watchStopCalls: number; hardPosts: number; callLimit: number; loopPosts: number; loopWindowSec: number; loopPauseSec: number };
  /** Every check: session, calendar, popup notifications (in this order). */
  calls: WatchCall[];
  /** A Radar check appends one call per course after `calls`, taking the next courses in turn. */
  radar: { methodname: 'core_courseformat_get_state'; argKey: 'courseid'; courseIds: CourseId[] };
  baseline: {
    /** False until the calendar has a baseline: no task notifications. */
    tasksReady: boolean;
    tasks: WatchBaselineTask[];
    /** Null until the notifications have a baseline: no notification-based news. */
    notificationLastId: number | null;
    /** Known activity ids per course (only courses with a snapshot). */
    courseCms: Record<string, number[]>;
    /** Activities already announced as new material (a later "new task" for them stays quiet). */
    announcedCms: number[];
  };
  notify: UpdateSettings;
  quiet: { enabled: boolean; startMin: number; endMin: number };
  courseNames: Record<string, string>;
  /** A new task further out than this is not news (it just entered the calendar window). */
  farTaskSec: number;
  maxCourseNotices: number;
  /** component/eventtype -> kind; first match wins, eventtype null matches any. */
  notificationRules: { component: string; eventtype: string | null; kind: 'grade_feedback' | 'forum' | 'other' }[];
  /** A new activity of one of these modules counts as a task, not material. */
  taskModules: string[];
  templates: WatchTemplates;
  /**
   * The notification channels and which one each kind of notice goes to
   * (notify/channels.ts): the same plan the app's own notifications follow,
   * so the chosen sound has one source. Absent in plans written before it existed.
   */
  channels?: ChannelPlan;
  /**
   * Sipakamase's keeper (1.1.0), present only while something is waited for
   * and the config lets it keep: the worker sends one rotating GET when due
   * (Kotlin SipakamaseKeeper). Absent: nothing to keep.
   */
  sipakamase?: SipakamaseWatchPart;
}

export interface SipakamaseWatchPart {
  keep: true;
  intervalMin: number;
  /** The next fragment in KEEP_ORDER (the app's own keeper's rotation). */
  next: number;
  /** The app's own automatic reads today (the daily limit counts both). */
  usedToday: number;
  date: string;
  lastAutoAt: UnixSeconds;
}

export interface WatchPlanInput {
  now: UnixSeconds;
  userId: UserId;
  userEnabled: boolean;
  keepAlive: KeepAliveConfig;
  globalEnabled: boolean;
  sessionConnected: boolean;
  /** The app's last read of config.json: when it last succeeded (0: never) and was attempted, and the URL. */
  remoteRead: { okAt: UnixSeconds; readAt: UnixSeconds; url: string };
  /** A valid mobile.release's minVersionCode (M8e E3); absent or 0: none. */
  minVersionCode?: number;
  tasks: readonly { eventId: number; dueAt: UnixSeconds | null; cmId: number | null; missingSince: UnixSeconds | null }[];
  calendarBaseline: boolean;
  notificationLastId: number | null;
  /** Active (followed) courses, in the order Radar should take them. */
  radarCourseIds: readonly CourseId[];
  snapshots: Readonly<Record<string, { items: Readonly<Record<string, unknown>> }>>;
  announcedCms: readonly number[];
  updates: UpdateSettings;
  quiet: { enabled: boolean; startMin: number; endMin: number };
  courseNames: Readonly<Record<string, string>>;
  templates: WatchTemplates;
  channels?: ChannelPlan;
  sipakamase?: SipakamaseWatchPart;
}

export function buildWatchPlan(input: WatchPlanInput): WatchPlan {
  const k = input.keepAlive;
  return {
    version: WATCH_PLAN_VERSION,
    writtenAt: input.now,
    userId: input.userId,
    enabled: input.userEnabled && input.sessionConnected,
    remote: {
      config: input.remoteRead.okAt > 0 ? { globalEnabled: input.globalEnabled, keepAlive: { enabled: k.enabled, dayIntervalMinutes: k.dayIntervalMinutes, nightIntervalMinutes: k.nightIntervalMinutes, radarEvery: k.radarEvery }, ...(input.minVersionCode ? { minVersionCode: input.minVersionCode } : {}) } : null,
      okAt: input.remoteRead.okAt,
      readAt: input.remoteRead.readAt,
      url: input.remoteRead.url,
    },
    schedule: {
      dayIntervalMin: k.dayIntervalMinutes,
      nightIntervalMin: k.nightIntervalMinutes,
      softDayIntervalMin: Math.max(SOFT_DAY_INTERVAL_MIN, k.dayIntervalMinutes),
      dayStartMin: DAY_START_MIN,
      nightStartMin: NIGHT_START_MIN,
      radarEvery: k.radarEvery,
      radarMax: RADAR_AUTO_MAX,
    },
    budget: { softPosts: SOFT_DAILY_POSTS, watchStopPosts: WATCH_STOP.posts, watchStopCalls: WATCH_STOP.calls, hardPosts: DAILY_BUDGET, callLimit: DAILY_CALL_BUDGET, loopPosts: LOOP_GUARD.posts, loopWindowSec: LOOP_GUARD.windowSec, loopPauseSec: LOOP_GUARD.pauseSec },
    calls: [
      { methodname: 'core_session_time_remaining', args: {} },
      { methodname: 'core_calendar_get_action_events_by_timesort', args: { limitnum: CALENDAR_LIMIT }, nowOffsets: { timesortfrom: -CALENDAR_LOOKBACK_DAYS * DAY, timesortto: CALENDAR_LOOKAHEAD_DAYS * DAY } },
      { methodname: 'message_popup_get_popup_notifications', args: { useridto: input.userId, limit: NOTIFICATIONS_LIMIT, offset: 0 } },
    ],
    radar: { methodname: 'core_courseformat_get_state', argKey: 'courseid', courseIds: [...input.radarCourseIds] },
    baseline: {
      tasksReady: input.calendarBaseline,
      tasks: input.tasks.filter((t) => t.missingSince === null).map((t) => ({ eventId: t.eventId, dueAt: t.dueAt, cmId: t.cmId })),
      notificationLastId: input.notificationLastId,
      courseCms: Object.fromEntries(Object.entries(input.snapshots).map(([id, s]) => [id, Object.keys(s.items).map(Number).filter(Number.isInteger)])),
      announcedCms: [...input.announcedCms],
    },
    notify: { ...input.updates },
    quiet: { ...input.quiet },
    courseNames: { ...input.courseNames },
    farTaskSec: FAR_TASK_DAYS * DAY,
    maxCourseNotices: MAX_COURSE_NOTICES,
    notificationRules: NOTIFICATION_RULES.map((r) => ({ ...r })),
    taskModules: [...TASK_MODULES],
    templates: input.templates,
    ...(input.channels ? { channels: input.channels } : {}),
    ...(input.sipakamase ? { sipakamase: { ...input.sipakamase } } : {}),
  };
}
