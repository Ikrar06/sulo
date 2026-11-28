// One read of one Sipakamase fragment, through the scheduler's `sipakamase`
// domain: GET only, the five exact paths, the browser's (or the phone's
// vault) session cookie, no cache, redirects never followed. The address is
// built only from constants (store.ts FRAGMENT_PATH); nothing here takes an
// address from a page.
//
// Any answer other than the expected fragment stops there, without a retry:
// a redirect, 401 or 403, or a login page is `login`; a page whose headings
// changed is `shape`; the rest is `error`.

import type { Scheduler } from '../net/scheduler';
import { SIPAKAMASE_ORIGIN } from './allowlist';
import { parseClaim, parseConversions, parseCourses, parseHistory, parseRunning, type ParseResult } from './parse';
import { FRAGMENT_PATH, type FragmentData, type FragmentId, type FragmentValue } from './store';

/** A fragment is a few kilobytes; anything far larger is not one. */
const MAX_BODY_CHARS = 512 * 1024;

export type FragmentRead =
  | { kind: 'ok'; value: FragmentValue }
  | { kind: 'login' }
  | { kind: 'shape' }
  | { kind: 'error'; reason: string };

export const PARSERS: { [K in FragmentId]: (html: string) => ParseResult<FragmentData[K]> } = {
  running: parseRunning,
  history: parseHistory,
  courses: parseCourses,
  claim: parseClaim,
  conversions: parseConversions,
};

/** Parse one fragment's HTML into the value to store; also used by the passive reader. */
export function readHtml(fragment: FragmentId, html: string): FragmentRead {
  const parsed = PARSERS[fragment](html) as ParseResult<FragmentData[FragmentId]>;
  if (!parsed.ok) return parsed.reason === 'login' ? { kind: 'login' } : { kind: 'shape' };
  return { kind: 'ok', value: { fragment, data: parsed.data } as FragmentValue };
}

export async function readFragment(scheduler: Scheduler, fragment: FragmentId, trigger: string): Promise<FragmentRead> {
  const result = await scheduler.request('sipakamase', `${SIPAKAMASE_ORIGIN}${FRAGMENT_PATH[fragment]}`, { method: 'GET' }, { trigger });
  if (result.kind === 'refused') return { kind: 'error', reason: result.reason };
  if (result.kind === 'timeout' || result.kind === 'network_error') return { kind: 'error', reason: result.kind };
  if (result.kind === 'http_error') return { kind: 'error', reason: `http ${result.status}` };
  const response = result.response;
  if (response.type === 'opaqueredirect' || (response.status >= 300 && response.status < 400) || response.status === 401 || response.status === 403) return { kind: 'login' };
  if (response.status !== 200) return { kind: 'error', reason: `http ${response.status}` };
  let html: string;
  try {
    html = await response.text();
  } catch {
    return { kind: 'error', reason: 'unreadable' };
  }
  if (html.length > MAX_BODY_CHARS) return { kind: 'shape' };
  return readHtml(fragment, html);
}
