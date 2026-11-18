// Which NEOSIA response a URL is, if any. Pure, no dependencies (bundled
// into the page-world script). Only https://api.neosia.unhas.ac.id counts;
// every other host, including the app's connectivity check on
// jsonplaceholder.typicode.com, is ignored. The query string is never looked at.

import { ENDPOINTS, NEOSIA_API_HOST, NEVER_READ_PATHS, type Endpoint } from './allowlist';

export type UrlMatch = { kind: 'endpoint'; endpoint: Endpoint; path: string } | { kind: 'never'; path: string } | { kind: 'other'; path: string };

/** Up to two segments after the endpoint's path, each an id ("123", "20251", a uuid). */
const TAIL_SEGMENT = /^(?:\d{1,12}|[0-9a-f-]{8,40})$/i;
const MAX_TAIL = 2;

const segmentsOf = (path: string) => path.split('/').filter((s) => s.length > 0);

// Longest paths first, so "kartu_hasil_studi/semester" wins over shorter ones.
const BY_LENGTH = [...ENDPOINTS].sort((a, b) => segmentsOf(b.path).length - segmentsOf(a.path).length);

function contains(segments: readonly string[], pattern: readonly string[]): number {
  for (let i = 0; i + pattern.length <= segments.length; i++) {
    if (pattern.every((p, j) => segments[i + j] === p)) return i;
  }
  return -1;
}

/**
 * The path with anything that could identify a person replaced: numbers,
 * long codes and student-number-like segments become {id}. Used only for
 * the dev build's observation list.
 */
export function scrubPath(path: string): string {
  const out = segmentsOf(path).map((s) => (/\d/.test(s) && /^[0-9A-Za-z_-]+$/.test(s) && !/^[a-z_]+\d?$/i.test(s) ? '{id}' : s.length > 40 ? '{id}' : s));
  return `/${out.join('/')}`;
}

/** null: not a NEOSIA API URL at all. */
export function matchUrl(raw: string, base?: string): UrlMatch | null {
  let url: URL;
  try {
    url = new URL(raw, base);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' || url.hostname !== NEOSIA_API_HOST) return null;
  const segments = segmentsOf(url.pathname);
  const path = scrubPath(url.pathname);
  if (NEVER_READ_PATHS.some((p) => contains(segments, segmentsOf(p)) >= 0)) return { kind: 'never', path };
  for (const endpoint of BY_LENGTH) {
    const pattern = segmentsOf(endpoint.path);
    const at = contains(segments, pattern);
    if (at < 0) continue;
    const tail = segments.slice(at + pattern.length);
    if (tail.length <= MAX_TAIL && tail.every((s) => TAIL_SEGMENT.test(s))) return { kind: 'endpoint', endpoint, path };
  }
  return { kind: 'other', path };
}
