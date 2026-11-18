import { browser } from 'wxt/browser';
import { SIKOLA_LOGIN_URL } from '@/lib/links';
import { defineBackground } from 'wxt/utils/define-background';
import { BADGE_COLORS } from '@/lib/brand';
import { createBrowserStore } from '@/lib/browser-store';
import { systemClock } from '@/lib/clock';
import {
  messageSchema,
  type Message,
  type StatusResponse,
} from '@/lib/messages';
import { readBudget } from '@/lib/moodle/budget';
import { createMoodleClient } from '@/lib/moodle/client';
import { readCalendar, refreshCalendar } from '@/lib/calendar/remote';
import { CALENDAR_HIGHLIGHT_KEY, calendarHighlight, type CalendarHighlight } from '@/lib/calendar/highlight';
import { localParts } from '@/lib/reminders/zoned';
import { dashboardPath } from '@/lib/dashboard/routes';
import { CALENDAR_URL, CATCHUP_DELAY_MAX_MIN, DAILY_BUDGET, IDLE_THRESHOLD_SEC, REMOTE_CONFIG_URL, SIKOLA_ORIGIN } from '@/lib/moodle/limits';
import { createRequestLogger } from '@/lib/net/request-log';
import { createSessionAgeLogger } from '@/lib/net/session-age';
import { createScheduler } from '@/lib/net/scheduler';
import { fetchSlotHour } from '@/lib/remote/fetch-public';
import { onSesskeyReceived, readSession, writeSession } from '@/lib/moodle/session';
import { trySesskeyFallbackFromPopup as trySesskeyFallback } from '@/lib/moodle/sesskey-fallback';
import { pendingWhatsNew, WHATS_NEW } from '@/lib/onboarding/whats-new';
import { effectiveIntervalMinutes, readRemoteConfig, refreshRemoteConfig } from '@/lib/remote/remote-config';
import { BADGE_ALARM, BADGE_REFRESH_MIN, ensureJitter, SYNC_ALARM, type IdleState } from '@/lib/schedule';
import { isContentScriptOn, isExtensionPageSender } from '@/lib/sender';
import { isValidSesskey } from '@/lib/sesskey';
import { CURRENT_USER_KEY, currentUser, NOTICE_KEY, NOTICE_VERSION, pruneOrphanUserKeys, readUser, writeUser } from '@/lib/storage';
import { readPrefs } from '@/lib/prefs';
import { changeUrl } from '@/lib/radar/describe';
import { countPopupOpen } from '@/lib/radar/log';
import { parseNotificationId, runNotifyCycle, type Notifier } from '@/lib/reminders/run';
import { createSingleFlight, isSyncRunning } from '@/lib/sync/lock';
import { bumpUsage } from '@/lib/stats/usage';
import { ACCOUNT_PENDING_KEY, readPending, type AccountPending } from '@/lib/account/pending';
import { useNewAccount, wipeAllData } from '@/lib/account/actions';
import { runSync } from '@/lib/sync/run-sync';
import { setDone, setSnooze } from '@/lib/tasks/local-state';
import { messagesFor, resolveLocale } from '@/lib/i18n';
import type { SyncOutcome, SyncTrigger } from '@/lib/types';
import { loadPopupInput } from '@/lib/view/load';
import { browserModuleDeps } from '@/lib/neosia/browser-deps';
import { disableModule, enableModule, reconcileModule } from '@/lib/neosia/module';
import { NEOSIA_APP_ORIGIN } from '@/lib/neosia/allowlist';
import { ingestCapture } from '@/lib/neosia/store';
import { recordGrades } from '@/lib/neosia/grades';
import { buildPopupView } from '@/lib/view/popup-view';

const SESSKEY_KEY = 'sesskey';
/** The one rolling alarm for every notification (docs/ARCHITECTURE.md section 9). */
const NOTIFY_ALARM = 'notify';
/** Storage changes that can move the next reminder. Not notified or stats (written by the cycle itself). */
const REMINDER_INPUTS = /^(u:\d+:(tasks|taskState|courses|changes)|global:(prefs|session|currentUser|accountPending|calendar|neosia)|neosia:snap:checkJadwalBelanjaKRS)$/;
/** The popup opens on this panel once (a click on an update summary). */
const POPUP_PANEL_KEY = 'global:popupPanel';
const SNOOZE_FROM_NOTIFICATION = 3600;
const ONBOARDING_PAGE = '/onboarding.html';
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
      const result = await runNotifyCycle({ store: local, now, timeZone: timeZone(), uiLanguage: browser.i18n.getUILanguage(), notifier });
      await countShown(result.shownKinds ?? []);
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
        await browser.tabs.create({ url: `${SIKOLA_ORIGIN}/my/` });
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
    } else if (kind === 'krs') {
      await browser.tabs.create({ url: browser.runtime.getURL(dashboardPath('ringkasan')) });
    } else if (kind === 'calendar') {
      await browser.tabs.create({ url: browser.runtime.getURL(dashboardPath('kalender')) });
    } else if (kind === 'session') {
      await browser.tabs.create({ url: SIKOLA_LOGIN_URL });
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
    const unattended = trigger === 'background' || CATCHUP_TRIGGERS.has(trigger);
    const idleState: IdleState | undefined = unattended ? ((await browser.idle.queryState(IDLE_THRESHOLD_SEC)) as IdleState) : undefined;
    await recoverSesskeyIfAllowed(trigger);
    const outcome = await runSync({ client, store: local, clock, trigger, idleState, forceCourseList });
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
    // The new account's owner has not agreed to the NEOSIA module.
    if (ok) await disableModule(neosia);
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
      beforeClear: () => disableModule(neosia),
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

  const handle = (message: Message): Promise<unknown> | null => {
    switch (message.type) {
      case 'status/get':
        return status();
      // Local only: counts the open for the "baru" markers. No request.
      case 'popup/opened':
        return countOpen()
          .then(() => bumpUsage(local, today(), 'popupOpens'))
          .then(status);
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
      case 'neosia/enable':
        return enableModule(neosia);
      case 'neosia/disable':
        return disableModule(neosia).then(() => ({ ok: true }));
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
    if ('global:remoteConfig' in changes) void ensureAlarms();
    if (keys.some((k) => REMINDER_INPUTS.test(k))) runReminders();
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

  browser.notifications.onClicked.addListener((id) => void onNotificationClick(id));
  browser.notifications.onButtonClicked.addListener((id, index) => void onNotificationButton(id, index));

  // Every time the worker wakes up, recompute: an alarm may have been missed
  // while the browser was closed or the computer slept. Orphaned keys from an
  // earlier account are removed first.
  void pruneOrphanUserKeys(local).then(runReminders);
  reconcileNeosia();

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
      void getSesskey()
        .then((previous) => (previous !== null && previous !== message.sesskey ? sessionAge?.newSession() : undefined))
        .then(() => session.set(SESSKEY_KEY, message.sesskey))
        .then(() => onSesskeyReceived(local, clock))
        .then(updateBadge)
        .then(async () => {
          if (await readPending(local)) await sync('sesskey');
        });
      return false;
    }
    if (message.type === 'neosia/capture') {
      // Only the bridge on a NEOSIA page; anything else is dropped unread.
      if (!isContentScriptOn(sender, extensionId, NEOSIA_APP_ORIGIN)) return false;
      onNeosiaCapture(message.capture);
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
