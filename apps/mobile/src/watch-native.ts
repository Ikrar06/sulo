// The app's side of background watching (M8c.3): it writes the plan
// package the native worker follows, reads the worker's queued answers
// when the app opens (before any sync the user starts), and shows the
// worker's timings. The worker announces news; core here records every
// change as handled afterwards, so nothing is announced twice and changes
// found while the app is open never notify.

import { parseRelease } from '@sulo/core/remote/release';
import { readPending } from '@sulo/core/account/pending';
import { activeCourseIds } from '@sulo/core/courses/active-score';
import { courseAlias } from '@sulo/core/courses/display-name';
import { resolveLocale } from '@sulo/core/i18n';
import { mobileWords } from '@sulo/core/i18n/mobile';
import type { Platform } from '@sulo/core/platform';
import { readPrefs } from '@sulo/core/prefs';
import { keepAliveFrom } from '@sulo/core/remote/keep-alive';
import { readRemoteConfig } from '@sulo/core/remote/remote-config';
import { REMOTE_CONFIG_URL } from '@sulo/core/moodle/limits';
import { currentUser, readUser } from '@sulo/core/storage';
import type { CheckTiming } from '@sulo/core/watch/sleep-help';
import { buildWatchPlan, type SipakamaseWatchPart } from '@sulo/core/watch/plan';
import type { RemoteConfig } from '@sulo/core/types';
import { sourcesFrom } from '@sulo/core/remote/sources';
import { keeperRuns, readConnection } from '@sulo/core/sipakamase/connection';
import { ownReadsToday, readKeeper } from '@sulo/core/sipakamase/keeper';
import { readSipakamaseModule } from '@sulo/core/sipakamase/module';
import { localParts } from '@sulo/core/reminders/zoned';
import { sipakamaseStore } from './sipakamase/service';
import { applyWatchAnswers, markChangesHandled, type WatchAnswer } from '@sulo/core/watch/queue';
import { SuloSession } from './session';
import { readWatch } from './watch';
import { readChannelPlan } from './notify-sound';

/** Where the worker reads the config: the official file, or in a debug build the dev screen's test config (the worker re-checks both). */
async function workerConfigUrl(platform: Platform): Promise<string> {
  if (!__SULO_DEV__) return REMOTE_CONFIG_URL;
  const test = await platform.store.get<{ url: string }>('mobile:dev:testConfig').catch(() => null);
  return test?.url ?? REMOTE_CONFIG_URL;
}

/** Writes the plan the worker follows (disabled when anything is off: it then stops at once). */
export async function applyWatchPlan(platform: Platform): Promise<void> {
  if (__SULO_WEB_FAKE__ && import.meta.env.MODE === 'web') return;
  const { store, clock } = platform;
  const userId = await currentUser(store);
  // No account, or another account waiting for the user's answer: no plan in force (never the previous account's for the new session).
  if (userId === null || (await readPending(store)) !== null) return void (await SuloSession.watchApply({ plan: JSON.stringify({ enabled: false }) }).catch(() => undefined));
  const [channels, watch, config, prefs, session, tasks, courses, snapshots, radar, changes] = await Promise.all([
    // The same channel plan the app's own notifications use: the worker reads the chosen sound from here.
    readChannelPlan(store),
    readWatch(platform),
    readRemoteConfig(store),
    readPrefs(store),
    SuloSession.status().catch(() => ({ status: 'none' as const })),
    readUser(store, userId, 'tasks'),
    readUser(store, userId, 'courses'),
    readUser(store, userId, 'snapshots'),
    readUser(store, userId, 'radar'),
    readUser(store, userId, 'changes'),
  ]);
  const active = activeCourseIds(courses);
  // Radar takes the courses checked longest ago first.
  const rotation = [...active].sort((a, b) => (radar.stateCheckedAt[String(a)] ?? 0) - (radar.stateCheckedAt[String(b)] ?? 0));
  const w = mobileWords(resolveLocale(prefs.locale, navigator.language));
  const plan = buildWatchPlan({
    now: clock.now(),
    userId,
    userEnabled: watch.enabled,
    keepAlive: keepAliveFrom(config),
    globalEnabled: config.enabled,
    sessionConnected: session.status === 'connected',
    remoteRead: { okAt: config.okAt ?? 0, readAt: config.fetchedAt, url: await workerConfigUrl(platform) },
    // A required update holds the worker too (it compares with its own versionCode).
    minVersionCode: parseRelease(config.mobile)?.minVersionCode,
    tasks,
    calendarBaseline: radar.calendarBaseline,
    notificationLastId: radar.notificationsLastId,
    radarCourseIds: rotation,
    snapshots: Object.fromEntries(Object.entries(snapshots).filter(([id]) => active.has(Number(id)))),
    announcedCms: changes.filter((e) => e.notify && (e.change.kind === 'added' || e.change.kind === 'shown')).map((e) => ('cmId' in e.change ? e.change.cmId : null)).filter((c): c is number => c !== null),
    updates: prefs.updates,
    quiet: prefs.reminders.quiet,
    courseNames: Object.fromEntries(courses.map((c) => [String(c.id), courseAlias(c)])),
    templates: w.watch.templates,
    channels,
    sipakamase: await sipakamaseWatchPart(platform, config, clock.now()),
  });
  await SuloSession.watchApply({ plan: JSON.stringify(plan) }).catch(() => undefined);
}

/**
 * Before any sync on opening: the worker's answers go through core (Zod,
 * diff, Kabar terbaru, reminders); then every change entry is handled.
 * Returns whether the worker asks for a full sync (queue overflowed or an
 * answer could not be read).
 */
export async function processWatchQueue(platform: Platform): Promise<{ applied: number; fullSync: boolean }> {
  if (__SULO_WEB_FAKE__ && import.meta.env.MODE === 'web') return { applied: 0, fullSync: false };
  const taken = await SuloSession.watchTake().catch(() => ({ answers: [] as string[], fullSync: false }));
  const answers = taken.answers.map((a) => JSON.parse(a) as WatchAnswer);
  const applied = answers.length > 0 ? await applyWatchAnswers({ store: platform.store, clock: platform.clock }, answers) : [];
  await markChangesHandled(platform.store, platform.clock.now());
  return { applied: applied.length, fullSync: taken.fullSync || applied.some((a) => a.outcome.status === 'unreadable') };
}

export interface WatchTiming extends CheckTiming {
  ms: number;
  bytes: number;
  outcome: string;
  /** News found by that check (the worker's own count). */
  changes?: number;
}

/** The worker's last checks and session ends (times, durations, sizes, outcome codes). */
export async function readWatchStatus(): Promise<{ timings: WatchTiming[]; sessionEnds: { at: number; sinceLastOkSec: number | null; heldBack: boolean }[]; plannedAt: number; queued: number }> {
  if (__SULO_WEB_FAKE__ && import.meta.env.MODE === 'web') return { timings: [], sessionEnds: [], plannedAt: 0, queued: 0 };
  const s = await SuloSession.watchStatus().catch(() => null);
  if (!s) return { timings: [], sessionEnds: [], plannedAt: 0, queued: 0 };
  return { timings: JSON.parse(s.timings) as WatchTiming[], sessionEnds: JSON.parse(s.sessionEnds), plannedAt: s.plannedAt, queued: s.queued };
}

/**
 * Sipakamase's part of the plan (1.1.0): present only while its module is on,
 * something is waited for (connection live or broken) and the config lets it
 * keep. The worker then rides its own wakes to keep the session.
 */
async function sipakamaseWatchPart(platform: Platform, config: RemoteConfig, now: number): Promise<SipakamaseWatchPart | undefined> {
  const store = sipakamaseStore(platform);
  if (!(await readSipakamaseModule(store)).enabled) return undefined;
  const source = sourcesFrom(config).sipakamase;
  const conn = await readConnection(store, true);
  if (!source.enabled || !source.keep || !keeperRuns(conn.state)) return undefined;
  const keeper = await readKeeper(store);
  const today = localParts(now, Intl.DateTimeFormat().resolvedOptions().timeZone).dateKey;
  return { keep: true, intervalMin: source.keepIntervalMinutes, next: keeper.next, usedToday: ownReadsToday(keeper, today), date: today, lastAutoAt: keeper.lastAutoAt ?? 0 };
}
