import { browser } from 'wxt/browser';
import { defineBackground } from 'wxt/utils/define-background';
import { BADGE_COLORS } from '@/lib/brand';
import { createBrowserStore } from '@/lib/browser-store';
import { systemClock } from '@/lib/clock';
import { runConnectionTest } from '@/lib/connection-test';
import {
  messageSchema,
  type ConnectionTestResponse,
  type Message,
  type StatusResponse,
} from '@/lib/messages';
import { readBudget } from '@/lib/moodle/budget';
import { createMoodleClient } from '@/lib/moodle/client';
import { DAILY_BUDGET, IDLE_THRESHOLD_SEC, REMOTE_CONFIG_URL, SIKOLA_ORIGIN } from '@/lib/moodle/limits';
import { onSesskeyReceived, readSession, writeSession } from '@/lib/moodle/session';
import { trySesskeyFallbackFromPopup } from '@/lib/moodle/sesskey-fallback';
import { pendingWhatsNew, WHATS_NEW } from '@/lib/onboarding/whats-new';
import { effectiveIntervalMinutes, readRemoteConfig, refreshRemoteConfig } from '@/lib/remote-config';
import { BADGE_ALARM, BADGE_REFRESH_MIN, jitterMinutes, SYNC_ALARM, type IdleState } from '@/lib/schedule';
import { isContentScriptOn, isExtensionPageSender } from '@/lib/sender';
import { isValidSesskey } from '@/lib/sesskey';
import { currentUser, NOTICE_KEY, NOTICE_VERSION, readUser, writeUser } from '@/lib/storage';
import { readPrefs } from '@/lib/prefs';
import { changeUrl } from '@/lib/radar/describe';
import { countPopupOpen } from '@/lib/radar/log';
import { parseNotificationId, runNotifyCycle, type Notifier } from '@/lib/reminders/run';
import { runSync } from '@/lib/sync/run-sync';
import { setDone, setSnooze } from '@/lib/tasks/local-state';
import { messagesFor, resolveLocale } from '@/lib/i18n';
import type { SyncOutcome, SyncTrigger } from '@/lib/types';
import { loadPopupInput } from '@/lib/view/load';
import { buildPopupView } from '@/lib/view/popup-view';

const SESSKEY_KEY = 'sesskey';
/** The one rolling alarm for every notification (docs/ARCHITECTURE.md section 9). */
const NOTIFY_ALARM = 'notify';
/** Storage changes that can move the next reminder. Not notified or stats (written by the cycle itself). */
const REMINDER_INPUTS = /^(u:\d+:(tasks|taskState|courses|changes)|global:(prefs|session|currentUser))$/;
/** The popup opens on this panel once (a click on an update summary). */
const POPUP_PANEL_KEY = 'global:popupPanel';
const SNOOZE_FROM_NOTIFICATION = 3600;
const ONBOARDING_PAGE = '/onboarding.html';

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

  const client = createMoodleClient({
    fetch: (input, init) => fetch(input, init),
    store: local,
    clock,
    baseUrl: SIKOLA_ORIGIN,
    getSesskey,
  });

  const refreshConfig = () => refreshRemoteConfig({ fetch: (i, init) => fetch(i, init), store: local, clock, url: REMOTE_CONFIG_URL });

  // ---------- Badge ----------

  const updateBadge = async () => {
    const view = buildPopupView(await loadPopupInput(local, clock, timeZone()));
    await browser.action.setBadgeText({ text: view.onboarded ? view.badge.text : '' });
    await browser.action.setBadgeBackgroundColor({ color: BADGE_COLORS[view.badge.tone] });
  };

  // ---------- Alarms ----------

  const ensureAlarms = async () => {
    const config = await readRemoteConfig(local);
    const period = effectiveIntervalMinutes(config);
    const existing = await browser.alarms.get(SYNC_ALARM);
    if (!existing || existing.periodInMinutes !== period) {
      await browser.alarms.create(SYNC_ALARM, { delayInMinutes: 1 + (await jitterMinutes(local)), periodInMinutes: period });
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
    const { kind, eventId, entryId } = parseNotificationId(id);
    await browser.notifications.clear(id);
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
    } else if (kind === 'session') {
      await browser.tabs.create({ url: `${SIKOLA_ORIGIN}/my/` });
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

  const sync = async (trigger: SyncTrigger): Promise<SyncOutcome> => {
    await refreshConfig();
    const idleState: IdleState | undefined =
      trigger === 'background' ? ((await browser.idle.queryState(IDLE_THRESHOLD_SEC)) as IdleState) : undefined;
    const outcome = await runSync({ client, store: local, clock, trigger, idleState });
    if (outcome.status === 'invalid_sesskey') await session.remove(SESSKEY_KEY);
    await updateBadge();
    return outcome;
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

  const onPopupOpened = async (): Promise<StatusResponse> => {
    await refreshConfig();
    const current = await readSession(local);
    if ((await getSesskey()) === null && current.state !== 'EXPIRED') {
      const fallback = await trySesskeyFallbackFromPopup({ client, store: local, clock });
      if (fallback.kind === 'recovered') await session.set(SESSKEY_KEY, fallback.sesskey);
      if (fallback.kind === 'not_found') await writeSession(local, clock, 'EXPIRED');
    }
    return status();
  };

  const testConnection = async (): Promise<ConnectionTestResponse> => {
    await refreshConfig();
    const outcome = await runConnectionTest(client);
    if (outcome.dropSesskey) await session.remove(SESSKEY_KEY);
    if (outcome.sessionState) await writeSession(local, clock, outcome.sessionState, outcome.userId ?? undefined);
    return { result: outcome.result, ...(await status()) };
  };

  const handle = (message: Message): Promise<unknown> | null => {
    switch (message.type) {
      case 'status/get':
        return status();
      case 'popup/opened':
        return countOpen().then(onPopupOpened);
      case 'sync/request':
        return sync(message.trigger);
      case 'connection/test':
        return testConnection();
      case 'notify/test':
        return sendTestNotification();
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
  });

  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === SYNC_ALARM) void sync('background');
    if (alarm.name === BADGE_ALARM) void updateBadge();
    if (alarm.name === NOTIFY_ALARM) runReminders();
  });

  browser.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    const keys = Object.keys(changes);
    if (keys.some((k) => k.endsWith(':taskState') || k.endsWith(':courses') || k === 'global:session')) void updateBadge();
    if ('global:remoteConfig' in changes) void ensureAlarms();
    if (keys.some((k) => REMINDER_INPUTS.test(k))) runReminders();
  });

  browser.notifications.onClicked.addListener((id) => void onNotificationClick(id));
  browser.notifications.onButtonClicked.addListener((id, index) => void onNotificationButton(id, index));

  // Every time the worker wakes up, recompute: an alarm may have been missed
  // while the browser was closed or the computer slept.
  runReminders();

  browser.runtime.onMessage.addListener((raw, sender, sendResponse) => {
    const extensionId = browser.runtime.id;
    const extensionOrigin = browser.runtime.getURL('/').replace(/\/+$/, '');
    if (sender.id !== extensionId) return false;
    const parsed = messageSchema.safeParse(raw);
    if (!parsed.success) return false;
    const message = parsed.data;

    if (message.type === 'sesskey/found') {
      if (!isContentScriptOn(sender, extensionId, SIKOLA_ORIGIN)) return false;
      void session.set(SESSKEY_KEY, message.sesskey).then(() => onSesskeyReceived(local, clock)).then(updateBadge);
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
      }),
    );
  }
});
