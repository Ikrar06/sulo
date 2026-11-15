import { browser, type Browser } from 'wxt/browser';
import { defineBackground } from 'wxt/utils/define-background';
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
import { DAILY_BUDGET, REMOTE_CONFIG_URL, SIKOLA_ORIGIN } from '@/lib/moodle/limits';
import { onSesskeyReceived, readSession, writeSession } from '@/lib/moodle/session';
import { trySesskeyFallbackFromPopup } from '@/lib/moodle/sesskey-fallback';
import { recordFixtures } from '@/lib/recorder';
import { readRemoteConfig, refreshRemoteConfig } from '@/lib/remote-config';
import { isValidSesskey } from '@/lib/sesskey';

const SESSKEY_KEY = 'sesskey';

// No state in module variables except the client, whose queue only orders
// requests. All data lives in chrome.storage (project convention).
export default defineBackground(() => {
  const local = createBrowserStore(browser.storage.local);
  const session = createBrowserStore(browser.storage.session);
  const clock = systemClock;

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
      case 'connection/test':
        return testConnection();
      case 'dev/record':
        return import.meta.env.DEV ? record() : null;
      default:
        return null;
    }
  };

  browser.runtime.onMessage.addListener((raw, sender, sendResponse) => {
    if (sender.id !== browser.runtime.id) return false;
    const parsed = messageSchema.safeParse(raw);
    if (!parsed.success) return false;
    const message = parsed.data;

    if (message.type === 'sesskey/found') {
      if (!isFromSikolaTab(sender)) return false;
      void session.set(SESSKEY_KEY, message.sesskey).then(() => onSesskeyReceived(local, clock));
      return false;
    }

    if (!isFromExtensionPage(sender)) return false;
    const work = handle(message);
    if (!work) return false;
    work.then(sendResponse, () => sendResponse(null));
    return true; // keep the channel open for the async response
  });
});

function isFromSikolaTab(sender: Browser.runtime.MessageSender): boolean {
  if (!sender.tab || !sender.url) return false;
  try {
    return new URL(sender.url).origin === SIKOLA_ORIGIN;
  } catch {
    return false;
  }
}

function isFromExtensionPage(sender: Browser.runtime.MessageSender): boolean {
  return !sender.tab && typeof sender.url === 'string' && sender.url.startsWith(browser.runtime.getURL('/'));
}
