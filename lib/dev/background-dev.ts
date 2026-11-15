import { browser } from 'wxt/browser';
import { recordFixtures } from '../recorder';
import type { MoodleClient } from '../moodle/client';
import { currentUser, writeUser } from '../storage';
import type { Clock, KeyValueStore, UnixSeconds } from '../types';
import { devMessageSchema } from './messages';

// Development builds only (see lib/dev/messages.ts). Registers a separate
// message listener for the recorder and the reminder simulator.

export interface DevDeps {
  client: MoodleClient;
  clock: Clock;
  store: KeyValueStore;
  origin: string;
  /** Runs a reminder cycle at a given time and returns what happened. */
  runRemindersAt: (now: UnixSeconds) => Promise<{ nextAt: UnixSeconds | null; shown: number }>;
  isExtensionPage: (sender: Parameters<Parameters<typeof browser.runtime.onMessage.addListener>[0]>[1]) => boolean;
}

export function installDevTools(deps: DevDeps): void {
  browser.runtime.onMessage.addListener((raw, sender, sendResponse) => {
    const parsed = devMessageSchema.safeParse(raw);
    if (!parsed.success || !deps.isExtensionPage(sender)) return false;
    const message = parsed.data;
    const work = (async (): Promise<unknown> => {
      switch (message.type) {
        case 'dev/record':
          return recordFixtures({
            client: deps.client,
            clock: deps.clock,
            origin: deps.origin,
            // Random shift of 20 to 60 days back, so real dates cannot be read off.
            timeShiftSeconds: -(20 + Math.floor(Math.random() * 41)) * 86_400,
          });
        case 'dev/notify/simulate':
          return deps.runRemindersAt(message.at);
        case 'dev/notify/reset': {
          const userId = await currentUser(deps.store);
          if (userId !== null) await writeUser(deps.store, userId, 'notified', {});
          return { ok: true };
        }
      }
    })();
    work.then(sendResponse, () => sendResponse(null));
    return true;
  });
}
