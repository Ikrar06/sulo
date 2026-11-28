// A summary of a HAR recording, for studying which requests a page makes.
// Only the shape of each request leaves: method, host, path, the names of
// query parameters, status, content type, sizes and the NAMES of headers.
// Never a response body, a header value, a cookie value or a query value.
//
// `detail` adds three more name lists the owner can opt into: posted field
// names, cookie names, and for cookies the server sets, their flags and how
// long they last (a duration, not a date).

import type { SipakamaseSanitizer } from './sipakamase.ts';

export interface HarRequestSummary {
  order: number;
  /** Milliseconds since the first request of the recording. */
  sinceStartMs: number | null;
  method: string;
  host: string;
  path: string;
  queryNames: string[];
  status: number;
  contentType: string;
  requestBytes: number | null;
  responseBytes: number | null;
  redirectsTo: string | null;
  requestHeaderNames: string[];
  responseHeaderNames: string[];
  postedFieldNames?: string[];
  cookiesSent?: string[];
  cookiesSet?: { name: string; httpOnly: boolean; secure: boolean; sameSite: string | null; lifetimeSeconds: number | 'session' }[];
}

export interface HarSummary {
  note: string;
  requests: HarRequestSummary[];
}

const record = (v: unknown): Record<string, unknown> => (v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const size = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null);
const unique = (names: string[]): string[] => [...new Set(names)].sort();

/** A name is kept only when it looks like one; anything else becomes "x". */
const safeName = (v: unknown, shape: RegExp): string => (typeof v === 'string' && shape.test(v) ? v : 'x');
const HEADER = /^:?[\w!#$%&'*+.^`|~-]{1,60}$/;
const PARAM = /^[\w\-.[\]]{1,40}$/;
const COOKIE = /^[\w.\-]{1,60}$/;

function names(items: unknown, shape: RegExp, lower = false): string[] {
  return unique(list(items).map((item) => safeName(record(item).name, shape)).map((n) => (lower ? n.toLowerCase() : n)));
}

/** Host and path of a link that has been through the sanitizer; query values are dropped here. */
function split(clean: string): { host: string; path: string; queryNames: string[] } {
  const m = /^(?:[a-z][a-z0-9+.-]*:)?\/\/([^/?#]*)([^?#]*)(?:\?([^#]*))?/i.exec(clean);
  if (!m) return { host: 'x', path: 'x', queryNames: [] };
  const queryNames = (m[3] ?? '').split('&').filter(Boolean).map((pair) => safeName(pair.split('=')[0], PARAM));
  return { host: /^[A-Za-z0-9.-]+(?::\d+)?$/.test(m[1]!) ? m[1]! : 'x', path: m[2] === '' ? '/' : m[2]!, queryNames: unique(queryNames) };
}

function postedNames(postData: unknown): string[] {
  const data = record(postData);
  const fromParams = names(data.params, PARAM);
  if (fromParams.length > 0 || typeof data.text !== 'string') return fromParams;
  const text = data.text.trim();
  if (text.startsWith('{')) {
    try {
      return unique(Object.keys(record(JSON.parse(text))).map((k) => safeName(k, PARAM)));
    } catch {
      return [];
    }
  }
  return unique(text.split('&').filter((pair) => pair.includes('=')).map((pair) => safeName(pair.split('=')[0], PARAM)));
}

export function summarizeHar(raw: unknown, sanitizer: SipakamaseSanitizer, detail = false): HarSummary {
  const entries = list(record(record(raw).log).entries).map(record);
  const startOf = (e: Record<string, unknown>) => (typeof e.startedDateTime === 'string' ? Date.parse(e.startedDateTime) : Number.NaN);
  const first = entries.length > 0 ? startOf(entries[0]!) : Number.NaN;
  const requests = entries.map((entry, i): HarRequestSummary => {
    const request = record(entry.request);
    const response = record(entry.response);
    const started = startOf(entry);
    const url = split(sanitizer.url(typeof request.url === 'string' ? request.url : ''));
    const redirect = typeof response.redirectURL === 'string' && response.redirectURL !== '' ? split(sanitizer.url(response.redirectURL)) : null;
    const mime = String(record(response.content).mimeType ?? '').split(';')[0]!.trim().toLowerCase();
    return {
      order: i + 1,
      sinceStartMs: Number.isFinite(started) && Number.isFinite(first) ? Math.round(started - first) : null,
      method: safeName(request.method, /^[A-Z]{1,10}$/),
      host: url.host,
      path: url.path,
      queryNames: url.queryNames,
      status: typeof response.status === 'number' ? response.status : 0,
      contentType: /^[\w.+-]+\/[\w.+-]+$/.test(mime) ? mime : '',
      requestBytes: size(request.bodySize),
      responseBytes: size(record(response.content).size) ?? size(response.bodySize),
      redirectsTo: redirect ? `${redirect.host}${redirect.path}` : null,
      requestHeaderNames: names(request.headers, HEADER, true),
      responseHeaderNames: names(response.headers, HEADER, true),
      ...(detail
        ? {
            postedFieldNames: postedNames(request.postData),
            cookiesSent: names(request.cookies, COOKIE),
            cookiesSet: list(response.cookies).map(record).map((c) => {
              const expires = typeof c.expires === 'string' ? Date.parse(c.expires) : Number.NaN;
              return {
                name: safeName(c.name, COOKIE),
                httpOnly: c.httpOnly === true,
                secure: c.secure === true,
                sameSite: typeof c.sameSite === 'string' && /^(?:strict|lax|none)$/i.test(c.sameSite) ? c.sameSite.toLowerCase() : null,
                // Rounded to the minute: how long, never when.
                lifetimeSeconds: Number.isFinite(expires) && Number.isFinite(started) ? Math.round((expires - started) / 60_000) * 60 : ('session' as const),
              };
            }),
          }
        : {}),
    };
  });
  return { note: 'Ringkasan HAR Sipakamase. Tanpa isi respons, tanpa nilai header, cookie, atau parameter.', requests };
}
