// The page-world capture (entrypoints/neosia-main.ts). Wraps fetch and
// XMLHttpRequest on NEOSIA pages to read, never change, the responses the
// NEOSIA app asked for itself (project rules 12, 14, 15).
//
// - Never throws into the app, never changes or delays a response: every
//   step is in try/catch and fails silently; the wrapper returns exactly
//   what the original returned.
// - fetch is read from response.clone(), asynchronously. XHR is read on its
//   "load" event, only when responseType is "" or "json".
// - Only allowlisted paths on api.neosia.unhas.ac.id are parsed; the
//   projection happens here, so the raw response never leaves this script.
// - The wrappers keep the originals' name and length for the app's sake.
//   They are not hidden (project rule 5): no toString faking.
//
// No dependencies besides the allowlist modules (plain data and functions).

import { CAPTURE_SCHEMA_VERSION, CAPTURE_TYPE, MAX_MESSAGE_CHARS, MAX_RESPONSE_CHARS, type EndpointId } from './allowlist';
import { matchUrl, type UrlMatch } from './match';
import { projectResponse, type Projected } from './project';

export type CaptureMessage =
  | { type: typeof CAPTURE_TYPE; v: number; endpoint: EndpointId; status: 'ok'; data: Projected; at: number }
  | { type: typeof CAPTURE_TYPE; v: number; endpoint: EndpointId; status: 'unknown_shape'; at: number };

/** What the capture needs from the page's window. */
export interface CaptureWindow {
  fetch?: (...args: never[]) => Promise<unknown>;
  XMLHttpRequest?: { prototype: object };
  postMessage(message: unknown, targetOrigin: string): void;
  location: { origin: string; href: string };
}

export interface CaptureOptions {
  now: () => number;
  /**
   * Development builds only: called for every NEOSIA API response, with the
   * parsed body for allowlisted paths only (structure listing, never values).
   */
  onSeen?: (match: UrlMatch, json: unknown) => void;
}

const INSTALLED = Symbol.for('sulo.neosia.capture');
const noop = () => undefined;

function urlOf(input: unknown): string {
  if (typeof input === 'string') return input;
  if (input && typeof input === 'object') {
    const maybe = input as { url?: unknown; href?: unknown };
    if (typeof maybe.url === 'string') return maybe.url; // Request
    if (typeof maybe.href === 'string') return maybe.href; // URL
  }
  return String(input);
}

/** Keeps name and length of the original on the wrapper (apps sometimes read them). */
function sameShape<T extends object>(wrapper: T, original: object): T {
  try {
    Object.defineProperty(wrapper, 'name', { value: (original as { name?: string }).name, configurable: true });
    Object.defineProperty(wrapper, 'length', { value: (original as { length?: number }).length, configurable: true });
  } catch {
    // Not important enough to matter.
  }
  return wrapper;
}

export function installCapture(win: CaptureWindow, options: CaptureOptions): boolean {
  try {
    const marked = win as unknown as Record<symbol, boolean>;
    if (marked[INSTALLED]) return false;
    Object.defineProperty(win, INSTALLED, { value: true });
  } catch {
    return false;
  }

  const post = (message: CaptureMessage) => {
    try {
      win.postMessage(message, win.location.origin);
    } catch {
      // The page is going away.
    }
  };

  const handleJson = (match: UrlMatch, json: unknown) => {
    if (match.kind !== 'endpoint' && match.kind !== 'observe') return;
    try {
      options.onSeen?.(match, json);
    } catch {
      // Dev listing only.
    }
    // Observed only: key names went to the dev listing; nothing is posted.
    if (match.kind !== 'endpoint') return;
    const base = { type: CAPTURE_TYPE, v: CAPTURE_SCHEMA_VERSION, endpoint: match.endpoint.id, at: options.now() } as const;
    const result = projectResponse(match.endpoint.spec, json);
    if (result.status !== 'ok') {
      post({ ...base, status: 'unknown_shape' });
      return;
    }
    const message: CaptureMessage = { ...base, status: 'ok', data: result.data };
    let size = Infinity;
    try {
      size = JSON.stringify(message).length;
    } catch {
      // Cyclic or odd: treated as too large.
    }
    post(size <= MAX_MESSAGE_CHARS ? message : { ...base, status: 'unknown_shape' });
  };

  /** A NEOSIA API path outside the allowlist: its response is never read (dev builds list the path). */
  const skip = (match: UrlMatch) => {
    try {
      options.onSeen?.(match, undefined);
    } catch {
      // Dev listing only.
    }
  };

  /** Read the body: allowlisted responses always; observe-only ones in development builds only. */
  const reads = (match: UrlMatch) => match.kind === 'endpoint' || (match.kind === 'observe' && options.onSeen !== undefined);

  const handleText = (match: UrlMatch, text: unknown) => {
    try {
      if (typeof text !== 'string' || text.length === 0 || text.length > MAX_RESPONSE_CHARS) {
        handleJson(match, undefined);
        return;
      }
      let json: unknown;
      try {
        json = JSON.parse(text);
      } catch {
        json = undefined; // not JSON: unknown_shape
      }
      handleJson(match, json);
    } catch {
      // Silent by design.
    }
  };

  const matchOf = (raw: unknown): UrlMatch | null => {
    try {
      return matchUrl(urlOf(raw), win.location.href);
    } catch {
      return null;
    }
  };

  // ---------- fetch ----------
  try {
    const original = win.fetch;
    if (typeof original === 'function') {
      const wrapped = sameShape(function (this: unknown, ...args: never[]) {
        const result = original.apply(this, args);
        try {
          const match = matchOf(args[0]);
          if (match && !reads(match)) skip(match);
          else if (match && result && typeof (result as Promise<unknown>).then === 'function') {
            (result as Promise<unknown>).then((response) => {
              try {
                const r = response as { ok?: boolean; clone?: () => { text: () => Promise<string> } };
                if (!r || r.ok !== true || typeof r.clone !== 'function') return;
                r.clone()
                  .text()
                  .then((text) => handleText(match, text), noop);
              } catch {
                // Body already used, odd response: nothing to read.
              }
            }, noop);
          }
        } catch {
          // Never in the app's way.
        }
        return result;
      }, original);
      win.fetch = wrapped as typeof original;
    }
  } catch {
    // fetch stays as it was.
  }

  // ---------- XMLHttpRequest ----------
  try {
    const proto = win.XMLHttpRequest?.prototype as
      | { open: (...args: unknown[]) => unknown; send: (...args: unknown[]) => unknown }
      | undefined;
    if (proto && typeof proto.open === 'function' && typeof proto.send === 'function') {
      const urls = new WeakMap<object, string>();
      const originalOpen = proto.open;
      const originalSend = proto.send;
      proto.open = sameShape(function (this: object, ...args: unknown[]) {
        try {
          urls.set(this, urlOf(args[1]));
        } catch {
          // The request still opens.
        }
        return originalOpen.apply(this, args);
      }, originalOpen);
      proto.send = sameShape(function (this: object, ...args: unknown[]) {
        try {
          const url = urls.get(this);
          const match = url === undefined ? null : matchOf(url);
          const xhr = this as { addEventListener?: (t: string, l: () => void, o?: unknown) => void; status: number; responseType: string; responseText: string; response: unknown };
          if (match && !reads(match)) skip(match);
          else if (match && typeof xhr.addEventListener === 'function') {
            xhr.addEventListener(
              'load',
              () => {
                try {
                  if (xhr.status < 200 || xhr.status >= 300) return;
                  // Only "" and "json" (docs/NEOSIA.md); blobs, buffers and documents are never touched.
                  if (xhr.responseType === '') handleText(match, xhr.responseText);
                  else if (xhr.responseType === 'json') handleJson(match, xhr.response);
                } catch {
                  // Silent by design.
                }
              },
              { once: true },
            );
          }
        } catch {
          // The request is sent regardless.
        }
        return originalSend.apply(this, args);
      }, originalSend);
    }
  } catch {
    // XHR stays as it was.
  }
  return true;
}
