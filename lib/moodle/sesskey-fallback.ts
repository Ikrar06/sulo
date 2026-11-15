// Sesskey fallback: fetch /my/ and read the sesskey from the page config.
// Only when the user opens the popup, at most once per
// SESSKEY_FALLBACK_POPUP_GAP_H. There is no background fallback, because that
// would fetch HTML without a user action (project rule: no background HTML scraping).

import type { Clock, KeyValueStore, UnixSeconds } from '../types';
import { isValidSesskey } from '../sesskey';
import type { MoodleClient } from './client';
import { SESSKEY_FALLBACK_POPUP_GAP_H } from './limits';

export const FALLBACK_KEY = 'global:sesskeyFallback';

interface FallbackState {
  lastPopupAttemptAt: UnixSeconds;
}

export type FallbackResult =
  | { kind: 'recovered'; sesskey: string }
  | { kind: 'too_soon' }
  | { kind: 'login_required' }
  | { kind: 'not_found' }
  | { kind: 'failed'; reason: string };

const SESSKEY_IN_CONFIG = /"sesskey":"([^"]+)"/;

export function extractSesskeyFromHtml(html: string): string | null {
  const match = SESSKEY_IN_CONFIG.exec(html);
  const value = match?.[1];
  return isValidSesskey(value) ? value : null;
}

export async function trySesskeyFallbackFromPopup(deps: {
  client: MoodleClient;
  store: KeyValueStore;
  clock: Clock;
}): Promise<FallbackResult> {
  const now = deps.clock.now();
  const state = await deps.store.get<FallbackState>(FALLBACK_KEY);
  if (state && now - state.lastPopupAttemptAt < SESSKEY_FALLBACK_POPUP_GAP_H * 3600) {
    return { kind: 'too_soon' };
  }
  // Record the attempt before sending so failures also respect the gap.
  await deps.store.set<FallbackState>(FALLBACK_KEY, { lastPopupAttemptAt: now });

  const page = await deps.client.fetchPage('/my/');
  if (page.kind === 'login_required') return { kind: 'login_required' };
  if (page.kind !== 'ok') return { kind: 'failed', reason: page.kind === 'refused' ? page.reason : page.kind };

  const sesskey = extractSesskeyFromHtml(page.html);
  // A page without a sesskey while not redirected is most likely a login form.
  return sesskey ? { kind: 'recovered', sesskey } : { kind: 'not_found' };
}
