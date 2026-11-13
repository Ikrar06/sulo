import { browser, type Browser } from 'wxt/browser';
import { defineBackground } from 'wxt/utils/define-background';
import { createBrowserStore } from '@/lib/browser-store';
import { systemClock } from '@/lib/clock';
import { runConnectionTest } from '@/lib/connection-test';
import { messageSchema, type ConnectionTestResponse, type StatusResponse } from '@/lib/messages';
import { readBudget } from '@/lib/moodle/budget';
import { createMoodleClient } from '@/lib/moodle/client';
import { DAILY_BUDGET, SIKOLA_ORIGIN } from '@/lib/moodle/limits';
import { isValidSesskey } from '@/lib/sesskey';
import type { SessionInfo } from '@/lib/types';

const SESSKEY_KEY = 'sesskey';
const SESSION_KEY = 'global:session';

// No state in module variables except the client, whose queue only orders
// requests. All data lives in chrome.storage (CLAUDE.md, code conventions).
export default defineBackground(() => {
  const local = createBrowserStore(browser.storage.local);
  const session = createBrowserStore(browser.storage.session);

  const getSesskey = async () => {
    const value = await session.get<string>(SESSKEY_KEY);
    return isValidSesskey(value) ? value : null;
  };

  const client = createMoodleClient({
    fetch: (input, init) => fetch(input, init),
    store: local,
    clock: systemClock,
    baseUrl: SIKOLA_ORIGIN,
    getSesskey,
  });

  const status = async (): Promise<StatusResponse> => {
    const budget = await readBudget(local, systemClock);
    return { hasSesskey: (await getSesskey()) !== null, budgetUsed: budget.used, budgetLimit: DAILY_BUDGET };
  };

  const testConnection = async (): Promise<ConnectionTestResponse> => {
    const outcome = await runConnectionTest(client);
    if (outcome.dropSesskey) await session.remove(SESSKEY_KEY);
    if (outcome.sessionState) {
      const info: SessionInfo = {
        state: outcome.sessionState,
        userId: outcome.userId,
        checkedAt: systemClock.now(),
      };
      await local.set(SESSION_KEY, info);
    }
    return { result: outcome.result, ...(await status()) };
  };

  browser.runtime.onMessage.addListener((raw, sender, sendResponse) => {
    if (sender.id !== browser.runtime.id) return false;
    const parsed = messageSchema.safeParse(raw);
    if (!parsed.success) return false;
    const message = parsed.data;

    if (message.type === 'sesskey/found') {
      if (!isFromSikolaTab(sender)) return false;
      void session.set(SESSKEY_KEY, message.sesskey);
      return false;
    }

    if (!isFromExtensionPage(sender)) return false;
    const work = message.type === 'status/get' ? status() : testConnection();
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
