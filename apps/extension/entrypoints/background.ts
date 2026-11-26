import { browser } from 'wxt/browser';
import { sikolaUrl } from '@sulo/core/links';
import { nudgeTarget } from '@sulo/core/neosia/nudges';
import { defineBackground } from 'wxt/utils/define-background';
import { BADGE_COLORS } from '@/lib/brand';
import { createBrowserStore } from '@/src/platform/store';
import { systemClock } from '@sulo/core/clock';
import {
  messageSchema,
  type Message,
  type StatusResponse,
} from '@/lib/messages';
import { readBudget } from '@sulo/core/moodle/budget';
import { createMoodleClient } from '@sulo/core/moodle/client';
import { readCalendar, refreshCalendar } from '@sulo/core/calendar/remote';
import { CALENDAR_HIGHLIGHT_KEY, calendarHighlight, type CalendarHighlight } from '@sulo/core/calendar/highlight';
import { inWindow, localParts } from '@sulo/core/reminders/zoned';
import { dashboardPath } from '@sulo/core/dashboard/routes';
import { CALENDAR_URL, CATCHUP_DELAY_MAX_MIN, DAILY_BUDGET, IDLE_THRESHOLD_SEC, REMOTE_CONFIG_URL, SIKOLA_ORIGIN } from '@sulo/core/moodle/limits';
import { createRequestLogger } from '@sulo/core/net/request-log';
import { createSessionAgeLogger } from '@sulo/core/net/session-age';
import { createScheduler } from '@sulo/core/net/scheduler';
import { fetchSlotHour } from '@sulo/core/remote/fetch-public';
import { onSesskeyReceived, readSession, writeSession } from '@sulo/core/moodle/session';
import { trySesskeyFallbackFromPopup as trySesskeyFallback } from '@sulo/core/moodle/sesskey-fallback';
import { pendingWhatsNew, WHATS_NEW } from '@sulo/core/onboarding/whats-new';
import { effectiveIntervalMinutes, readRemoteConfig, refreshRemoteConfig } from '@sulo/core/remote/remote-config';
import { BADGE_ALARM, BADGE_REFRESH_MIN, ensureJitter, SYNC_ALARM, type IdleState } from '@sulo/core/schedule';
import { isContentScriptOn, isExtensionPageSender } from '@/lib/sender';
import { isValidSesskey } from '@sulo/core/sesskey';
import { CURRENT_USER_KEY, currentUser, NOTICE_KEY, NOTICE_VERSION, pruneOrphanUserKeys, readUser, writeUser } from '@sulo/core/storage';
import { readPrefs } from '@sulo/core/prefs';
import { changeUrl } from '@sulo/core/radar/describe';
import { countPopupOpen } from '@sulo/core/radar/log';
import { parseNotificationId, runNotifyCycle, type Notifier } from '@sulo/core/reminders/run';
import { createSingleFlight, isSyncRunning } from '@sulo/core/sync/lock';
import { bumpUsage } from '@sulo/core/stats/usage';
import { ACCOUNT_PENDING_KEY, readPending, type AccountPending } from '@sulo/core/account/pending';
import { useNewAccount, wipeAllData } from '@sulo/core/account/actions';
import { runSync, type SyncStage } from '@sulo/core/sync/run-sync';
import { runMkpkNotices } from '@sulo/core/mkpk/notices-run';
import { ONBOARDING_STAGES_KEY, type OnboardingStages } from '@sulo/core/onboarding/stages';
import { recordSeenCmid, refreshPresensiForCurrent, type PresensiOutcome } from '@sulo/core/presensi/service';
import { announceRelogin, isSignedInSikolaPage, reloginStep, type ReloginEvent, type ReloginMarker } from '@sulo/core/sync/relogin';
import { setDone, setSnooze } from '@sulo/core/tasks/local-state';
import { messagesFor, resolveLocale } from '@sulo/core/i18n';
import type { SyncOutcome, SyncTrigger } from '@sulo/core/types';
import { loadPopupInput } from '@sulo/core/view/load';
import { browserModuleDeps } from '@/src/platform/neosia';
import { createSipakamaseService, SIPAKAMASE_ALARM } from '@/src/sipakamase';
import { SIPAKAMASE_ORIGIN } from '@sulo/core/sipakamase/allowlist';
import { SIPAKAMASE_NEWS_KEY } from '@sulo/core/sipakamase/store';
import { disableModule, enableModule, reconcileModule } from '@sulo/core/neosia/module';
import { NEOSIA_APP_ORIGIN } from '@sulo/core/neosia/allowlist';
import { ingestCapture, pruneUnlistedSnapshots } from '@sulo/core/neosia/store';
import { captureFrom, REFRESH_SETTLE_MS, startRefresh } from '@sulo/core/neosia/refresh-tab';
import { NEOSIA_HOME, NEOSIA_KHS, NEOSIA_KRS } from '@sulo/core/links';
import { recordGrades } from '@sulo/core/neosia/grades';
import { buildPopupView } from '@sulo/core/view/popup-view';
import { EXTENSION_WATCH_KEY, readExtensionWatch, setExtensionWatch, watchInForce } from '@sulo/core/watch/extension';

const SESSKEY_KEY = 'sesskey';
/** The one rolling alarm for every notification (docs/ARCHITECTURE.md section 9). */
const NOTIFY_ALARM = 'notify';
/** Storage changes that can move the next reminder. Not notified or stats (written by the cycle itself). */
const REMINDER_INPUTS = /^(u:\d+:(tasks|taskState|courses|changes)|global:(prefs|session|currentUser|accountPending|calendar|neosia)|neosia:snap:checkJadwalBelanjaKRS)$/;
/** The popup opens on this panel once (a click on an update summary). */
const POPUP_PANEL_KEY = 'global:popupPanel';
const SNOOZE_FROM_NOTIFICATION = 3600;
const ONBOARDING_PAGE = '/onboarding.html';
/** "Pantau tugas baru" (1.1.0): the periodic light check, only while it is on. */
const WATCH_ALARM = 'watch';
/** Where "Perbarui dari NEOSIA" goes, by what the page needs. */
const NEOSIA_REFRESH_PAGES = { home: NEOSIA_HOME, khs: NEOSIA_KHS, krs: NEOSIA_KRS } as const;
/** Catch-up syncs after the browser starts or the user returns: "catchup:startup", "catchup:idle". */
const CATCHUP_ALARM_PREFIX = 'catchup:';
const CATCHUP_TRIGGERS = new Set<SyncTrigger>(['startup', 'idle']);

// No state in module variables except the client, whose queue only orders
// requests. All data lives in chrome.storage (project convention).
export default defineBackground(() => {
  const local = createBrowserStore(browser.storage.local);
  const session = createBrowserStore(browser.storage.session);
  const clock = systemClock;
  const timeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

  const getSesskey = async () => {
    const value = await session.get<string>(SESSKEY_KEY);
    return isValidSesskey(value) ? value : null;
  };

  // The only place that calls fetch: per-domain gates, queues and backoff
  // (lib/net/scheduler.ts). The request log exists in dev and tester builds
  // only; production passes nothing, so it never records anything.
  const scheduler = createScheduler({
    fetch: (input, init) => fetch(input, init),
    store: local,
    clock,
    random: Math.random,
    onRequest: import.meta.env.MODE === 'production' ? undefined : createRequestLogger(local),
  });

  // Session age log (dev and tester builds): outcomes only, no request of its own.
  const sessionAge = import.meta.env.MODE === 'production' ? undefined : createSessionAgeLogger(local);

  const client = createMoodleClient({
    fetch: (input, init) => fetch(input, init),
    scheduler,
    store: local,
    clock,
    baseUrl: SIKOLA_ORIGIN,
    getSesskey,
    sessionAge,
  });

  // Public data (kill switch, academic calendar): each file at most once a
  // day, from the installation's fetch hour, ridden on a sync cycle.
  const refreshConfig = async () => {
    const slot = await fetchSlotHour(local);
    await refreshRemoteConfig({ scheduler, store: local, clock, url: REMOTE_CONFIG_URL, fetchSlotHour: slot });
    await refreshCalendar({ scheduler, store: local, clock, url: CALENDAR_URL, fetchSlotHour: slot }).catch(() => 'failed');
  };

  // ---------- NEOSIA module (optional, off by default) ----------

  const neosia = browserModuleDeps(local, () => clock.now());

  // ---------- Sipakamase module (optional, off by default, 1.1.0) ----------

  const sipakamase = createSipakamaseService({ store: local, scheduler, now: () => clock.now(), today: () => localParts(clock.now(), timeZone()).dateKey });
  // One reconcile at a time (startup and a permission change can coincide).
  let neosiaQueue: Promise<unknown> = Promise.resolve();
  const reconcileNeosia = () => {
    neosiaQueue = neosiaQueue.then(() => reconcileModule(neosia)).catch(() => undefined);
  };
  /** One projected NEOSIA response from the bridge: validated again, stored, compared. */
  const onNeosiaCapture = (raw: unknown) => {
    neosiaQueue = neosiaQueue
      .then(async () => {
        const result = await ingestCapture(local, clock.now(), raw);
        await recordGrades(local, clock.now(), result);
      })
      .catch(() => undefined);
  };

  // ---------- Badge ----------

  const today = () => localParts(clock.now(), timeZone()).dateKey;

  /** Local usage counters (lib/stats/usage.ts): counts only, never sent anywhere. */
  const countShown = async (kinds: readonly string[]) => {
    const calendar = kinds.filter((k) => k === 'calendar').length;
    const updates = kinds.filter((k) => k === 'changes' || k === 'changes_summary').length;
    const reminders = kinds.filter((k) => k === 'task' || k === 'summary' || k === 'morning').length;
    await bumpUsage(local, today(), 'calendarRemindersShown', calendar);
    await bumpUsage(local, today(), 'updatesShown', updates);
    await bumpUsage(local, today(), 'remindersShown', reminders);
  };

  /** Keeps the popup's "Tanggal penting" line current (written only when it changes). */
  const refreshHighlight = async () => {
    const next = calendarHighlight(await readCalendar(local), localParts(clock.now(), timeZone()).dateKey);
    const stored = (await local.get<CalendarHighlight | null>(CALENDAR_HIGHLIGHT_KEY)) ?? null;
    if (JSON.stringify(stored) !== JSON.stringify(next)) await local.set(CALENDAR_HIGHLIGHT_KEY, next);
  };

  const updateBadge = async () => {
    await refreshHighlight().catch(() => undefined);
    const view = buildPopupView(await loadPopupInput(local, clock, timeZone()));
    await browser.action.setBadgeText({ text: view.onboarded ? view.badge.text : '' });
    await browser.action.setBadgeBackgroundColor({ color: BADGE_COLORS[view.badge.tone] });
  };

  // ---------- Alarms ----------

  const ensureAlarms = async () => {
    const config = await readRemoteConfig(local);
    const period = effectiveIntervalMinutes(config);
    const existing = await browser.alarms.get(SYNC_ALARM);
    // A re-drawn jitter (new range) moves the alarm to its new minute.
    const jitter = await ensureJitter(local);
    if (!existing || existing.periodInMinutes !== period || jitter.changed) {
      await browser.alarms.create(SYNC_ALARM, { delayInMinutes: 1 + jitter.minutes, periodInMinutes: period });
    }
    if (!(await browser.alarms.get(BADGE_ALARM))) {
      await browser.alarms.create(BADGE_ALARM, { periodInMinutes: BADGE_REFRESH_MIN });
    }
    // "Pantau tugas baru": one alarm at the active interval while it is in force; idle and
    // locked are decided when it fires (sync/run-sync.ts). Off or stopped remotely: no alarm.
    const watch = watchInForce(await readExtensionWatch(local), config);
    const watchAlarm = await browser.alarms.get(WATCH_ALARM);
    if (!watch.on) {
      if (watchAlarm) await browser.alarms.clear(WATCH_ALARM);
    } else if (!watchAlarm || watchAlarm.periodInMinutes !== watch.config.activeIntervalMinutes) {
      await browser.alarms.create(WATCH_ALARM, { delayInMinutes: watch.config.activeIntervalMinutes, periodInMinutes: watch.config.activeIntervalMinutes });
    }
  };

  /** The intervals in force for the watch trigger. */
  const watchIntervals = async () => {
    const { config } = watchInForce(await readExtensionWatch(local), await readRemoteConfig(local));
    return { activeMinutes: config.activeIntervalMinutes, idleMinutes: config.idleIntervalMinutes };
  };

  /** "Pantau tugas baru" switched: stored, the alarm follows, and turning it on checks once at once. */
  const setWatch = async (enabled: boolean) => {
    await setExtensionWatch(local, enabled, clock.now());
    await ensureAlarms();
    if (enabled && watchInForce(await readExtensionWatch(local), await readRemoteConfig(local)).on) void sync('popup');
    return { ok: true };
  };

  // ---------- Reminders: one rolling alarm ----------

  const notifier: Notifier = {
    show: async (id, view) => {
      await browser.notifications.create(id, {
        type: 'basic',
        iconUrl: browser.runtime.getURL(`/notify/${view.icon}.png`),
        title: view.title,
        message: view.message,
        buttons: view.buttons.map((title) => ({ title })),
        priority: 1,
      });
    },
  };

  // Orders overlapping cycles (an alarm and a storage change at once). It only
  // sequences work; all data stays in storage.
  let reminderQueue: Promise<unknown> = Promise.resolve();
  const runRemindersAt = (now: number) => {
    const run = reminderQueue.then(async () => {
      // The phone's full morning summary (Tahap 2): overdue, today, tomorrow and today's calendar events; none when all are empty.
      const result = await runNotifyCycle({ store: local, now, timeZone: timeZone(), uiLanguage: browser.i18n.getUILanguage(), morningStyle: 'full', notifier });
      await countShown(result.shownKinds ?? []);
      // MKPK (1.1.0): courses near the grade deadline or in the KRS window, and Sipakamase news.
      const prefs = await readPrefs(local);
      await runMkpkNotices({
        store: local,
        now,
        timeZone: timeZone(),
        locale: resolveLocale(prefs.locale, browser.i18n.getUILanguage()),
        show: (id, title, body) => notifier.show(id, { icon: 'idle', title, message: body, buttons: [] }),
      }).catch(() => 0);
      if (result.nextAt === null) await browser.alarms.clear(NOTIFY_ALARM);
      else await browser.alarms.create(NOTIFY_ALARM, { when: result.nextAt * 1000 });
      return result;
    });
    reminderQueue = run.catch(() => undefined);
    return run;
  };
  const runReminders = () => void runRemindersAt(clock.now()).catch(() => undefined);

  const findTask = async (eventId: number) => {
    const userId = await currentUser(local);
    if (userId === null) return null;
    return { userId, task: (await readUser(local, userId, 'tasks')).find((t) => t.eventId === eventId) ?? null };
  };

  const onNotificationClick = async (id: string) => {
    const { kind, eventId, entryId, courseId } = parseNotificationId(id);
    await browser.notifications.clear(id);
    if (kind === 'changes' && courseId !== null) {
      await browser.tabs.create({ url: browser.runtime.getURL(`/dashboard.html#kabar/${courseId}`) });
      return;
    }
    if (kind === 'changes' || kind === 'changes_summary') {
      const userId = await currentUser(local);
      const entry = entryId && userId !== null ? (await readUser(local, userId, 'changes')).find((e) => e.id === entryId) : undefined;
      const url = entry ? changeUrl(entry.change) : null;
      if (url) {
        await browser.tabs.create({ url });
        return;
      }
      await local.set(POPUP_PANEL_KEY, { panel: 'updates', at: clock.now() });
      try {
        await browser.action.openPopup();
      } catch {
        await browser.tabs.create({ url: sikolaUrl('connected') });
      }
    } else if (kind === 'task' && eventId !== null) {
      const found = await findTask(eventId);
      if (found?.task) await browser.tabs.create({ url: found.task.url });
    } else if (kind === 'summary' || kind === 'morning') {
      try {
        await browser.action.openPopup();
      } catch {
        await browser.tabs.create({ url: `${SIKOLA_ORIGIN}/calendar/view.php?view=upcoming` });
      }
    } else if (kind === 'nudge') {
      // The user clicked the notification: open the NEOSIA page it names. Sulo never touches that tab.
      await browser.tabs.create({ url: nudgeTarget(id) });
    } else if (kind === 'krs' || kind === 'mkpk') {
      // MKPK notices (1.1.0) open the overview, where the MKPK card is.
      await browser.tabs.create({ url: browser.runtime.getURL(dashboardPath('ringkasan')) });
    } else if (kind === 'calendar') {
      await browser.tabs.create({ url: browser.runtime.getURL(dashboardPath('kalender')) });
    } else if (kind === 'session') {
      await browser.tabs.create({ url: sikolaUrl('expired') });
    } else if (kind === 'relogin') {
      await browser.tabs.create({ url: browser.runtime.getURL(dashboardPath('ringkasan')) });
    }
  };

  const onNotificationButton = async (id: string, index: number) => {
    const { kind, eventId } = parseNotificationId(id);
    await browser.notifications.clear(id);
    if (kind !== 'task' || eventId === null) return;
    const found = await findTask(eventId);
    if (!found) return;
    const state = await readUser(local, found.userId, 'taskState');
    const next = index === 0 ? setSnooze(state, eventId, clock.now() + SNOOZE_FROM_NOTIFICATION) : setDone(state, eventId, true);
    await writeUser(local, found.userId, 'taskState', next);
  };

  /** The "baru" marker on task rows fades after 3 popup opens. */
  const countOpen = async () => {
    const userId = await currentUser(local);
    if (userId === null) return;
    const log = await readUser(local, userId, 'changes');
    const next = countPopupOpen(log, clock.now());
    if (next.some((e, i) => e !== log[i])) await writeUser(local, userId, 'changes', next);
  };

  const sendTestNotification = async () => {
    const prefs = await readPrefs(local);
    const m = messagesFor(resolveLocale(prefs.locale, browser.i18n.getUILanguage()));
    await notifier.show(`test|${clock.now()}`, { title: m.notify.testTitle, message: m.notify.testBody, icon: 'idle', buttons: [] });
    return { ok: true };
  };

  // ---------- Sync ----------

  /**
   * No sesskey yet: only a click on "Perbarui" or the setup's connect step
   * may fetch /my/ to find one (at most once per 6 hours, counted in the
   * budget). Never in the background and never when the popup opens.
   */
  const recoverSesskeyIfAllowed = async (trigger: SyncTrigger) => {
    if (trigger !== 'manual' && trigger !== 'onboarding') return;
    if ((await getSesskey()) !== null || (await readSession(local)).state === 'EXPIRED') return;
    const fallback = await trySesskeyFallback({ client, store: local, clock });
    if (fallback.kind === 'recovered') await session.set(SESSKEY_KEY, fallback.sesskey);
    if (fallback.kind === 'not_found') await writeSession(local, clock, 'EXPIRED');
  };

  /** forceCourseList: "Segarkan daftar" (rides with this request only; no module state). */
  interface SyncRequest {
    trigger: SyncTrigger;
    forceCourseList?: boolean;
  }

  const syncOnceGuarded = async ({ trigger, forceCourseList = false }: SyncRequest): Promise<SyncOutcome> => {
    await refreshConfig();
    const unattended = trigger === 'background' || trigger === 'watch' || CATCHUP_TRIGGERS.has(trigger);
    const idleState: IdleState | undefined = unattended ? ((await browser.idle.queryState(IDLE_THRESHOLD_SEC)) as IdleState) : undefined;
    await recoverSesskeyIfAllowed(trigger);
    // The onboarding's "Menyiapkan Sulo" follows the real stages as they finish (Tahap 2): each
    // one is put in session storage for the setup page to read. Nothing else, no request of its own.
    const seen: OnboardingStages['stages'] = [];
    const onStage =
      trigger === 'onboarding'
        ? (stage: SyncStage, result: 'ok' | 'failed') => {
            seen.push({ stage, result });
            void session.set<OnboardingStages>(ONBOARDING_STAGES_KEY, { at: Date.now(), stages: [...seen] });
          }
        : undefined;
    if (onStage) await session.set(ONBOARDING_STAGES_KEY, { at: Date.now(), stages: [] });
    const watch = trigger === 'watch' ? await watchIntervals() : undefined;
    const outcome = await runSync({ client, store: local, clock, trigger, idleState, forceCourseList, onStage, watch });
    if (outcome.status === 'invalid_sesskey') await session.remove(SESSKEY_KEY);
    await updateBadge();
    return outcome;
  };

  // One sync at a time: a second trigger (popup, button, alarm, setup) waits
  // for the running one instead of sending its own request (lib/sync/lock.ts).
  const syncFlight = createSingleFlight<SyncRequest>({
    store: local,
    now: () => clock.now(),
    newId: () => crypto.randomUUID(),
    run: syncOnceGuarded,
    setInterval: (fn, ms) => setInterval(fn, ms),
    clearInterval: (handle) => clearInterval(handle as ReturnType<typeof setInterval>),
  });
  const sync = (trigger: SyncTrigger, forceCourseList = false) => syncFlight({ trigger, forceCourseList });

  // ---------- Signing in to SIKOLA again (M7.2) ----------
  // Sulo never keeps the session alive. When it had expired and the user
  // signs in again (a signed-in SIKOLA page loads and its sesskey arrives,
  // in either order), one ordinary sync runs: cooldown, lock and budget
  // apply (lib/sync/relogin.ts). The marker lives in session storage.
  const RELOGIN_KEY = 'relogin:marker';
  let reloginQueue: Promise<unknown> = Promise.resolve();
  const onRelogin = (event: ReloginEvent) => {
    const run = reloginQueue.then(async () => {
      const marker = (await session.get<ReloginMarker>(RELOGIN_KEY)) ?? null;
      const state = (await readSession(local)).state;
      const step = reloginStep({ event, session: state, marker, now: clock.now() });
      if (step.marker) await session.set(RELOGIN_KEY, step.marker);
      else if (marker) await session.remove(RELOGIN_KEY);
      if (!step.sync) return;
      const outcome = await sync('relogin');
      const prefs = await readPrefs(local);
      const quiet = prefs.reminders.quiet.enabled && inWindow(clock.now(), prefs.reminders.quiet, timeZone());
      if (!announceRelogin({ status: outcome.status, inQuietHours: quiet })) return;
      const m = messagesFor(resolveLocale(prefs.locale, browser.i18n.getUILanguage()));
      // A quiet, light notification: no sound, low priority.
      await browser.notifications.create(`relogin|${clock.now()}`, {
        type: 'basic',
        iconUrl: browser.runtime.getURL('/notify/happy.png'),
        title: m.notify.reloginTitle,
        message: m.notify.reloginBody,
        priority: 0,
        silent: true,
      });
    });
    reloginQueue = run.catch(() => undefined);
  };

  // ---------- Status, popup, tools ----------

  const status = async (): Promise<StatusResponse> => {
    const [budget, config, sesskey] = await Promise.all([readBudget(local, clock), readRemoteConfig(local), getSesskey()]);
    return {
      hasSesskey: sesskey !== null,
      budgetUsed: budget.used,
      budgetLimit: DAILY_BUDGET,
      disabledMessage: config.enabled ? null : config.message,
    };
  };

  /**
   * A catch-up sync a random 0 to 5 minutes later (not every browser at the
   * same second). runSync skips it when data is younger than 60 minutes.
   * An alarm already waiting is kept.
   */
  const scheduleCatchup = async (trigger: 'startup' | 'idle') => {
    const name = `${CATCHUP_ALARM_PREFIX}${trigger}`;
    if (await browser.alarms.get(name)) return;
    // Chrome alarms fire no sooner than 30 seconds.
    await browser.alarms.create(name, { delayInMinutes: Math.max(0.5, Math.random() * CATCHUP_DELAY_MAX_MIN) });
  };

  const clearAllNotifications = async () => {
    const shown = await browser.notifications.getAll();
    await Promise.all(Object.keys(shown).map((id) => browser.notifications.clear(id)));
  };

  const openSetup = async (hash: string) => {
    await browser.tabs.create({ url: browser.runtime.getURL(`${ONBOARDING_PAGE}${hash}`) });
  };

  const useNew = async () => {
    const ok = await useNewAccount({ store: local, clearNotifications: clearAllNotifications, openSetup });
    // The new account's owner has not agreed to the NEOSIA or Sipakamase module.
    if (ok) {
      await disableModule(neosia);
      await sipakamase.disable();
    }
    await updateBadge();
    return { ok };
  };

  const deferAccount = async () => {
    const pending = await readPending(local);
    if (pending) await local.set<AccountPending>(ACCOUNT_PENDING_KEY, { ...pending, deferredAt: clock.now() });
    return { ok: true };
  };

  const wipeAll = async () => {
    await wipeAllData({
      syncRunning: () => isSyncRunning(local, clock.now()),
      sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
      clearAlarms: async () => void (await browser.alarms.clearAll()),
      // NEOSIA scripts off and permissions removed before the data goes.
      beforeClear: async () => {
        await disableModule(neosia);
        await sipakamase.disable();
      },
      clearNotifications: clearAllNotifications,
      clearLocal: () => browser.storage.local.clear(),
      clearSession: () => browser.storage.session.clear(),
      ensureAlarms,
      openSetup,
    });
    await updateBadge();
    return { ok: true };
  };

  /** The user opened a logged-out SIKOLA page: stop at once, without a request. */
  const onLoggedOutPage = async () => {
    await session.remove(SESSKEY_KEY);
    if ((await readSession(local)).state !== 'EXPIRED') await writeSession(local, clock, 'EXPIRED');
    await updateBadge();
  };

  /**
   * Attendance (M7.3): only from the Presensi page, through the same client
   * (budget, queue, backoff). Never part of a sync.
   */
  const refreshPresensi = (target: 'recap' | 'detail', courseId: number | null, force: boolean): Promise<PresensiOutcome> => refreshPresensiForCurrent({ client, store: local, clock, timeZone: timeZone() }, target, courseId, force);


  const handle = (message: Message): Promise<unknown> | null => {
    switch (message.type) {
      case 'status/get':
        return status();
      // Local only: counts the open for the "baru" markers. No request.
      // With "Pantau tugas baru" on, opening the popup also checks once (runSync skips it
      // when the last check is younger than 2 minutes); the popup shows stored data at once.
      case 'popup/opened':
        return countOpen()
          .then(() => bumpUsage(local, today(), 'popupOpens'))
          .then(async () => {
            if (watchInForce(await readExtensionWatch(local), await readRemoteConfig(local)).on) void sync('popup');
          })
          .then(status);
      case 'watch/set':
        return setWatch(message.enabled);
      case 'sync/request':
        // A request that arrives while a cycle runs shares that cycle's result.
        return sync(message.trigger, message.forceCourseList ?? false);
      case 'account/useNew':
        return useNew();
      case 'account/defer':
        return deferAccount();
      case 'data/wipeAll':
        return wipeAll();
      case 'notify/test':
        return sendTestNotification();
      case 'presensi/refresh':
        return refreshPresensi(message.target, message.courseId ?? null, message.force);
      case 'neosia/enable':
        return enableModule(neosia);
      case 'neosia/disable':
        return disableModule(neosia).then(() => ({ ok: true }));
      case 'sipakamase/enable':
        return sipakamase.enable();
      case 'sipakamase/disable':
        return sipakamase.disable();
      case 'sipakamase/refresh':
        return sipakamase.refresh();
      case 'neosia/refresh':
        // From the click on "Perbarui dari NEOSIA": the page in a new tab, watched for its data (core neosia/refresh-tab.ts).
        return startRefresh(session, async () => (await browser.tabs.create({ url: NEOSIA_REFRESH_PAGES[message.page], active: true })).id, clock.now()).then((ok) => ({ ok }));
      default:
        return null;
    }
  };

  // ---------- Listeners (registered synchronously) ----------

  browser.runtime.onInstalled.addListener((details) => {
    void ensureAlarms();
    runReminders();
    if (details.reason === 'install') void browser.tabs.create({ url: browser.runtime.getURL(ONBOARDING_PAGE) });
    if (details.reason === 'update') void openWhatsNewIfNeeded();
  });

  /**
   * After an update, someone who finished onboarding never repeats it. Only
   * when there is something new (or the privacy notice changed) do they see
   * one short "Yang baru di Sulo" screen.
   */
  async function openWhatsNewIfNeeded(): Promise<void> {
    const userId = await currentUser(local);
    if (userId === null) return;
    const completed = (await readUser(local, userId, 'onboarding')).completedAt !== null;
    const read = (await local.get<{ version: number }>(NOTICE_KEY))?.version ?? 0;
    if (!completed) return;
    if (pendingWhatsNew(WHATS_NEW, read, completed).length > 0 || read < NOTICE_VERSION) {
      await browser.tabs.create({ url: browser.runtime.getURL(`${ONBOARDING_PAGE}#whats-new`) });
    }
  }

  browser.runtime.onStartup.addListener(() => {
    void ensureAlarms();
    void updateBadge();
    runReminders();
    void scheduleCatchup('startup');
  });

  browser.idle.setDetectionInterval(IDLE_THRESHOLD_SEC);
  browser.idle.onStateChanged.addListener((state) => {
    if (state === 'active') void scheduleCatchup('idle');
  });

  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === SYNC_ALARM) void sync('background');
    if (alarm.name === WATCH_ALARM) void sync('watch');
    if (alarm.name === SIPAKAMASE_ALARM) void sipakamase.keep();
    if (alarm.name.startsWith(CATCHUP_ALARM_PREFIX)) {
      const trigger = alarm.name.slice(CATCHUP_ALARM_PREFIX.length) as SyncTrigger;
      if (CATCHUP_TRIGGERS.has(trigger)) void sync(trigger);
    }
    if (alarm.name === BADGE_ALARM) void updateBadge();
    if (alarm.name === NOTIFY_ALARM) runReminders();
  });

  browser.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    const keys = Object.keys(changes);
    if (keys.some((k) => k.endsWith(':taskState') || k.endsWith(':courses') || k === 'global:session' || k === ACCOUNT_PENDING_KEY)) void updateBadge();
    // Another account appeared (or a third one): the stored account's
    // notifications leave the screen; reminders pause (runNotifyCycle).
    const pendingChange = changes[ACCOUNT_PENDING_KEY];
    if (pendingChange?.newValue && (pendingChange.newValue as AccountPending).userId !== (pendingChange.oldValue as AccountPending | undefined)?.userId) {
      void clearAllNotifications();
    }
    if ('global:remoteConfig' in changes || EXTENSION_WATCH_KEY in changes) void ensureAlarms();
    if ('global:remoteConfig' in changes) void sipakamase.ensureAlarm();
    if (keys.some((k) => REMINDER_INPUTS.test(k) || k === SIPAKAMASE_NEWS_KEY)) runReminders();
    const account = changes[CURRENT_USER_KEY];
    if (account && account.oldValue !== undefined && account.oldValue !== account.newValue) void onAccountChanged();
  });

  /**
   * The account changed: every notification on screen belongs to the previous
   * account (the new one has shown none yet), so all are cleared. Keys left
   * behind by a late write are removed too.
   */
  const onAccountChanged = async () => {
    await sessionAge?.newSession();
    await clearAllNotifications();
    await pruneOrphanUserKeys(local);
  };

  // A NEOSIA permission removed in Chrome's settings turns the module off and deletes its data.
  browser.permissions.onRemoved.addListener(reconcileNeosia);
  // The same for Sipakamase.
  browser.permissions.onRemoved.addListener(() => void sipakamase.reconcile());

  browser.notifications.onClicked.addListener((id) => void onNotificationClick(id));

  // A SIKOLA tab finished loading. The host permission alone gives the URL of
  // SIKOLA tabs (no "tabs" permission); other tabs come without a URL and
  // are ignored here, before any storage read.
  browser.tabs.onUpdated.addListener((_tabId, change, tab) => {
    if (change.status !== 'complete' || !isSignedInSikolaPage(tab.url)) return;
    onRelogin({ kind: 'page', url: tab.url });
  });
  browser.notifications.onButtonClicked.addListener((id, index) => void onNotificationButton(id, index));

  // Every time the worker wakes up, recompute: an alarm may have been missed
  // while the browser was closed or the computer slept. Orphaned keys from an
  // earlier account are removed first.
  void pruneOrphanUserKeys(local).then(runReminders);
  reconcileNeosia();
  void sipakamase.reconcile();
  // Endpoints dropped from the allowlist leave no data behind.
  void pruneUnlistedSnapshots(local).catch(() => undefined);

  browser.runtime.onMessage.addListener((raw, sender, sendResponse) => {
    const extensionId = browser.runtime.id;
    const extensionOrigin = browser.runtime.getURL('/').replace(/\/+$/, '');
    if (sender.id !== extensionId) return false;
    const parsed = messageSchema.safeParse(raw);
    if (!parsed.success) return false;
    const message = parsed.data;

    if (message.type === 'sesskey/found') {
      if (!isContentScriptOn(sender, extensionId, SIKOLA_ORIGIN)) return false;
      // While another account is detected, a new sesskey may run one
      // session-only check (at most every 10 minutes, lib/account/pending.ts).
      // Whether the session had expired, read before the sesskey clears that.
      let wasExpired = false;
      void readSession(local)
        .then((s) => void (wasExpired = s.state === 'EXPIRED'))
        .then(getSesskey)
        .then((previous) => (previous !== null && previous !== message.sesskey ? sessionAge?.newSession() : undefined))
        .then(() => session.set(SESSKEY_KEY, message.sesskey))
        .then(() => onSesskeyReceived(local, clock))
        .then(updateBadge)
        .then(async () => {
          if (await readPending(local)) await sync('sesskey');
          else onRelogin({ kind: 'sesskey', wasExpired });
        });
      return false;
    }
    if (message.type === 'neosia/capture') {
      // Only the bridge on a NEOSIA page; anything else is dropped unread.
      if (!isContentScriptOn(sender, extensionId, NEOSIA_APP_ORIGIN)) return false;
      onNeosiaCapture(message.capture);
      // The refresh tab Sulo opened from the user's click closes once its data came in.
      const tabId = sender.tab?.id;
      void captureFrom(session, tabId, clock.now()).then((close) => {
        if (close && tabId !== undefined) setTimeout(() => void browser.tabs.remove(tabId).catch(() => undefined), REFRESH_SETTLE_MS);
      });
      return false;
    }
    if (message.type === 'sipakamase/passive') {
      // Only the reader on a Sipakamase page; validated again before anything is stored.
      if (!isContentScriptOn(sender, extensionId, SIPAKAMASE_ORIGIN)) return false;
      void sipakamase.passive(message.message);
      return false;
    }
    if (message.type === 'presensi/seenCmid') {
      if (!isContentScriptOn(sender, extensionId, SIKOLA_ORIGIN)) return false;
      // Only for the current account, and never while another one is detected.
      void (async () => {
        const userId = await currentUser(local);
        if (userId !== null && !(await readPending(local))) await recordSeenCmid(local, userId, message.cmid);
      })().catch(() => undefined);
      return false;
    }
    if (message.type === 'session/loggedOut') {
      if (!isContentScriptOn(sender, extensionId, SIKOLA_ORIGIN)) return false;
      void onLoggedOutPage();
      return false;
    }

    // Extension pages may be the popup (no tab) or a page opened in a tab
    // (the recorder, onboarding), so the origin decides, not the tab.
    if (!isExtensionPageSender(sender, extensionId, extensionOrigin)) return false;
    const work = handle(message);
    if (!work) return false;
    work.then(sendResponse, () => sendResponse(null));
    return true; // keep the channel open for the async response
  });

  // Development builds only. The condition is a build-time constant, so other
  // builds drop this branch and the whole lib/dev module with it
  // (checked by scripts/check-no-dev-code.mjs after every build).
  if (import.meta.env.MODE === 'development') {
    void import('@/lib/dev/background-dev').then(({ installDevTools }) =>
      installDevTools({
        client,
        clock,
        store: local,
        origin: SIKOLA_ORIGIN,
        runRemindersAt,
        isExtensionPage: (sender) => isExtensionPageSender(sender, browser.runtime.id, browser.runtime.getURL('/').replace(/\/+$/, '')),
        isNeosiaPage: (sender) => isContentScriptOn(sender, browser.runtime.id, NEOSIA_APP_ORIGIN),
      }),
    );
  }
});
