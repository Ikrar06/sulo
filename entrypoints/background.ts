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
  type RecordResponse,
  type StatusResponse,
} from '@/lib/messages';
import { readBudget } from '@/lib/moodle/budget';
import { createMoodleClient } from '@/lib/moodle/client';
import { DAILY_BUDGET, IDLE_THRESHOLD_SEC, REMOTE_CONFIG_URL, SIKOLA_ORIGIN } from '@/lib/moodle/limits';
import { onSesskeyReceived, readSession, writeSession } from '@/lib/moodle/session';
import { trySesskeyFallbackFromPopup } from '@/lib/moodle/sesskey-fallback';
import { recordFixtures } from '@/lib/recorder';
import { effectiveIntervalMinutes, readRemoteConfig, refreshRemoteConfig } from '@/lib/remote-config';
import { BADGE_ALARM, BADGE_REFRESH_MIN, jitterMinutes, SYNC_ALARM, type IdleState } from '@/lib/schedule';
import { isContentScriptOn, isExtensionPageSender } from '@/lib/sender';
import { isValidSesskey } from '@/lib/sesskey';
import { runSync } from '@/lib/sync/run-sync';
import type { SyncOutcome, SyncTrigger } from '@/lib/types';
import { loadPopupInput } from '@/lib/view/load';
import { buildPopupView } from '@/lib/view/popup-view';

const SESSKEY_KEY = 'sesskey';
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

  const record = async (): Promise<RecordResponse> =>
    recordFixtures({
      client,
      clock,
      origin: SIKOLA_ORIGIN,
      // Random shift of 20 to 60 days back, so real dates cannot be read off.
      timeShiftSeconds: -(20 + Math.floor(Math.random() * 41)) * 86_400,
    });

  const handle = (message: Message): Promise<unknown> | null => {
    switch (message.type) {
      case 'status/get':
        return status();
      case 'popup/opened':
        return onPopupOpened();
      case 'sync/request':
        return sync(message.trigger);
      case 'connection/test':
        return testConnection();
      case 'dev/record':
        return import.meta.env.MODE !== 'production' ? record() : null;
      default:
        return null;
    }
  };

  // ---------- Listeners (registered synchronously) ----------

  browser.runtime.onInstalled.addListener((details) => {
    void ensureAlarms();
    if (details.reason === 'install') void browser.tabs.create({ url: browser.runtime.getURL(ONBOARDING_PAGE) });
  });

  browser.runtime.onStartup.addListener(() => {
    void ensureAlarms();
    void updateBadge();
  });

  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === SYNC_ALARM) void sync('background');
    if (alarm.name === BADGE_ALARM) void updateBadge();
  });

  browser.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (Object.keys(changes).some((k) => k.endsWith(':taskState') || k.endsWith(':courses'))) void updateBadge();
    if ('global:remoteConfig' in changes) void ensureAlarms();
  });

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
});
