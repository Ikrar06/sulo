// The isolated-world bridge (entrypoints/neosia-bridge.ts): takes capture
// messages from the page-world script and hands them to the service worker.
// Pure; the window, clock, hash and sender are injected (tests/neosia-bridge.test.ts).
//
// A message passes only if every condition holds:
// - event.source is this window (not a frame, not another window)
// - event.origin is the NEOSIA app's origin
// - its type is the capture type
// - its JSON is at most MAX_MESSAGE_CHARS characters
// - it passes the Zod schema derived from the allowlist
// Messages are untrusted page data: never rendered as HTML anywhere.
// The same endpoint with the same projected data within 5 seconds is
// dropped (the app fires each response twice per page).

import { CAPTURE_TYPE, NEOSIA_APP_ORIGIN } from './allowlist';
import { parseCapture, stableStringify, type Capture } from './schema';

export const DEDUP_MS = 5_000;

export interface MessageLike {
  source: unknown;
  origin: string;
  data: unknown;
}

export interface BridgeDeps {
  /** The window the bridge runs in: event.source must be this. */
  self: unknown;
  nowMs: () => number;
  /** SHA-256 hex of a string. */
  hash: (text: string) => Promise<string>;
  send: (capture: Capture) => void;
  /** Development builds only: other message types this bridge forwards (the observation listing). */
  other?: (data: unknown) => void;
}

export function createBridge(deps: BridgeDeps): (event: MessageLike) => Promise<'sent' | 'duplicate' | 'rejected' | 'ignored'> {
  // Last time each endpoint + data hash was sent; only ordering and dedup, lost on reload.
  let recent = new Map<string, number>();
  return async (event) => {
    try {
      if (event.source !== deps.self || event.origin !== NEOSIA_APP_ORIGIN) return 'ignored';
      const data = event.data as { type?: unknown } | null;
      if (!data || typeof data !== 'object') return 'ignored';
      if (data.type !== CAPTURE_TYPE) {
        deps.other?.(data);
        return 'ignored';
      }
      const capture = parseCapture(data);
      if (!capture) return 'rejected';
      const now = deps.nowMs();
      const key = `${capture.endpoint}:${capture.status}:${await deps.hash(stableStringify(capture.status === 'ok' ? capture.data : null))}`;
      recent = new Map([...recent].filter(([, at]) => now - at < DEDUP_MS));
      if (recent.has(key)) return 'duplicate';
      recent.set(key, now);
      deps.send(capture);
      return 'sent';
    } catch {
      return 'rejected';
    }
  };
}

/** SHA-256 hex with Web Crypto (content scripts have it). */
export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}
